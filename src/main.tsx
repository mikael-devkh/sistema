import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

// ─── Recuperação de chunks órfãos pós-deploy ──────────────────────────────────
// Após um novo deploy, abas abertas referenciam chunks com hash antigo que
// já não existem na CDN. Detecta e recarrega para pegar o `index.html` novo.
//
// Há 4 vetores de falha tratados aqui:
//  1. vite:preloadError — dispara para <link rel="modulepreload"> que falha
//  2. Promise rejection de import() dinâmico (lazy components)
//  3. Erros do tipo "Failed to fetch dynamically imported module"
//  4. ServiceWorker servindo chunk fantasma (intercepted-error)
//
// Em todos, fazemos reload UMA vez (com flag em sessionStorage para evitar loop).

const RELOAD_FLAG = '__chunk_reload_done__';
const isChunkLoadError = (err: unknown): boolean => {
  if (!err) return false;
  const msg = (err instanceof Error ? err.message : String(err)).toLowerCase();
  return (
    msg.includes('dynamically imported module') ||
    msg.includes('failed to fetch') && msg.includes('module') ||
    msg.includes('importing a module script failed') ||
    msg.includes('error loading dynamically') ||
    /\/assets\/[^/]+\.js/i.test(msg) && msg.includes('error')
  );
};

const isDomMutationError = (err: unknown): boolean => {
  if (!err) return false;
  const msg = (err instanceof Error ? err.message : String(err)).toLowerCase();
  const name = err instanceof DOMException ? err.name.toLowerCase() : '';

  return (
    name === 'notfounderror' ||
    msg.includes("failed to execute 'insertbefore'") ||
    msg.includes('falha ao executar \'insertbefore\'') ||
    msg.includes('the node before which the new node is to be inserted is not a child') ||
    msg.includes('o nó anterior ao qual o novo nó deve ser inserido não é filho') ||
    msg.includes("failed to execute 'removechild'") && msg.includes('not a child')
  );
};

const reloadOnce = async (reason: string) => {
  if (sessionStorage.getItem(RELOAD_FLAG)) {
    console.error('[chunk-reload] já recarregou nesta sessão, abortando para evitar loop:', reason);
    return;
  }
  sessionStorage.setItem(RELOAD_FLAG, '1');
  // Limpar SW para garantir busca do index.html fresh
  try {
    if ('serviceWorker' in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map(r => r.unregister()));
    }
    if ('caches' in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map(k => caches.delete(k)));
    }
  } catch { /* swallow — vamos recarregar de qualquer forma */ }
  console.warn('[chunk-reload] chunk não encontrado, recarregando:', reason);
  window.location.reload();
};

window.addEventListener('vite:preloadError', () => reloadOnce('vite:preloadError'));

window.addEventListener('unhandledrejection', e => {
  if (isChunkLoadError(e.reason) || isDomMutationError(e.reason)) {
    e.preventDefault();
    reloadOnce('unhandledrejection');
  }
});

window.addEventListener('error', e => {
  if (isChunkLoadError(e.error ?? e.message) || isDomMutationError(e.error ?? e.message)) {
    e.preventDefault();
    reloadOnce('window.error');
  }
});

// Limpa a flag quando carregamento bem-sucedido (após 5s)
setTimeout(() => sessionStorage.removeItem(RELOAD_FLAG), 5000);
import { ThemeProvider } from "next-themes";
import { SpeedInsights } from "@vercel/speed-insights/react";
import App from "./App.tsx";
import "./index.css";
import { AuthProvider } from "./context/AuthContext";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ThemeProvider
      attribute="class"
      defaultTheme="light"
      enableSystem={false}
      disableTransitionOnChange
    >
      <AuthProvider>
        <App />
      </AuthProvider>
    </ThemeProvider>
    <SpeedInsights />
  </StrictMode>,
);
