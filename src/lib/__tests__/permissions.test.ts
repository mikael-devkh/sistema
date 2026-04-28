import { describe, it, expect } from 'vitest';
import {
  getUserRole,
  getUserPermissions,
  hasPermission,
  type Role,
} from '../permissions';

/**
 * Permissions são consultadas em todas as telas críticas (validação,
 * pagamentos, RAT). Garantir contratos por role evita regressão silenciosa
 * em mudanças de tabela.
 */

describe('getUserRole', () => {
  it('retorna a role quando válida', () => {
    expect(getUserRole('u', 'admin')).toBe('admin');
    expect(getUserRole('u', 'operador')).toBe('operador');
    expect(getUserRole('u', 'financeiro')).toBe('financeiro');
    expect(getUserRole('u', 'tecnico')).toBe('tecnico');
    expect(getUserRole('u', 'visualizador')).toBe('visualizador');
  });

  it('cai para visualizador quando role é desconhecida ou ausente', () => {
    expect(getUserRole('u')).toBe('visualizador');
    expect(getUserRole('u', undefined)).toBe('visualizador');
    expect(getUserRole('u', 'hacker')).toBe('visualizador');
    expect(getUserRole('u', '')).toBe('visualizador');
  });
});

describe('getUserPermissions — gates financeiros', () => {
  const cases: Array<[Role, boolean, boolean, boolean]> = [
    // role,         canValidateFinanceiro, canGeneratePayment, canViewFinancialValues
    ['admin',        true,                  true,               true],
    ['financeiro',   true,                  true,               true],
    ['operador',     false,                 false,              false],
    ['tecnico',      false,                 false,              false],
    ['visualizador', false,                 false,              false],
  ];

  it.each(cases)(
    '%s tem permissões financeiras corretas',
    (role, validate, gen, view) => {
      const p = getUserPermissions(role);
      expect(p.canValidateFinanceiro).toBe(validate);
      expect(p.canGeneratePayment).toBe(gen);
      expect(p.canViewFinancialValues).toBe(view);
    },
  );
});

describe('hasPermission — gates de criação', () => {
  it('apenas operador/financeiro/admin podem registrar chamado', () => {
    expect(hasPermission('u', 'canRegisterChamado', 'admin')).toBe(true);
    expect(hasPermission('u', 'canRegisterChamado', 'operador')).toBe(true);
    expect(hasPermission('u', 'canRegisterChamado', 'financeiro')).toBe(true);
    expect(hasPermission('u', 'canRegisterChamado', 'tecnico')).toBe(false);
    expect(hasPermission('u', 'canRegisterChamado', 'visualizador')).toBe(false);
  });

  it('apenas admin pode gerenciar usuários', () => {
    expect(hasPermission('u', 'canManageUsers', 'admin')).toBe(true);
    expect(hasPermission('u', 'canManageUsers', 'operador')).toBe(false);
    expect(hasPermission('u', 'canManageUsers', 'financeiro')).toBe(false);
    expect(hasPermission('u', 'canManageUsers', 'tecnico')).toBe(false);
    expect(hasPermission('u', 'canManageUsers', 'visualizador')).toBe(false);
  });

  it('role desconhecida nunca tem permissão financeira', () => {
    expect(hasPermission('u', 'canGeneratePayment', 'hacker')).toBe(false);
    expect(hasPermission('u', 'canValidateFinanceiro', 'hacker')).toBe(false);
    expect(hasPermission('u', 'canViewFinancialValues', 'hacker')).toBe(false);
  });
});
