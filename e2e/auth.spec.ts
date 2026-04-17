import { test, expect } from '@playwright/test';
import { login, TEST_ADMIN } from './helpers';

test.describe('Autenticação', () => {
  test('redireciona para /login quando não autenticado', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveURL(/login/);
  });

  test('exibe erro com credenciais inválidas', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel(/e-mail/i).fill('invalido@teste.com');
    await page.getByLabel(/senha/i).fill('senhainvalida');
    await page.getByRole('button', { name: /entrar/i }).click();
    // Aguarda mensagem de erro (toast ou texto na página)
    await expect(
      page.locator('[data-sonner-toast], [role="alert"], .text-destructive')
    ).toBeVisible({ timeout: 8_000 });
  });

  test('login com admin redireciona para dashboard', async ({ page }) => {
    await login(page, TEST_ADMIN.email, TEST_ADMIN.password);
    await expect(page).toHaveURL('/');
    // Verifica que a sidebar está presente (independe de collapsed ou perfil carregado)
    await expect(page.locator('aside')).toBeVisible();
  });

  test('logout encerra a sessão', async ({ page }) => {
    await login(page, TEST_ADMIN.email, TEST_ADMIN.password);
    // Usa o botão de logout no header (aria-label="Sair")
    await page.getByRole('button', { name: 'Sair' }).click();
    await expect(page).toHaveURL(/login/);
  });
});
