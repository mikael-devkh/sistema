export type Role = 'admin' | 'operador' | 'financeiro' | 'tecnico' | 'visualizador';

export interface Permissions {
  canCreateRat: boolean;
  canEditRat: boolean;
  canDeleteRat: boolean;
  canViewReports: boolean;
  canManageTemplates: boolean;
  canManageUsers: boolean;
  // Chamados
  canRegisterChamado: boolean;
  canValidateOperador: boolean;
  canValidateFinanceiro: boolean;
  canGeneratePayment: boolean;
  canManageCatalogo: boolean;
  // Estoque
  canManageEstoque: boolean;
  // Financeiro
  canViewFinancialValues: boolean;
}

const rolePermissions: Record<Role, Permissions> = {
  admin: {
    canCreateRat: true,
    canEditRat: true,
    canDeleteRat: true,
    canViewReports: true,
    canManageTemplates: true,
    canManageUsers: true,
    canRegisterChamado: true,
    canValidateOperador: true,
    canValidateFinanceiro: true,
    canGeneratePayment: true,
    canManageCatalogo: true,
    canManageEstoque: true,
    canViewFinancialValues: true,
  },
  operador: {
    canCreateRat: false,
    canEditRat: false,
    canDeleteRat: false,
    canViewReports: true,
    canManageTemplates: false,
    canManageUsers: false,
    canRegisterChamado: true,
    canValidateOperador: true,
    canValidateFinanceiro: false,
    canGeneratePayment: false,
    canManageCatalogo: false,
    canManageEstoque: true,
    canViewFinancialValues: false,
  },
  financeiro: {
    canCreateRat: false,
    canEditRat: false,
    canDeleteRat: false,
    canViewReports: true,
    canManageTemplates: false,
    canManageUsers: false,
    canRegisterChamado: true,
    canValidateOperador: true,
    canValidateFinanceiro: true,
    canGeneratePayment: true,
    canManageCatalogo: true,
    canManageEstoque: true,
    canViewFinancialValues: true,
  },
  tecnico: {
    canCreateRat: true,
    canEditRat: true,
    canDeleteRat: false,
    canViewReports: true,
    canManageTemplates: false,
    canManageUsers: false,
    canRegisterChamado: false,
    canValidateOperador: false,
    canValidateFinanceiro: false,
    canGeneratePayment: false,
    canManageCatalogo: false,
    canManageEstoque: false,
    canViewFinancialValues: false,
  },
  visualizador: {
    canCreateRat: false,
    canEditRat: false,
    canDeleteRat: false,
    canViewReports: true,
    canManageTemplates: false,
    canManageUsers: false,
    canRegisterChamado: false,
    canValidateOperador: false,
    canValidateFinanceiro: false,
    canGeneratePayment: false,
    canManageCatalogo: false,
    canManageEstoque: false,
    canViewFinancialValues: false,
  },
};

export function getUserRole(_userId: string, profileRole?: string): Role {
  if (profileRole === 'admin' || profileRole === 'operador' || profileRole === 'financeiro' || profileRole === 'tecnico' || profileRole === 'visualizador') {
    return profileRole;
  }
  return 'visualizador';
}

export function getUserPermissions(role: Role): Permissions {
  return rolePermissions[role];
}

export function hasPermission(userId: string, permission: keyof Permissions, profileRole?: string): boolean {
  const role = getUserRole(userId, profileRole);
  const permissions = getUserPermissions(role);
  return permissions[permission];
}
