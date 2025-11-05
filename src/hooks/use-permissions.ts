import { useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { getUserPermissions, getUserRole, type Role } from '../lib/permissions';

export function usePermissions() {
  const { user, profile } = useAuth();
  
  const role = useMemo<Role>(() => {
    if (!user?.uid) return 'visualizador';
    return getUserRole(user.uid, profile?.role);
  }, [user, profile]);

  const permissions = useMemo(() => {
    return getUserPermissions(role);
  }, [role]);

  return { role, permissions };
}
