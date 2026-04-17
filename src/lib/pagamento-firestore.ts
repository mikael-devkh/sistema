import {
  collection,
  doc,
  addDoc,
  updateDoc,
  getDocs,
  query,
  orderBy,
  where,
  writeBatch,
  serverTimestamp,
  Timestamp,
  limit,
} from 'firebase/firestore';
import { db } from '../firebase';
import type { Pagamento, PagamentoPreview } from '../types/pagamento';
import type { CatalogoServico } from '../types/catalogo';
import { fetchChamadosParaPagamento } from './chamado-firestore';
import { calcularDetalhesDeChamados } from './pagamento-calc';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function tsToMs(val: unknown): number | undefined {
  if (!val) return undefined;
  if (val instanceof Timestamp) return val.toMillis();
  if (typeof val === 'number') return val;
  return undefined;
}

const PAGAMENTOS_COL = 'pagamentos';
const CHAMADOS_COL = 'chamados';

import type { Chamado } from '../types/chamado';

// ─── Gerar prévia ─────────────────────────────────────────────────────────────

export async function gerarPreviewPagamentos(
  de: string,
  ate: string,
  catalogoServicos: CatalogoServico[],
  _nomesTecnicos?: Map<string, string>,
): Promise<PagamentoPreview[]> {
  const chamados = await fetchChamadosParaPagamento(de, ate);
  const catalogoMap = new Map(catalogoServicos.map(s => [s.id, s]));

  const byTecnico = new Map<string, Chamado[]>();
  for (const c of chamados) {
    if (!byTecnico.has(c.tecnicoId)) byTecnico.set(c.tecnicoId, []);
    byTecnico.get(c.tecnicoId)!.push(c);
  }

  const previews: PagamentoPreview[] = [];
  byTecnico.forEach((chamadosDoTec, tecnicoId) => {
    const detalhes = calcularDetalhesDeChamados(chamadosDoTec, catalogoMap);
    const valorTotal = detalhes.reduce((sum, d) => sum + d.valorChamado + d.reembolsoPeca, 0);
    previews.push({
      tecnicoId,
      tecnicoNome: chamadosDoTec[0]?.tecnicoNome ?? tecnicoId,
      valorTotal,
      qtdChamados: chamadosDoTec.length,
      detalhesChamados: detalhes,
    });
  });

  return previews.sort((a, b) => b.valorTotal - a.valorTotal);
}

// ─── Confirmar pagamento ──────────────────────────────────────────────────────

export async function confirmarPagamentos(
  previews: PagamentoPreview[],
  periodo: { de: string; ate: string },
  criadoPor: string,
): Promise<void> {
  const batch = writeBatch(db);

  for (const preview of previews) {
    if (preview.detalhesChamados.length === 0) continue;

    const pagRef = doc(collection(db, PAGAMENTOS_COL));
    const chamadoIds = preview.detalhesChamados.map(d => d.serviceReportId);

    batch.set(pagRef, {
      tecnicoId: preview.tecnicoId,
      tecnicoNome: preview.tecnicoNome,
      status: 'pendente',
      valor: preview.valorTotal,
      chamadoIds,
      periodo,
      criadoPor,
      criadoEm: serverTimestamp(),
      pagoEm: null,
      observacoes: null,
      detalhesChamados: preview.detalhesChamados,
    });

    // Marcar cada chamado como incluído neste pagamento e atualizar status para "pago"
    for (const id of chamadoIds) {
      batch.update(doc(db, CHAMADOS_COL, id), {
        pagamentoId: pagRef.id,
        status: 'pago',
      });
    }
  }

  await batch.commit();
}

// ─── CRUD de pagamentos ───────────────────────────────────────────────────────

export async function listPagamentos(tecnicoId?: string): Promise<Pagamento[]> {
  const col = collection(db, PAGAMENTOS_COL);
  const constraints: any[] = [orderBy('criadoEm', 'desc')];
  if (tecnicoId) constraints.unshift(where('tecnicoId', '==', tecnicoId));
  const snap = await getDocs(query(col, ...constraints));

  return snap.docs.map(d => {
    const data = d.data();
    return {
      id: d.id,
      tecnicoId: data.tecnicoId ?? '',
      tecnicoNome: data.tecnicoNome ?? '',
      status: data.status ?? 'pendente',
      valor: data.valor ?? 0,
      chamadoIds: data.chamadoIds ?? [],
      periodo: data.periodo ?? { de: '', ate: '' },
      criadoPor: data.criadoPor ?? '',
      criadoEm: tsToMs(data.criadoEm) ?? Date.now(),
      pagoEm: tsToMs(data.pagoEm),
      observacoes: data.observacoes ?? undefined,
      detalhesChamados: data.detalhesChamados ?? [],
    } satisfies Pagamento;
  });
}

export async function marcarComoPago(id: string, observacoes?: string): Promise<void> {
  await updateDoc(doc(db, PAGAMENTOS_COL, id), {
    status: 'pago',
    pagoEm: serverTimestamp(),
    observacoes: observacoes ?? null,
  });
}

export async function cancelarPagamento(id: string, pagamento: Pagamento): Promise<void> {
  const batch = writeBatch(db);

  batch.update(doc(db, PAGAMENTOS_COL, id), { status: 'cancelado' });

  // Libera os chamados e reverte status para validado_financeiro
  for (const chamadoId of pagamento.chamadoIds) {
    batch.update(doc(db, CHAMADOS_COL, chamadoId), {
      pagamentoId: null,
      status: 'validado_financeiro',
    });
  }

  await batch.commit();
}
