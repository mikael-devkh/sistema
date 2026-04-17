import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  getDocs,
  getDoc,
  query,
  orderBy,
  where,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import { db } from '../firebase';
import type { Cliente, CatalogoServico } from '../types/catalogo';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function tsToMs(val: unknown): number | undefined {
  if (!val) return undefined;
  if (val instanceof Timestamp) return val.toMillis();
  if (typeof val === 'number') return val;
  return undefined;
}

// ─── Clientes ─────────────────────────────────────────────────────────────────

const CLIENTES_COL = 'clientes';

export async function listClientes(apenasAtivos = false): Promise<Cliente[]> {
  const col = collection(db, CLIENTES_COL);
  const constraints = apenasAtivos
    ? [where('ativo', '==', true), orderBy('nome')]
    : [orderBy('nome')];
  const snap = await getDocs(query(col, ...constraints));
  return snap.docs.map(d => {
    const data = d.data();
    return {
      id: d.id,
      nome: data.nome ?? '',
      ativo: data.ativo ?? true,
      criadoEm: tsToMs(data.criadoEm),
      atualizadoEm: tsToMs(data.atualizadoEm),
    } satisfies Cliente;
  });
}

export async function createCliente(payload: Omit<Cliente, 'id' | 'criadoEm' | 'atualizadoEm'>): Promise<Cliente> {
  const ref = await addDoc(collection(db, CLIENTES_COL), {
    ...payload,
    criadoEm: serverTimestamp(),
    atualizadoEm: serverTimestamp(),
  });
  const snap = await getDoc(ref);
  const data = snap.data()!;
  return {
    id: ref.id,
    nome: data.nome,
    ativo: data.ativo,
    criadoEm: Date.now(),
    atualizadoEm: Date.now(),
  };
}

export async function updateCliente(id: string, payload: Partial<Omit<Cliente, 'id' | 'criadoEm'>>): Promise<void> {
  await updateDoc(doc(db, CLIENTES_COL, id), {
    ...payload,
    atualizadoEm: serverTimestamp(),
  });
}

export async function deleteCliente(id: string): Promise<void> {
  await deleteDoc(doc(db, CLIENTES_COL, id));
}

// ─── Catálogo de Serviços ─────────────────────────────────────────────────────

const CATALOGO_COL = 'catalogoServicos';

export async function listCatalogoServicos(clienteId?: string): Promise<CatalogoServico[]> {
  const col = collection(db, CATALOGO_COL);
  const constraints = clienteId
    ? [where('clienteId', '==', clienteId), orderBy('nome')]
    : [orderBy('nome')];
  const snap = await getDocs(query(col, ...constraints));
  return snap.docs.map(d => {
    const data = d.data();
    return {
      id: d.id,
      clienteId: data.clienteId ?? '',
      clienteNome: data.clienteNome ?? '',
      nome: data.nome ?? '',
      valorReceita: data.valorReceita ?? 0,
      valorAdicionalReceita: data.valorAdicionalReceita ?? 0,
      valorHoraAdicionalReceita: data.valorHoraAdicionalReceita ?? 0,
      valorCustoTecnico: data.valorCustoTecnico ?? 0,
      valorAdicionalCusto: data.valorAdicionalCusto ?? 0,
      valorHoraAdicionalCusto: data.valorHoraAdicionalCusto ?? 0,
      exigePeca: data.exigePeca ?? false,
      pagaTecnico: data.pagaTecnico ?? true,
      pagamentoIntegral: data.pagamentoIntegral ?? false,
      isRetorno: data.isRetorno ?? false,
      horasFranquia: data.horasFranquia ?? 2,
      criadoEm: tsToMs(data.criadoEm),
      atualizadoEm: tsToMs(data.atualizadoEm),
    } satisfies CatalogoServico;
  });
}

export async function createCatalogoServico(
  payload: Omit<CatalogoServico, 'id' | 'criadoEm' | 'atualizadoEm'>
): Promise<CatalogoServico> {
  const ref = await addDoc(collection(db, CATALOGO_COL), {
    ...payload,
    criadoEm: serverTimestamp(),
    atualizadoEm: serverTimestamp(),
  });
  return { id: ref.id, ...payload, criadoEm: Date.now(), atualizadoEm: Date.now() };
}

export async function updateCatalogoServico(
  id: string,
  payload: Partial<Omit<CatalogoServico, 'id' | 'criadoEm'>>
): Promise<void> {
  await updateDoc(doc(db, CATALOGO_COL, id), {
    ...payload,
    atualizadoEm: serverTimestamp(),
  });
}

export async function deleteCatalogoServico(id: string): Promise<void> {
  await deleteDoc(doc(db, CATALOGO_COL, id));
}
