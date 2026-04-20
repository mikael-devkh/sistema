import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

// After a new deployment old cached pages reference chunk hashes that no
// longer exist on the CDN. Vite fires this event; reloading fetches the
// fresh index.html and resolves the mismatch.
window.addEventListener('vite:preloadError', () => {
  window.location.reload();
});
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
