/**
 * Script para criar os usuários de teste E2E no Firebase.
 * Roda uma única vez. Pode ser re-executado sem problemas (pula usuários existentes).
 *
 * Uso:
 *   node scripts/create-test-users.mjs
 */

import { initializeApp } from 'firebase/app';
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
} from 'firebase/auth';
import { getFirestore, doc, setDoc, serverTimestamp } from 'firebase/firestore';

// ─── Config ───────────────────────────────────────────────────────────────────
const firebaseConfig = {
  apiKey: 'AIzaSyBxo0CPdArA-fjro3jDs-p5ISdpR8zwA-M',
  authDomain: 'wt-servicos-app.firebaseapp.com',
  projectId: 'wt-servicos-app',
  storageBucket: 'wt-servicos-app.appspot.com',
  messagingSenderId: '659868807853',
  appId: '1:659868807853:web:322e102bba5158c2c1cc24',
};

// ─── Usuários a criar ─────────────────────────────────────────────────────────
const USERS = [
  { email: 'admin.e2e@wt-teste.com',      password: 'Teste@E2E!2024', role: 'admin',      nome: 'Admin E2E'      },
  { email: 'tecnico.e2e@wt-teste.com',    password: 'Teste@E2E!2024', role: 'tecnico',    nome: 'Técnico E2E'    },
  { email: 'operador.e2e@wt-teste.com',   password: 'Teste@E2E!2024', role: 'operador',   nome: 'Operador E2E'   },
  { email: 'financeiro.e2e@wt-teste.com', password: 'Teste@E2E!2024', role: 'financeiro', nome: 'Financeiro E2E' },
];

// ─── Marca email como verificado via Identity Toolkit REST API ────────────────
async function markEmailVerified(idToken, apiKey) {
  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:update?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken, emailVerified: true, returnSecureToken: false }),
    }
  );
  if (!res.ok) {
    const err = await res.json();
    throw new Error(`markEmailVerified failed: ${JSON.stringify(err)}`);
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────
const app  = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db   = getFirestore(app);

async function createOrGetUser(email, password) {
  try {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    return { uid: cred.user.uid, idToken: await cred.user.getIdToken(), created: true };
  } catch (err) {
    if (err.code === 'auth/email-already-in-use') {
      const cred = await signInWithEmailAndPassword(auth, email, password);
      return { uid: cred.user.uid, idToken: await cred.user.getIdToken(), created: false };
    }
    throw err;
  }
}

async function writeProfile(uid, { email, role, nome }) {
  await setDoc(
    doc(db, 'users', uid),
    { email, nome, role, createdAt: serverTimestamp(), _e2e: true },
    { merge: true }
  );
}

console.log('\n🚀 Criando usuários de teste E2E...\n');

for (const user of USERS) {
  try {
    const { uid, idToken, created } = await createOrGetUser(user.email, user.password);
    await writeProfile(uid, user);
    await markEmailVerified(idToken, firebaseConfig.apiKey);

    const status = created ? '✅ criado' : '♻️  já existia (atualizado)';
    console.log(`${status}  ${user.email}  [${user.role}]  emailVerified=true`);
  } catch (err) {
    console.error(`❌ Erro em ${user.email}:`, err.message);
  }
}

console.log('\n✅ Concluído! Credenciais para o .env.test:\n');
console.log('TEST_ADMIN_EMAIL=admin.e2e@wt-teste.com');
console.log('TEST_ADMIN_PASSWORD=Teste@E2E!2024');
console.log('TEST_TECNICO_EMAIL=tecnico.e2e@wt-teste.com');
console.log('TEST_TECNICO_PASSWORD=Teste@E2E!2024');
console.log();

process.exit(0);
