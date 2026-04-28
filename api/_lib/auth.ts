import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getApps, initializeApp, cert, applicationDefault } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

type Role = 'admin' | 'operador' | 'financeiro' | 'tecnico' | 'visualizador';

let initialized = false;
function ensureAdmin() {
  if (initialized || getApps().length > 0) {
    initialized = true;
    return;
  }
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKeyRaw = process.env.FIREBASE_PRIVATE_KEY;

  if (projectId && clientEmail && privateKeyRaw) {
    const privateKey = privateKeyRaw.replace(/\\n/g, '\n');
    initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
  } else {
    console.error('[firebase-admin] env vars ausentes:', {
      hasProjectId: !!projectId,
      hasClientEmail: !!clientEmail,
      hasPrivateKey: !!privateKeyRaw,
      privateKeyLen: privateKeyRaw?.length || 0,
    });
    initializeApp({ credential: applicationDefault() });
  }
  initialized = true;
}

const allowedOriginsEnv = process.env.ALLOWED_ORIGINS || '';
const allowedOrigins = allowedOriginsEnv
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

export function applyCors(req: VercelRequest, res: VercelResponse): boolean {
  const origin = (req.headers.origin as string) || '';
  const isAllowed = allowedOrigins.length === 0
    ? false
    : allowedOrigins.includes(origin);

  if (isAllowed) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Max-Age', '600');

  if (req.method === 'OPTIONS') {
    res.status(isAllowed ? 204 : 403).end();
    return true;
  }

  if (!isAllowed && origin) {
    res.status(403).json({ error: 'Origin not allowed' });
    return true;
  }
  return false;
}

export interface AuthedUser {
  uid: string;
  email?: string;
  role?: Role;
}

export async function requireAuth(
  req: VercelRequest,
  res: VercelResponse,
  opts?: { roles?: Role[] }
): Promise<AuthedUser | null> {
  const header = (req.headers.authorization as string) || '';
  const match = header.match(/^Bearer\s+(.+)$/i);
  if (!match) {
    res.status(401).json({ error: 'Missing bearer token' });
    return null;
  }

  try {
    ensureAdmin();
    const decoded = await getAuth().verifyIdToken(match[1]);

    // Prefer custom claim if presente; fallback pra Firestore /users/{uid}.role.
    // Mantemos os dois caminhos pra suportar ambientes Spark (sem Cloud
    // Function pra setar o claim).
    let role = (decoded.role as Role | undefined)
      ?? (decoded['role'] as Role | undefined);

    if (!role) {
      try {
        const snap = await getFirestore().doc(`users/${decoded.uid}`).get();
        const r = snap.exists ? (snap.data()?.role as string | undefined) : undefined;
        if (r === 'admin' || r === 'operador' || r === 'financeiro' || r === 'tecnico' || r === 'visualizador') {
          role = r;
        }
      } catch {
        // se o lookup falhar, segue como sem role e o gate abaixo decide
      }
    }

    if (opts?.roles && opts.roles.length > 0) {
      if (!role || !opts.roles.includes(role)) {
        res.status(403).json({ error: 'Insufficient role' });
        return null;
      }
    }

    return { uid: decoded.uid, email: decoded.email, role };
  } catch (err: any) {
    // log no servidor pra diagnosticar (sem vazar pro cliente)
    console.error('[requireAuth] verifyIdToken failed:', err?.code, err?.message);
    res.status(401).json({ error: 'Invalid token' });
    return null;
  }
}
