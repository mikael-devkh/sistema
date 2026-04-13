import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import { componentTagger } from "lovable-tagger";
import { VitePWA } from "vite-plugin-pwa";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  build: {
    rollupOptions: {
      output: {
        // Garantir nomes de arquivos consistentes
        entryFileNames: 'assets/[name].[hash].js',
        chunkFileNames: 'assets/[name].[hash].js',
        assetFileNames: 'assets/[name].[hash].[ext]',
        manualChunks(id) {
          // Firebase into its own chunk (largest dependency)
          if (id.includes('node_modules/firebase') || id.includes('node_modules/@firebase')) {
            return 'vendor-firebase';
          }
          // pdf-lib (lazy-loaded, only needed for PDF generation)
          if (id.includes('node_modules/pdf-lib') || id.includes('node_modules/@pdf-lib') || id.includes('node_modules/fontkit') || id.includes('node_modules/pdfkit')) {
            return 'vendor-pdflib';
          }
          // React core
          if (id.includes('node_modules/react') || id.includes('node_modules/react-dom') || id.includes('node_modules/scheduler')) {
            return 'vendor-react';
          }
          // Radix UI / shadcn component primitives
          if (id.includes('node_modules/@radix-ui')) {
            return 'vendor-radix';
          }
          // date-fns
          if (id.includes('node_modules/date-fns')) {
            return 'vendor-date-fns';
          }
          // Other node_modules → generic vendor chunk
          if (id.includes('node_modules')) {
            return 'vendor-misc';
          }
        },
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
        // Estratégia para assets JS: NetworkFirst com fallback para cache
        runtimeCaching: [
          {
            urlPattern: /\.(?:js|mjs)$/,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'js-cache',
              networkTimeoutSeconds: 3,
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 60 * 60 * 24 // 24 horas
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          },
          {
            urlPattern: /^https:\/\/api\./,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-cache',
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 60 * 60 // 1 hora
              }
            }
          },
          {
            urlPattern: /\/api\/buscar-fsa/,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'fsa-cache',
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 5 * 60 // 5 minutos
              }
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
