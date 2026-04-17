import { test, expect } from '@playwright/test';
import { loginAsAdmin, waitForToast, selectRadix } from './helpers';

const timestamp = Date.now();
const EMAIL_TECNICO = `tecnico.e2e.${timestamp}@teste.com`;

test.describe('Cadastro de Técnico', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto('/cadastrar-tecnico');
  });

  test('exibe o formulário de cadastro', async ({ page }) => {
    // CardTitle real: "Cadastrar Novo Técnico"
    await expect(page.getByText('Cadastrar Novo Técnico')).toBeVisible();
    await expect(page.getByPlaceholder('tecnico@empresa.com')).toBeVisible();
    await expect(page.getByLabel('Senha')).toBeVisible();
  });

  test('valida campos obrigatórios', async ({ page }) => {
    // Botão real: "Cadastrar Técnico"
    await page.getByRole('button', { name: 'Cadastrar Técnico' }).click();
    await expect(
      page.locator('.text-destructive').first()
    ).toBeVisible();
  });

  test('cadastra um novo técnico com sucesso', async ({ page }) => {
    await page.getByPlaceholder('tecnico@empresa.com').fill(EMAIL_TECNICO);
    await page.getByLabel('Senha').fill('Senha@123');

    await page.getByLabel('Nome', { exact: true }).fill('Técnico');
    await page.getByLabel('Nome Completo').fill('Técnico E2E Teste');
    await page.getByPlaceholder('(11) 99999-9999').first().fill('(11) 99999-0001');

    // Cargo (Select Radix)
    await selectRadix(page, /^Cargo$/i, /técnico/i);

    // Especialidades — obrigatório pelo menos uma
    await page.getByLabel('Field Service').check();

    await page.getByLabel('Cidade').fill('São Paulo');
    await selectRadix(page, /^UF$/i, 'SP');

    await page.getByRole('button', { name: 'Cadastrar Técnico' }).click();
    await waitForToast(page, /cadastrado|criado|sucesso/i);
  });

  test('não permite e-mail duplicado', async ({ page }) => {
    await page.getByPlaceholder('tecnico@empresa.com').fill('admin.e2e@wt-teste.com');
    await page.getByLabel('Senha').fill('Senha@123');
    await page.getByLabel('Nome', { exact: true }).fill('Duplicado');
    await page.getByLabel('Nome Completo').fill('Duplicado Teste');
    await page.getByPlaceholder('(11) 99999-9999').first().fill('(11) 99999-0002');
    await selectRadix(page, /^Cargo$/i, /técnico/i);
    await page.getByLabel('Field Service').check();
    await page.getByLabel('Cidade').fill('Rio de Janeiro');
    await selectRadix(page, /^UF$/i, 'RJ');

    await page.getByRole('button', { name: 'Cadastrar Técnico' }).click();
    await expect(
      page.locator('[data-sonner-toast]').filter({ hasText: /e-mail|já existe|já cadastrado|already/i })
    ).toBeVisible({ timeout: 10_000 });
  });
});

test.describe('Listagem de Técnicos', () => {
  test('admin visualiza lista de técnicos', async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto('/tecnicos');
    // Heading real: "Gestão de Técnicos"
    await expect(page.getByText('Gestão de Técnicos')).toBeVisible();
    await expect(
      page.locator('table, [class*="card"], [class*="grid"]').first()
    ).toBeVisible({ timeout: 10_000 });
  });
});
