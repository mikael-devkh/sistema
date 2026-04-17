import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  getDocs,
  query,
  orderBy,
  where,
  runTransaction,
  serverTimestamp,
  Timestamp,
  limit,
} from 'firebase/firestore';
import { db } from '../firebase';
import type { EstoqueItem, MovimentoEstoque, MovimentoTipo } from '../types/estoque';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function tsToMs(val: unknown): number {
  if (!val) return Date.now();
  if (val instanceof Timestamp) return val.toMillis();
  if (typeof val === 'number') return val;
  return Date.now();
}

const ITENS_COL      = 'estoqueItens';
const MOVIMENTOS_COL = 'movimentosEstoque';

function mapItem(d: any): EstoqueItem {
  const data = d.data();
  return {
    id:                d.id,
    nome:              data.nome              ?? '',
    descricao:         data.descricao         ?? undefined,
    unidade:           data.unidade           ?? 'un',
    quantidadeAtual:   data.quantidadeAtual   ?? 0,
    quantidadeMinima:  data.quantidadeMinima  ?? 0,
    criadoPor:         data.criadoPor         ?? '',
    criadoEm:          tsToMs(data.criadoEm),
    atualizadoEm:      tsToMs(data.atualizadoEm),
  };
}

function mapMovimento(d: any): MovimentoEstoque {
  const data = d.data();
  return {
    id:               d.id,
    itemId:           data.itemId           ?? '',
    itemNome:         data.itemNome         ?? '',
    tipo:             data.tipo             ?? 'entrada',
    quantidade:       data.quantidade       ?? 0,
    saldoApos:        data.saldoApos        ?? 0,
    chamadoId:        data.chamadoId        ?? undefined,
    chamadoFsa:       data.chamadoFsa       ?? undefined,
    tecnicoId:        data.tecnicoId        ?? undefined,
    tecnicoNome:      data.tecnicoNome      ?? undefined,
    observacao:       data.observacao       ?? undefined,
    registradoPor:    data.registradoPor    ?? '',
    registradoPorNome:data.registradoPorNome ?? '',
    registradoEm:     tsToMs(data.registradoEm),
  };
}

// ─── EstoqueItem CRUD ─────────────────────────────────────────────────────────

export async function listEstoqueItens(): Promise<EstoqueItem[]> {
  const snap = await getDocs(
    query(collection(db, ITENS_COL), orderBy('nome', 'asc')),
  );
  return snap.docs.map(mapItem);
}

export async function createEstoqueItem(
  payload: Omit<EstoqueItem, 'id' | 'quantidadeAtual' | 'criadoEm' | 'atualizadoEm'>,
): Promise<EstoqueItem> {
  const ref = await addDoc(collection(db, ITENS_COL), {
    ...payload,
    quantidadeAtual: 0,
    criadoEm:    serverTimestamp(),
    atualizadoEm: serverTimestamp(),
  });
  const snap = await getDocs(query(collection(db, ITENS_COL), where('__name__', '==', ref.id)));
  return mapItem(snap.docs[0]);
}

export async function updateEstoqueItem(
  id: string,
  payload: Partial<Pick<EstoqueItem, 'nome' | 'descricao' | 'unidade' | 'quantidadeMinima'>>,
): Promise<void> {
  await updateDoc(doc(db, ITENS_COL, id), {
    ...payload,
    atualizadoEm: serverTimestamp(),
  });
}

export async function deleteEstoqueItem(id: string): Promise<void> {
  // Verifica se há movimentos antes de deletar
  const snap = await getDocs(
    query(collection(db, MOVIMENTOS_COL), where('itemId', '==', id), limit(1)),
  );
  if (!snap.empty) throw new Error('Não é possível excluir um item com movimentos registrados.');
  await deleteDoc(doc(db, ITENS_COL, id));
}

// ─── Movimentos ───────────────────────────────────────────────────────────────

export interface NovoMovimentoPayload {
  itemId: string;
  tipo: MovimentoTipo;
  quantidade: number;
  chamadoId?: string;
  chamadoFsa?: string;
  tecnicoId?: string;
  tecnicoNome?: string;
  observacao?: string;
  registradoPor: string;
  registradoPorNome: string;
}

/**
 * Registra entrada ou saída de forma atômica:
 * atualiza quantidadeAtual do item e cria o documento de movimento.
 * Lança erro se saída deixaria estoque negativo.
 */
export async function registrarMovimento(payload: NovoMovimentoPayload): Promise<void> {
  const itemRef = doc(db, ITENS_COL, payload.itemId);

  await runTransaction(db, async tx => {
    const itemSnap = await tx.get(itemRef);
    if (!itemSnap.exists()) throw new Error('Item de estoque não encontrado.');

    const atual: number = itemSnap.data().quantidadeAtual ?? 0;
    const nome: string  = itemSnap.data().nome ?? '';

    const delta   = payload.tipo === 'entrada' ? payload.quantidade : -payload.quantidade;
    const saldoApos = atual + delta;

    if (saldoApos < 0) {
      throw new Error(
        `Estoque insuficiente para "${nome}". Disponível: ${atual}, solicitado: ${payload.quantidade}.`,
      );
    }

    tx.update(itemRef, {
      quantidadeAtual: saldoApos,
      atualizadoEm: serverTimestamp(),
    });

    const movRef = doc(collection(db, MOVIMENTOS_COL));
    tx.set(movRef, {
      itemId:            payload.itemId,
      itemNome:          nome,
      tipo:              payload.tipo,
      quantidade:        payload.quantidade,
      saldoApos,
      chamadoId:         payload.chamadoId         ?? null,
      chamadoFsa:        payload.chamadoFsa         ?? null,
      tecnicoId:         payload.tecnicoId          ?? null,
      tecnicoNome:       payload.tecnicoNome        ?? null,
      observacao:        payload.observacao         ?? null,
      registradoPor:     payload.registradoPor,
      registradoPorNome: payload.registradoPorNome,
      registradoEm:      serverTimestamp(),
    });
  });
}

export async function listMovimentos(filters?: {
  itemId?: string;
  limitCount?: number;
}): Promise<MovimentoEstoque[]> {
  const constraints: any[] = [orderBy('registradoEm', 'desc')];
  if (filters?.itemId) constraints.unshift(where('itemId', '==', filters.itemId));
  if (filters?.limitCount) constraints.push(limit(filters.limitCount));

  const snap = await getDocs(query(collection(db, MOVIMENTOS_COL), ...constraints));
  return snap.docs.map(mapMovimento);
}
