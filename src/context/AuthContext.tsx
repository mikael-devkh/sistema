import { useCallback, useEffect, useMemo, useState } from "react";
import { createContext, useContext, type ReactNode } from "react";
import type { User } from "firebase/auth";
import { useAuthState } from "react-firebase-hooks/auth";
import { auth } from "../firebase";
import { db } from "../firebase";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";

export interface UserProfileData {
  nome?: string;
  matricula?: string;
  role?: 'admin' | 'tecnico';
  allowedFsaIds?: string[];
  avatarUrl?: string;
}

interface AuthContextValue {
  user: User | null | undefined;
  loadingAuth: boolean;
  profile: UserProfileData | null;
  loadingProfile: boolean;
  refreshProfile: () => Promise<void>;
  updateProfileLocally: (profile: UserProfileData | null) => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, loadingAuth] = useAuthState(auth);
  const [profile, setProfile] = useState<UserProfileData | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(false);

  const refreshProfile = useCallback(async () => {
    if (!user) {
      setProfile(null);
      setLoadingProfile(false);
      return;
    }

    setLoadingProfile(true);
    try {
      const profileRef = doc(db, "users", user.uid);
      const snapshot = await getDoc(profileRef);
      
      if (!snapshot.exists()) {
        // Criar documento automaticamente se não existir
        await setDoc(
          profileRef,
          {
            email: user.email ?? "",
            role: 'tecnico', // Default - pode mudar depois no Firebase Console
            createdAt: serverTimestamp(),
          },
          { merge: true }
        );
        
        // Atualizar profile local com dados padrão
        setProfile({
          nome: undefined,
          matricula: undefined,
          role: 'tecnico',
          email: user.email ?? undefined,
          allowedFsaIds: undefined,
          avatarUrl: undefined,
        });
        
        console.log('✅ Documento users criado automaticamente para:', user.uid);
      } else {
        // Documento existe - ler dados normalmente
        const data = snapshot.data();
        setProfile({
          nome: typeof data.nome === "string" ? data.nome : undefined,
          matricula:
            typeof data.matricula === "string" ? data.matricula : undefined,
          role: data.role === 'admin' || data.role === 'tecnico' ? data.role : undefined,
          allowedFsaIds: Array.isArray(data.allowedFsaIds) ? data.allowedFsaIds as string[] : undefined,
          avatarUrl: typeof data.avatarUrl === 'string' ? data.avatarUrl : undefined,
        });
      }
    } catch (error) {
      console.error("Não foi possível carregar o perfil do usuário:", error);
      setProfile(null);
    } finally {
      setLoadingProfile(false);
    }
  }, [user]);

  useEffect(() => {
    if (loadingAuth) {
      return;
    }
    void refreshProfile();
  }, [loadingAuth, refreshProfile]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loadingAuth,
      profile,
      loadingProfile,
      refreshProfile,
      updateProfileLocally: setProfile,
    }),
    [user, loadingAuth, profile, loadingProfile, refreshProfile],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }

  return context;
};
