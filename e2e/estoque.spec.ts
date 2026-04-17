import { test, expect } from '@playwright/test';
import { loginAsAdmin, waitForToast, selectRadix } from './helpers';

const timestamp = Date.now();
const ITEM_NOME = `Item E2E ${timestamp}`;

test.describe('Estoque', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto('/estoque');
  });

  test('exibe a página de estoque com KPIs', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /estoque/i })).toBeVisible();
    // KPIs: total de itens, estoque baixo, sem estoque
    await expect(page.getByText(/total de itens/i)).toBeVisible({ timeout: 8_000 });
  });

  test('cria um novo item no estoque', async ({ page }) => {
    await page.getByRole('button', { name: /novo item/i }).click();
    const dialog = page.getByRole('dialog');

    await dialog.getByLabel(/nome/i).fill(ITEM_NOME);
    await dialog.getByLabel(/descrição/i).fill('Item criado pelo teste E2E');
    await dialog.getByLabel(/quantidade mínima/i).fill('5');

    // Unidade (Select Radix)
    await selectRadix(page, /unidade/i, /unidade|un\b/i);

    await dialog.getByRole('button', { name: /salvar|criar/i }).click();

    await waitForToast(page, /criado|salvo|sucesso/i);

    // Item deve aparecer na lista
    await expect(page.getByText(ITEM_NOME)).toBeVisible({ timeout: 5_000 });
  });

  test('registra uma entrada de estoque', async ({ page }) => {
    // Aguarda a lista carregar
    await expect(page.locator('[class*="card"]').first()).toBeVisible({ timeout: 10_000 });

    // Clica em Entrada no primeiro item
    await page.getByRole('button', { name: /entrada/i }).first().click();

    const dialog = page.getByRole('dialog');
    await dialog.getByLabel(/quantidade/i).fill('10');
    await dialog.getByLabel(/observação/i).fill('Entrada via teste E2E');
    await dialog.getByRole('button', { name: /confirmar|registrar/i }).click();

    await waitForToast(page, /registrado|sucesso|entrada/i);
  });

  test('registra uma saída de estoque', async ({ page }) => {
    await expect(page.locator('[class*="card"]').first()).toBeVisible({ timeout: 10_000 });

    await page.getByRole('button', { name: /saída/i }).first().click();

    const dialog = page.getByRole('dialog');
    await dialog.getByLabel(/quantidade/i).fill('1');
    await dialog.getByLabel(/observação/i).fill('Saída via teste E2E');
    await dialog.getByRole('button', { name: /confirmar|registrar/i }).click();

    await waitForToast(page, /registrado|sucesso|saída/i);
  });

  test('valida que saída maior que saldo exibe aviso', async ({ page }) => {
    await expect(page.locator('[class*="card"]').first()).toBeVisible({ timeout: 10_000 });

    await page.getByRole('button', { name: /saída/i }).first().click();

    const dialog = page.getByRole('dialog');
    // Preenche quantidade absurdamente grande
    await dialog.getByLabel(/quantidade/i).fill('999999');

    // Deve aparecer aviso de saldo insuficiente (sem precisar submeter)
    await expect(dialog.getByText(/insuficiente|saldo|atenção/i)).toBeVisible();
  });

  test('abre o histórico de movimentações', async ({ page }) => {
    await expect(page.locator('[class*="card"]').first()).toBeVisible({ timeout: 10_000 });

    await page.getByRole('button', { name: /histórico/i }).first().click();

    const dialog = page.getByRole('dialog');
    await expect(dialog.getByText(/movimentações|histórico/i)).toBeVisible();
  });
});
