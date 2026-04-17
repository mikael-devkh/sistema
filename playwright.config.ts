import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  // Ordem explícita: auth → tecnico (cria dados) → chamados (usa técnico) → estoque
  testMatch: [
    'e2e/auth.spec.ts',
    'e2e/tecnico.spec.ts',
    'e2e/chamados.spec.ts',
    'e2e/estoque.spec.ts',
  ],
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: [['html', { open: 'never' }], ['list']],

  use: {
    baseURL: process.env.DEV_URL ?? 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 15_000,
    navigationTimeout: 20_000,
  },

  expect: {
    // Firebase Auth + Firestore podem demorar alguns segundos para resolver
    timeout: 15_000,
  },

  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],

  // Sem webServer — o servidor dev deve estar rodando em outro terminal:
  //   npm run dev
  // Depois rode os testes neste terminal:
  //   npm run test:e2e
});
