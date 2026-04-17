import { type Page, expect } from '@playwright/test';

// ─── Credenciais de teste ────────────────────────────────────────────────────
// Usuários criados por: node scripts/create-test-users.mjs
export const TEST_ADMIN = {
  email: process.env.TEST_ADMIN_EMAIL ?? 'admin.e2e@wt-teste.com',
  password: process.env.TEST_ADMIN_PASSWORD ?? 'Teste@E2E!2024',
};

export const TEST_TECNICO = {
  email: process.env.TEST_TECNICO_EMAIL ?? 'tecnico.e2e@wt-teste.com',
  password: process.env.TEST_TECNICO_PASSWORD ?? 'Teste@E2E!2024',
};

// ─── Login ───────────────────────────────────────────────────────────────────

export async function login(page: Page, email: string, password: string) {
  // Limpa localStorage para evitar sidebar colapsada de sessão anterior
  await page.goto('/login');
  await page.evaluate(() => localStorage.removeItem('sidebar-collapsed'));

  await page.getByPlaceholder('nome@empresa.com').fill(email);
  await page.getByPlaceholder('••••••••').fill(password);
  await page.getByRole('button', { name: 'Entrar' }).click();

  // Aguarda sair do /login
  await page.waitForURL(url => !url.pathname.includes('/login'), { timeout: 20_000 });

  // Aguarda o spinner do ProtectedRoute desaparecer e o layout montar
  // (não usar waitForLoadState('networkidle') — Firestore mantém WebSockets abertos)
  await page.locator('aside').waitFor({ state: 'visible', timeout: 20_000 });

  // Aguarda o perfil do Firestore carregar (role label aparece no rodapé da sidebar)
  await page.locator('aside').getByText(/Admin|Técnico|Operador|Financeiro|Visualizador/).waitFor({ timeout: 15_000 });
}

export async function loginAsAdmin(page: Page) {
  await login(page, TEST_ADMIN.email, TEST_ADMIN.password);
}

export async function loginAsTecnico(page: Page) {
  await login(page, TEST_TECNICO.email, TEST_TECNICO.password);
}

// ─── Aguarda toast ────────────────────────────────────────────────────────────

export async function waitForToast(page: Page, text: string | RegExp) {
  await expect(page.locator('[data-sonner-toast]')).toContainText(text, { timeout: 10_000 });
}

// ─── Selects Radix UI ─────────────────────────────────────────────────────────
// Os Selects do Radix não usam <select> nativo, então precisamos clicar no trigger
// e depois clicar no item desejado.

export async function selectRadix(page: Page, triggerLabel: string | RegExp, optionText: string | RegExp) {
  // FormControl envolve <Select> (provider), não <SelectTrigger>, então o id não chega no button.
  // Estratégia: label → pai (FormItem) → [role="combobox"]
  await page.locator('label')
    .filter({ hasText: triggerLabel })
    .locator('..')
    .locator('[role="combobox"]')
    .click();
  await page.getByRole('option', { name: optionText }).click();
}
