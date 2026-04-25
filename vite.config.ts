import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import { componentTagger } from "lovable-tagger";
import { VitePWA } from "vite-plugin-pwa";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 3000,
    strictPort: false,
    proxy: {
      '/api': {
        target: 'http://localhost:4000',
        changeOrigin: true,
      },
    },
  },
  build: {
    rollupOptions: {
      output: {
        // Garantir nomes de arquivos consistentes
        entryFileNames: 'assets/[name].[hash].js',
        chunkFileNames: 'assets/[name].[hash].js',
        assetFileNames: 'assets/[name].[hash].[ext]',
      },
    },
    // Aumentar limite de aviso de tamanho
    chunkSizeWarningLimit: 1000,
  },
  plugins: [
    react(),
    mode === "development" && componentTagger(),
    VitePWA({
      registerType: "autoUpdate",
      strategies: "generateSW",
      includeAssets: ['favicon.ico', 'icons/icon-192.svg', 'icons/icon-512.svg'],
      manifest: {
        name: "WT Serviços em Campo",
        short_name: "WT Serviços",
        description:
          "Ferramentas WT Tecnologia para gestão de IPs, RATs e chamados em campo.",
        theme_color: "#0f172a",
        background_color: "#0f172a",
        display: "standalone",
        start_url: "/",
        icons: [
          {
            src: "/icons/icon-192.svg",
            sizes: "192x192",
            type: "image/svg+xml",
          },
          {
            src: "/icons/icon-512.svg",
            sizes: "512x512",
            type: "image/svg+xml",
          },
        ],
      },
      workbox: {
        cleanupOutdatedCaches: true,
        skipWaiting: true,
        clientsClaim: true,
        // NÃO interceptar assets gerados pelo build (/assets/*) — o browser já
        // faz cache via header HTTP usando o hash no nome do arquivo. Se o SW
        // intercepta isso, depois de um deploy ele tenta servir chunks com
        // hash antigo que não existem mais na CDN, quebrando lazy imports.
        navigateFallbackDenylist: [/^\/assets\//],
        runtimeCaching: [
          // API externa — cache curto, network first
          {
            urlPattern: /^https:\/\/api\./,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-cache',
              networkTimeoutSeconds: 3,
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 60 * 60 // 1 hora
              },
              cacheableResponse: { statuses: [0, 200] },
            }
          },
          {
            urlPattern: /\/api\/buscar-fsa/,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'fsa-cache',
              networkTimeoutSeconds: 3,
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 5 * 60 // 5 minutos
              },
              cacheableResponse: { statuses: [0, 200] },
            }
          }
        ]
      }
    }),
  ].filter(Boolean),
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: "./src/test/setup.ts",
  },
}));
