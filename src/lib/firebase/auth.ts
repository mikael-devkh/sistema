import { FirebaseApp } from "./app";
import { FirebaseError } from "./error";

export type AuthError = FirebaseError;

export interface User {
  uid: string;
  email: string | null;
  emailVerified: boolean;
}

export interface Auth {
  app: FirebaseApp | null;
  currentUser: User | null;
}

type AuthListener = (user: User | null) => void;

interface StoredUser {
  uid: string;
  email: string;
  password: string;
  emailVerified: boolean;
}

const USERS_KEY = "wt-firebase-users";

const getStorage = (): Storage | undefined => {
  if (typeof window === "undefined") {
    return undefined;
  }
  try {
    return window.localStorage;
  } catch (error) {
    console.warn("LocalStorage indisponível", error);
    return undefined;
  }
};

const loadUsers = (): StoredUser[] => {
  const storage = getStorage();
  if (!storage) {
    return memoryUsers;
  }
  const raw = storage.getItem(USERS_KEY);
  if (!raw) {
    return [];
  }
  try {
    const parsed = JSON.parse(raw) as Array<Partial<StoredUser>>;
    return parsed.map((user) => ({
      uid: user.uid ?? generateUid(),
      email: user.email ?? "",
      password: user.password ?? "",
      emailVerified: user.emailVerified ?? true,
    }));
  } catch (error) {
    console.warn("Não foi possível ler usuários do LocalStorage", error);
    return [];
  }
};

const saveUsers = (users: StoredUser[]) => {
  const storage = getStorage();
  if (!storage) {
    memoryUsers = users;
    return;
  }
  storage.setItem(USERS_KEY, JSON.stringify(users));
};

let memoryUsers: StoredUser[] = [];

const authInstance: Auth & { listeners: Set<AuthListener> } = {
  app: null,
  currentUser: null,
  listeners: new Set<AuthListener>(),
};

const notify = (user: User | null) => {
  authInstance.listeners.forEach((listener) => {
    listener(user);
  });
};

const createUserObject = (stored: StoredUser): User => ({
  uid: stored.uid,
  email: stored.email,
  emailVerified: stored.emailVerified,
});

export const getAuth = (app?: FirebaseApp): Auth => {
  authInstance.app = app ?? null;
  return authInstance;
};

export const onAuthStateChanged = (
  auth: Auth,
  next: (user: User | null) => void,
  error?: (err: FirebaseError) => void,
): (() => void) => {
  const listener: AuthListener = (user) => {
    next(user);
  };
  (authInstance.listeners as Set<AuthListener>).add(listener);

  Promise.resolve().then(() => {
    try {
      next(auth.currentUser);
    } catch (err) {
      if (error && err instanceof Error) {
        error(new FirebaseError("auth/internal-error", err.message));
      }
    }
  });

  return () => {
    (authInstance.listeners as Set<AuthListener>).delete(listener);
  };
};

const generateUid = () => {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2, 12);
};

export interface UserCredential {
  user: User;
}

export const createUserWithEmailAndPassword = async (
  auth: Auth,
  email: string,
  password: string,
): Promise<UserCredential> => {
  const users = loadUsers();
  const existing = users.find((user) => user.email === email);
  if (existing) {
    throw new FirebaseError("auth/email-already-in-use", "Usuário já existente");
  }
  const stored: StoredUser = {
    uid: generateUid(),
    email,
    password,
    emailVerified: false,
  };
  users.push(stored);
  saveUsers(users);

  const user = createUserObject(stored);
  authInstance.currentUser = user;
  notify(user);
  return { user };
};

export const signInWithEmailAndPassword = async (
  auth: Auth,
  email: string,
  password: string,
): Promise<UserCredential> => {
  const users = loadUsers();
  const stored = users.find((user) => user.email === email);
  if (!stored) {
    throw new FirebaseError("auth/user-not-found", "Usuário não encontrado");
  }
  if (stored.password !== password) {
    throw new FirebaseError("auth/wrong-password", "Senha incorreta");
  }
  const user = createUserObject(stored);
  authInstance.currentUser = user;
  notify(user);
  return { user };
};

export const signOut = async (_auth?: Auth): Promise<void> => {
  authInstance.currentUser = null;
  notify(null);
};

export const sendEmailVerification = async (user: User): Promise<void> => {
  const users = loadUsers();
  const stored = users.find((item) => item.uid === user.uid);
  if (!stored) {
    throw new FirebaseError("auth/user-not-found", "Usuário não encontrado");
  }
  stored.emailVerified = true;
  saveUsers(users);

  authInstance.currentUser = createUserObject(stored);
  notify(authInstance.currentUser);
};
