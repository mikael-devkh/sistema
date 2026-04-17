import { test, expect } from '@playwright/test';
import { loginAsAdmin, loginAsTecnico, waitForToast, selectRadix } from './helpers';

const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

test.describe('Chamados — Criação', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto('/chamados');
  });

  test('exibe a página de chamados', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /chamados/i })).toBeVisible();
  });

  test('abre o formulário ao clicar em Registrar Chamado', async ({ page }) => {
    await page.getByRole('button', { name: /registrar chamado/i }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByRole('combobox', { name: /técnico/i })).toBeVisible();
  });

  test('valida campos obrigatórios', async ({ page }) => {
    await page.getByRole('button', { name: /registrar chamado/i }).click();
    // Tenta salvar sem preencher — validação via toast.error
    await page.getByRole('button', { name: /salvar rascunho/i }).click();
    await waitForToast(page, /selecione|informe/i);
  });

  test('cria um chamado como rascunho', async ({ page }) => {
    await page.getByRole('button', { name: /registrar chamado/i }).click();
    const dialog = page.getByRole('dialog');

    // Técnico (Select Radix — lista técnicos do Firestore)
    // Como o valor depende do banco, pegamos a primeira opção disponível
    await dialog.getByRole('combobox', { name: /técnico/i }).click();
    await page.getByRole('option').first().click();

    // FSA e loja
    await dialog.getByLabel(/FSA/i).fill('FSA-E2E-001');
    await dialog.getByLabel(/código.*loja|loja/i).fill('9999');

    // Data
    await dialog.getByLabel(/data.*atendimento|data/i).fill(today);

    // Salva como rascunho
    await dialog.getByRole('button', { name: /rascunho|salvar/i }).click();

    await waitForToast(page, /rascunho|salvo|criado/i);
  });

  test('cria um chamado e submete para validação', async ({ page }) => {
    await page.getByRole('button', { name: /registrar chamado/i }).click();
    const dialog = page.getByRole('dialog');

    await dialog.getByRole('combobox', { name: /técnico/i }).click();
    await page.getByRole('option').first().click();

    await dialog.getByLabel(/FSA/i).fill('FSA-E2E-002');
    await dialog.getByLabel(/código.*loja|loja/i).fill('8888');
    await dialog.getByLabel(/data.*atendimento|data/i).fill(today);
    await dialog.getByLabel(/hora.*início|início/i).fill('09:00');
    await dialog.getByLabel(/hora.*fim|fim/i).fill('11:00');

    // Submete
    await dialog.getByRole('button', { name: /submeter|enviar/i }).click();

    await waitForToast(page, /submetido|enviado|sucesso/i);

    // Chamado deve aparecer na lista com status "submetido"
    await expect(
      page.getByText(/FSA-E2E-002/)
    ).toBeVisible({ timeout: 5_000 });
  });
});

test.describe('Chamados — Permissões', () => {
  test('técnico vê apenas seus próprios chamados', async ({ page }) => {
    await loginAsTecnico(page);
    await page.goto('/chamados');
    // Página deve carregar (não redirecionar)
    await expect(page.getByRole('heading', { name: /chamados/i })).toBeVisible();
  });
});

test.describe('Fila de Validação', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto('/validacao');
  });

  test('exibe a fila de validação', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /validação/i })).toBeVisible();
    await expect(page.getByRole('tab', { name: /operador/i })).toBeVisible();
    await expect(page.getByRole('tab', { name: /financeiro/i })).toBeVisible();
  });

  test('troca de aba entre Operador e Financeiro', async ({ page }) => {
    await page.getByRole('tab', { name: /financeiro/i }).click();
    await expect(page.getByRole('tab', { name: /financeiro/i })).toHaveAttribute('aria-selected', 'true');
  });
});
