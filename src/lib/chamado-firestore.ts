import {
  collection,
  doc,
  updateDoc,
  getDocs,
  getDoc,
  query,
  orderBy,
  where,
  serverTimestamp,
  Timestamp,
  limit,
  runTransaction,
} from 'firebase/firestore';
import { db } from '../firebase';
import type { Chamado, ChamadoStatus, HistoricoEntry } from '../types/chamado';
import {
  assertChamadoPayload,
  assertChamadoTransition,
  buildChamadoIdempotencyKey,
  normalizeChamadoCode,
} from './chamado-validation';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function tsToMs(val: unknown): number {
  if (!val) return Date.now();
  if (val instanceof Timestamp) return val.toMillis();
  if (typeof val === 'number') return val;
  return Date.now();
}

function mapDoc(d: any): Chamado {
  const data = d.data();
  return {
    id: d.id,
    fsa: data.fsa ?? '',
    codigoLoja: data.codigoLoja ?? '',
    tecnicoId: data.tecnicoId ?? '',
    tecnicoNome: data.tecnicoNome ?? '',
    tecnicoCodigo: data.tecnicoCodigo ?? undefined,
    tecnicoPaiId: data.tecnicoPaiId ?? undefined,
    tecnicoPaiCodigo: data.tecnicoPaiCodigo ?? undefined,
    pagamentoDestino: data.pagamentoDestino ?? undefined,
    catalogoServicoId: data.catalogoServicoId ?? undefined,
    catalogoServicoNome: data.catalogoServicoNome ?? undefined,
    dataAtendimento: data.dataAtendimento ?? '',
    horaInicio: data.horaInicio ?? undefined,
    horaFim: data.horaFim ?? undefined,
    durationMinutes: data.durationMinutes ?? undefined,
    itensAdicionais: data.itensAdicionais ?? undefined,
    pecaUsada: data.pecaUsada ?? undefined,
    custoPeca: data.custoPeca ?? undefined,
    fornecedorPeca: data.fornecedorPeca ?? undefined,
    estoqueItemId: data.estoqueItemId ?? undefined,
    estoqueItemNome: data.estoqueItemNome ?? undefined,
    estoqueQuantidade: data.estoqueQuantidade ?? undefined,
    estoqueBaixadoEm: data.estoqueBaixadoEm ? tsToMs(data.estoqueBaixadoEm) : undefined,
    estoqueBaixadoPor: data.estoqueBaixadoPor ?? undefined,
    estoqueBaixadoPorNome: data.estoqueBaixadoPorNome ?? undefined,
    linkPlataforma: data.linkPlataforma ?? undefined,
    observacoes: data.observacoes ?? undefined,
    status: data.status ?? 'rascunho',
    historico: data.historico ?? [],
    motivoRejeicao: data.motivoRejeicao ?? undefined,
    motivoRejeicaoEtapa: data.motivoRejeicaoEtapa ?? undefined,
    pagamentoId: data.pagamentoId ?? null,
    emRevisaoPor: data.emRevisaoPor ?? undefined,
    emRevisaoPorNome: data.emRevisaoPorNome ?? undefined,
    emRevisaoDesde: data.emRevisaoDesde ?? undefined,
    registradoPor: data.registradoPor ?? '',
    registradoPorNome: data.registradoPorNome ?? '',
    registradoEm: tsToMs(data.registradoEm),
    atualizadoEm: tsToMs(data.atualizadoEm),
  };
}

const COL = 'chamados';
const IDEMPOTENCY_COL = 'chamadoIdempotency';

// ─── CRUD ─────────────────────────────────────────────────────────────────────

export type NovoChamadoPayload = Omit<
  Chamado,
  'id' | 'status' | 'historico' | 'pagamentoId' | 'registradoEm' | 'atualizadoEm' | 'motivoRejeicao'
>;

export async function createChamado(
  payload: NovoChamadoPayload,
  submitImediato = false,
): Promise<Chamado> {
  assertChamadoPayload(payload);

  const status: ChamadoStatus = submitImediato ? 'submetido' : 'rascunho';
  const entrada: HistoricoEntry = {
    status,
    por: payload.registradoPor,
    porNome: payload.registradoPorNome,
    em: Date.now(),
    observacao: submitImediato ? 'Chamado registrado e submetido' : 'Rascunho criado',
  };

  const normalizedPayload = {
    ...payload,
    fsa: normalizeChamadoCode(payload.fsa),
    codigoLoja: payload.codigoLoja.trim(),
    itensAdicionais: payload.itensAdicionais?.map(item => ({
      ...item,
      codigoChamado: normalizeChamadoCode(item.codigoChamado),
      codigoLoja: item.codigoLoja.trim(),
    })),
  };
  const idempotencyKey = buildChamadoIdempotencyKey(normalizedPayload);
  const idemRef = doc(db, IDEMPOTENCY_COL, encodeURIComponent(idempotencyKey));

  const ref = await runTransaction(db, async tx => {
    const existing = await tx.get(idemRef);
    if (existing.exists()) {
      const chamadoId = existing.data().chamadoId as string | undefined;
      if (chamadoId) return doc(db, COL, chamadoId);
    }

    const newRef = doc(collection(db, COL));
    tx.set(newRef, {
      ...normalizedPayload,
      status,
      historico: [entrada],
      pagamentoId: null,
      motivoRejeicao: null,
      registradoEm: serverTimestamp(),
      atualizadoEm: serverTimestamp(),
    });
    tx.set(idemRef, {
      chamadoId: newRef.id,
      key: idempotencyKey,
      criadoEm: serverTimestamp(),
      criadoPor: payload.registradoPor,
    });
    return newRef;
  });

  const snap = await getDoc(ref);
  return mapDoc(snap);
}

export async function updateChamado(
  id: string,
  payload: Partial<Omit<Chamado, 'id' | 'historico' | 'registradoEm'>>,
): Promise<void> {
  await updateDoc(doc(db, COL, id), {
    ...payload,
    atualizadoEm: serverTimestamp(),
  });
}

export async function listChamados(filters?: {
  status?: ChamadoStatus;
  tecnicoId?: string;
  de?: string;
  ate?: string;
  limitCount?: number;
}): Promise<Chamado[]> {
  const hasFilter = filters?.status || filters?.tecnicoId;

  // Quando há filtros (where) + orderBy no mesmo campo diferente, o Firestore
  // exige índice composto. Para evitar erro enquanto o índice não está criado,
  // fazemos a ordenação no cliente.
  const constraints: any[] = [];

  if (filters?.status)   constraints.push(where('status',    '==', filters.status));
  if (filters?.tecnicoId) constraints.push(where('tecnicoId', '==', filters.tecnicoId));

  // Só adiciona orderBy se não há filtros (índice simples, sempre disponível)
  if (!hasFilter) constraints.push(orderBy('registradoEm', 'desc'));

  if (filters?.limitCount && !hasFilter) constraints.push(limit(filters.limitCount));

  try {
    const snap = await getDocs(query(collection(db, COL), ...constraints));
    let results = snap.docs.map(mapDoc);

    // Ordenação e filtros client-side
    results.sort((a, b) => b.registradoEm - a.registradoEm);

    if (filters?.limitCount) results = results.slice(0, filters.limitCount);

    if (filters?.de || filters?.ate) {
      results = results.filter(c => {
        if (filters.de && c.dataAtendimento < filters.de) return false;
        if (filters.ate && c.dataAtendimento > filters.ate) return false;
        return true;
      });
    }

    return results;
  } catch (err: any) {
    // Fallback: se ainda houver erro de índice, busca tudo e filtra no cliente
    if (err.code === 'failed-precondition' || err.message?.includes('index')) {
      console.warn('⚠️ Índice Firestore ausente, buscando todos e filtrando no cliente…');
      const snap = await getDocs(collection(db, COL));
      let results = snap.docs.map(mapDoc);

      if (filters?.status)    results = results.filter(c => c.status === filters.status);
      if (filters?.tecnicoId) results = results.filter(c => c.tecnicoId === filters.tecnicoId);
      if (filters?.de)        results = results.filter(c => c.dataAtendimento >= filters.de!);
      if (filters?.ate)       results = results.filter(c => c.dataAtendimento <= filters.ate!);

      results.sort((a, b) => b.registradoEm - a.registradoEm);
      if (filters?.limitCount) results = results.slice(0, filters.limitCount);
      return results;
    }
    throw err;
  }
}

export async function getChamado(id: string): Promise<Chamado | null> {
  const snap = await getDoc(doc(db, COL, id));
  if (!snap.exists()) return null;
  return mapDoc(snap);
}

// ─── Transições de status ─────────────────────────────────────────────────────

async function transicionar(
  id: string,
  novoStatus: ChamadoStatus,
  entrada: HistoricoEntry,
  extraFields?: Record<string, unknown>,
): Promise<void> {
  const ref = doc(db, COL, id);
  await runTransaction(db, async tx => {
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new Error('Chamado não encontrado');

    const chamado = mapDoc(snap);
    assertChamadoTransition(chamado.status, novoStatus);

    tx.update(ref, {
      status: novoStatus,
      historico: [...chamado.historico, entrada],
      motivoRejeicao: extraFields?.motivoRejeicao ?? chamado.motivoRejeicao ?? null,
      emRevisaoPor: null,
      emRevisaoPorNome: null,
      emRevisaoDesde: null,
      ...extraFields,
      atualizadoEm: serverTimestamp(),
    });
  });
}

/** Operador/Admin: submeter rascunho para fila de validação */
export async function submeterChamado(
  id: string,
  por: string,
  porNome: string,
): Promise<void> {
  await transicionar(id, 'submetido', {
    status: 'submetido',
    por,
    porNome,
    em: Date.now(),
    observacao: 'Submetido para validação de upload',
  });
}

/** Operador/Admin: validar upload (1ª etapa) */
export async function validarOperador(
  id: string,
  por: string,
  porNome: string,
  observacao?: string,
): Promise<void> {
  await transicionar(id, 'validado_operador', {
    status: 'validado_operador',
    por,
    porNome,
    em: Date.now(),
    observacao: observacao || 'Upload validado pelo operador',
  });
}

/** Financeiro/Admin: validar valores (2ª etapa) */
export async function validarFinanceiro(
  id: string,
  por: string,
  porNome: string,
  observacao?: string,
): Promise<void> {
  await transicionar(id, 'validado_financeiro', {
    status: 'validado_financeiro',
    por,
    porNome,
    em: Date.now(),
    observacao: observacao || 'Valores validados pelo financeiro',
  });
}

/** Qualquer validador: rejeitar */
export async function rejeitarChamado(
  id: string,
  por: string,
  porNome: string,
  motivo: string,
  etapa?: 'operacional' | 'financeira',
): Promise<void> {
  const novoStatus: ChamadoStatus = etapa === 'financeira'
    ? 'rejeitado_financeiro'
    : etapa === 'operacional'
      ? 'rejeitado_operacional'
      : 'rejeitado';

  await transicionar(
    id,
    novoStatus,
    { status: novoStatus, por, porNome, em: Date.now(), observacao: motivo },
    { motivoRejeicao: motivo, motivoRejeicaoEtapa: etapa ?? 'legado' },
  );
}

/** Operador: resubmeter chamado rejeitado após correção */
export async function resubmeterChamado(
  id: string,
  por: string,
  porNome: string,
  atualizacoes: Partial<Omit<Chamado, 'id' | 'historico' | 'status' | 'registradoEm'>>,
): Promise<void> {
  const entrada: HistoricoEntry = {
    status: 'submetido',
    por,
    porNome,
    em: Date.now(),
    observacao: 'Corrigido e resubmetido',
  };

  const ref = doc(db, COL, id);
  await runTransaction(db, async tx => {
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new Error('Chamado não encontrado');
    const chamado = mapDoc(snap);
    assertChamadoTransition(chamado.status, 'submetido');

    const next = { ...chamado, ...atualizacoes, status: 'submetido' as ChamadoStatus };
    assertChamadoPayload(next);

    tx.update(ref, {
      ...atualizacoes,
      fsa: next.fsa ? normalizeChamadoCode(next.fsa) : chamado.fsa,
      status: 'submetido',
      motivoRejeicao: null,
      motivoRejeicaoEtapa: null,
      historico: [...chamado.historico, entrada],
      emRevisaoPor: null,
      emRevisaoPorNome: null,
      emRevisaoDesde: null,
      atualizadoEm: serverTimestamp(),
    });
  });
}

// ─── Lock otimista de validação ───────────────────────────────────────────────

/** Marca o chamado como "em revisão" para evitar validação dupla */
export async function iniciarRevisao(id: string, por: string, porNome: string): Promise<void> {
  await updateDoc(doc(db, COL, id), {
    emRevisaoPor: por,
    emRevisaoPorNome: porNome,
    emRevisaoDesde: Date.now(),
    atualizadoEm: serverTimestamp(),
  });
}

/** Remove o lock de revisão ao fechar/finalizar */
export async function liberarRevisao(id: string): Promise<void> {
  await updateDoc(doc(db, COL, id), {
    emRevisaoPor: null,
    emRevisaoPorNome: null,
    emRevisaoDesde: null,
    atualizadoEm: serverTimestamp(),
  });
}

// ─── Verificação de duplicatas ────────────────────────────────────────────────

/** Retorna chamado existente com mesmo FSA + técnico + data (excluindo o próprio id) */
export async function checkDuplicateChamado(
  fsa: string,
  tecnicoId: string,
  dataAtendimento: string,
  excludeId?: string,
): Promise<Chamado | null> {
  const chamados = await searchChamadosByFsa(fsa);
  const dup = chamados.find(c =>
    c.tecnicoId === tecnicoId &&
    c.dataAtendimento === dataAtendimento &&
    c.id !== excludeId &&
    c.status !== 'rejeitado' &&
    c.status !== 'rejeitado_operacional' &&
    c.status !== 'rejeitado_financeiro',
  );
  return dup ?? null;
}

/** Busca chamados pelo número da FSA — exact match na coleção + prefix fallback */
export async function searchChamadosByFsa(fsa: string): Promise<Chamado[]> {
  const q = fsa.trim().toUpperCase();
  if (!q) return [];
  // Exact match (O(1) — covers the common case of full FSA codes like "WTS-1234")
  const exact = await getDocs(query(collection(db, COL), where('fsa', '==', q), orderBy('registradoEm', 'desc'), limit(50)));
  if (!exact.empty) return exact.docs.map(mapDoc);
  // Prefix range query for partial input (e.g. "WTS-12")
  const prefix = await getDocs(query(collection(db, COL), where('fsa', '>=', q), where('fsa', '<=', q + '\uf8ff'), orderBy('fsa'), limit(50)));
  return prefix.docs.map(mapDoc);
}

/** Lista todos os chamados de uma loja */
export async function listChamadosByLoja(codigoLoja: string): Promise<Chamado[]> {
  const snap = await getDocs(
    query(collection(db, COL), where('codigoLoja', '==', codigoLoja), orderBy('registradoEm', 'desc'), limit(100)),
  ).catch(async () => {
    // fallback se índice ausente
    const s = await getDocs(collection(db, COL));
    return { docs: s.docs.filter(d => d.data().codigoLoja === codigoLoja) };
  });
  return (snap as any).docs.map(mapDoc);
}

/** Busca chamados prontos para pagamento (validado_financeiro, sem pagamentoId) */
export async function fetchChamadosParaPagamento(
  de: string,
  ate: string,
  tecnicoId?: string,
): Promise<Chamado[]> {
  const constraints: any[] = [
    where('status', '==', 'validado_financeiro'),
    where('pagamentoId', '==', null),
    orderBy('dataAtendimento', 'desc'),
    limit(500),
  ];
  if (tecnicoId) constraints.unshift(where('tecnicoId', '==', tecnicoId));

  const snap = await getDocs(query(collection(db, COL), ...constraints));
  return snap.docs
    .map(mapDoc)
    .filter(c => c.dataAtendimento >= de && c.dataAtendimento <= ate);
}
