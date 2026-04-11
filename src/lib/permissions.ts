export type Role = 'admin' | 'tecnico' | 'visualizador';

export interface Permissions {
  canCreateRat: boolean;
  canEditRat: boolean;
  canDeleteRat: boolean;
  canViewReports: boolean;
  canManageTemplates: boolean;
  canManageUsers: boolean;
}

const rolePermissions: Record<Role, Permissions> = {
  admin: {
    canCreateRat: true,
    canEditRat: true,
    canDeleteRat: true,
    canViewReports: true,
    canManageTemplates: true,
    canManageUsers: true,
  },
  tecnico: {
    canCreateRat: true,
    canEditRat: true,
    canDeleteRat: false,
    canViewReports: true,
    canManageTemplates: false,
    canManageUsers: false,
  },
  visualizador: {
    canCreateRat: false,
    canEditRat: false,
    canDeleteRat: false,
    canViewReports: true,
    canManageTemplates: false,
    canManageUsers: false,
  },
};

export function getUserRole(userId: string, profileRole?: string): Role {
  // Priorizar role do profile (Firestore)
  if (profileRole === 'admin' || profileRole === 'tecnico' || profileRole === 'visualizador') {
    return profileRole;
  }
  
  // Buscar do localStorage como fallback
  const stored = localStorage.getItem(`user_role_${userId}`);
  if (stored === 'admin' || stored === 'tecnico' || stored === 'visualizador') {
    return stored;
  }
  
  return 'tecnico'; // Default
}

export function getUserPermissions(role: Role): Permissions {
  return rolePermissions[role];
}

export function hasPermission(userId: string, permission: keyof Permissions, profileRole?: string): boolean {
  const role = getUserRole(userId, profileRole);
  const permissions = getUserPermissions(role);
  return permissions[permission];
}
