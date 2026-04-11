import type { FirebaseApp } from "./app";

export interface Firestore {
  app: FirebaseApp | null;
}

export interface MockDocSnapshot {
  id: string;
  data: () => Record<string, unknown>;
}

export interface MockQuerySnapshot {
  docs: MockDocSnapshot[];
}

export const getFirestore = (app?: FirebaseApp): Firestore => ({
  app: app ?? null,
});

export const collection = (...args: unknown[]) => ({ __type: "collection", args });

export const doc = (...args: unknown[]) => ({ __type: "doc", args });

export const query = (...args: unknown[]) => ({ __type: "query", args });

export const where = (...args: unknown[]) => ({ __type: "where", args });

export const addDoc = async () => ({ id: `mock-${Date.now()}` });

export const setDoc = async () => {
  return Promise.resolve();
};

export const deleteDoc = async () => {
  return Promise.resolve();
};

export const onSnapshot = (
  _queryRef: unknown,
  next: (snapshot: MockQuerySnapshot) => void,
  error?: (error: Error) => void,
) => {
  try {
    next({ docs: [] });
  } catch (err) {
    if (error && err instanceof Error) {
      error(err);
    }
  }

  return () => undefined;
};

export const writeBatch = () => {
  const operations: unknown[] = [];
  return {
    delete: (...args: unknown[]) => operations.push(args),
    commit: async () => {
      operations.length = 0;
    },
  };
};
