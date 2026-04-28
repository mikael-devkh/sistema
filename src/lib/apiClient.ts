import { auth } from '../firebase';

async function getIdToken(): Promise<string> {
  const user = auth.currentUser;
  if (!user) throw new Error('Usuário não autenticado.');
  return user.getIdToken();
}

export async function apiFetch(input: string, init: RequestInit = {}): Promise<Response> {
  const token = await getIdToken();
  const headers = new Headers(init.headers || {});
  headers.set('Authorization', `Bearer ${token}`);
  if (init.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  return fetch(input, { ...init, headers });
}
