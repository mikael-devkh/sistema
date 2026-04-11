export interface FirebaseApp {
  readonly config: Record<string, unknown>;
}

export const initializeApp = (config: Record<string, unknown>): FirebaseApp => ({
  config,
});

export { FirebaseError } from "./error";
