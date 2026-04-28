import {
  collection,
  doc,
  getDocs,
  query,
  orderBy,
  where,
  serverTimestamp,
  Timestamp,
  runTransaction,
  type QueryConstraint,
} from 'firebase/firestore';
import { db } from '../firebase';
import type { Pagamento, PagamentoHistoricoEntry, PagamentoPreview } from '../types/pagamento';
import type { CatalogoServico } from '../types/catalogo';
import type { Chamado, HistoricoEntry } from '../types/chamado';
import { fetchChamadosParaPagamento } from './chamado-firestore';
import { calcularDetalhesDeChamados } from './pagamento-calc';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function tsToMs(val: unknown): number | undefined {
  if (!val) return undefined;
  if (val instanceof Timestamp) return val.toMillis();
  if (typeof val === 'number') return val;
  return undefined;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? value as Record<string, unknown> : {};
}

function mapHistoricoEntry(value: unknown): PagamentoHistoricoEntry {
  const entry = asRecord(value);
  const status = entry.status === 'pago' || entry.status === 'cancelado' ? entry.status : 'pendente';
  return {
    status,
    por: typeof entry.por === 'string' ? entry.por : '',
    porNome: typeof entry.porNome === 'string' ? entry.porNome : '',
    em: tsToMs(entry.em) ?? Date.now(),
    observacao: typeof entry.observacao === 'string' ? entry.observacao : undefined,
  };
}

const PAGAMENTOS_COL = 'pagamentos';
const CHAMADOS_COL = 'chamados';
const IDEMPOTENCY_COL = 'pagamentoIdempotency';

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
  criadoPorNome = 'Financeiro',
): Promise<void> {
  for (const preview of previews) {
    if (preview.detalhesChamados.length === 0) continue;

    await runTransaction(db, async tx => {
      const requestedIds = [...new Set(preview.detalhesChamados.map(d => d.serviceReportId))];
      const chamadoRefs = requestedIds.map(id => doc(db, CHAMADOS_COL, id));
      const chamadoSnaps = await Promise.all(chamadoRefs.map(ref => tx.get(ref)));

      const eligibleSnaps = chamadoSnaps
        .filter(snap => {
          const data = snap.data();
          return snap.exists() &&
            data?.tecnicoId === preview.tecnicoId &&
            data?.status === 'validado_financeiro' &&
            data?.pagamentoId == null;
        });
      const eligibleIds = eligibleSnaps.map(snap => snap.id).sort();

      if (eligibleIds.length === 0) return;

      const idempotencyKey = [
        preview.tecnicoId,
        periodo.de,
        periodo.ate,
        eligibleIds.join(','),
      ].join('|');
      const idemRef = doc(db, IDEMPOTENCY_COL, encodeURIComponent(idempotencyKey));
      const existing = await tx.get(idemRef);
      if (existing.exists()) return;

      const detalhes = preview.detalhesChamados.filter(d => eligibleIds.includes(d.serviceReportId));
      const valor = detalhes.reduce((sum, d) => sum + d.valorChamado + d.reembolsoPeca, 0);
      const pagRef = doc(collection(db, PAGAMENTOS_COL));
      const now = Date.now();
      const historico: PagamentoHistoricoEntry[] = [{
        status: 'pendente',
        por: criadoPor,
        porNome: criadoPorNome,
        em: now,
        observacao: 'Pagamento gerado pelo financeiro',
      }];
      const chamadoHistorico: HistoricoEntry = {
        status: 'pagamento_pendente',
        por: criadoPor,
        porNome: criadoPorNome,
        em: now,
        observacao: `Incluído no pagamento ${pagRef.id}`,
      };

      tx.set(pagRef, {
        tecnicoId: preview.tecnicoId,
        tecnicoNome: preview.tecnicoNome,
        status: 'pendente',
        valor,
        chamadoIds: eligibleIds,
        periodo,
        criadoPor,
        criadoEm: serverTimestamp(),
        pagoEm: null,
        observacoes: null,
        detalhesChamados: detalhes,
        historico,
      });

      tx.set(idemRef, {
        pagamentoId: pagRef.id,
        key: idempotencyKey,
        criadoEm: serverTimestamp(),
        criadoPor,
      });

      for (const snap of eligibleSnaps) {
        const data = snap.data();
        tx.update(doc(db, CHAMADOS_COL, snap.id), {
          pagamentoId: pagRef.id,
          status: 'pagamento_pendente',
          historico: [...(Array.isArray(data.historico) ? data.historico : []), chamadoHistorico],
          atualizadoEm: serverTimestamp(),
        });
      }
    });
  }
}

// ─── CRUD de pagamentos ───────────────────────────────────────────────────────

export async function listPagamentos(tecnicoId?: string): Promise<Pagamento[]> {
  const col = collection(db, PAGAMENTOS_COL);
  const constraints: QueryConstraint[] = [orderBy('criadoEm', 'desc')];
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
      pagoPor: data.pagoPor ?? undefined,
      pagoPorNome: data.pagoPorNome ?? undefined,
      comprovanteUrl: data.comprovanteUrl ?? undefined,
      observacoes: data.observacoes ?? undefined,
      detalhesChamados: data.detalhesChamados ?? [],
      historico: Array.isArray(data.historico) ? data.historico.map(mapHistoricoEntry) : [],
      canceladoPor: data.canceladoPor ?? undefined,
      canceladoPorNome: data.canceladoPorNome ?? undefined,
      canceladoEm: data.canceladoEm ?? undefined,
      motivoCancelamento: data.motivoCancelamento ?? undefined,
    } satisfies Pagamento;
  });
}

export async function marcarComoPago(
  id: string,
  observacoes?: string,
  pagoPor?: string,
  pagoPorNome?: string,
  comprovanteUrl?: string,
): Promise<void> {
  await runTransaction(db, async tx => {
    const pagRef = doc(db, PAGAMENTOS_COL, id);
    const snap = await tx.get(pagRef);
    if (!snap.exists()) throw new Error('Pagamento não encontrado');
    const data = snap.data();
    if (data.status === 'pago') return;
    if (data.status === 'cancelado') throw new Error('Pagamento cancelado não pode ser pago');
    const historico = Array.isArray(data.historico) ? data.historico : [];
    const chamadoIds = ((data.chamadoIds ?? []) as string[]);
    const chamadoRefs = chamadoIds.map(chamadoId => doc(db, CHAMADOS_COL, chamadoId));
    const chamadoSnaps = await Promise.all(chamadoRefs.map(ref => tx.get(ref)));
    const now = Date.now();

    tx.update(pagRef, {
      status: 'pago',
      pagoEm: serverTimestamp(),
      pagoPor: pagoPor ?? null,
      pagoPorNome: pagoPorNome ?? null,
      comprovanteUrl: comprovanteUrl?.trim() || null,
      observacoes: observacoes ?? null,
      historico: [
        ...historico,
        {
          status: 'pago',
          por: pagoPor ?? '',
          porNome: pagoPorNome ?? 'Financeiro',
          em: now,
          observacao: observacoes || (comprovanteUrl ? 'Pagamento confirmado com comprovante' : 'Pagamento confirmado'),
        } satisfies PagamentoHistoricoEntry,
      ],
    });

    for (const chamadoSnap of chamadoSnaps) {
      if (!chamadoSnap.exists()) continue;
      const chamadoData = chamadoSnap.data();
      const chamadoHistorico: HistoricoEntry = {
        status: 'pago',
        por: pagoPor ?? '',
        porNome: pagoPorNome ?? 'Financeiro',
        em: now,
        observacao: `Pagamento ${id} confirmado`,
      };
      tx.update(doc(db, CHAMADOS_COL, chamadoSnap.id), {
        status: 'pago',
        historico: [...(Array.isArray(chamadoData.historico) ? chamadoData.historico : []), chamadoHistorico],
        atualizadoEm: serverTimestamp(),
      });
    }
  });
}

export async function cancelarPagamento(
  id: string,
  pagamento: Pagamento,
  canceladoPor?: string,
  canceladoPorNome?: string,
  motivo?: string,
): Promise<void> {
  await runTransaction(db, async tx => {
    const pagRef = doc(db, PAGAMENTOS_COL, id);
    const snap = await tx.get(pagRef);
    if (!snap.exists()) throw new Error('Pagamento não encontrado');
    const data = snap.data();
    if (data.status === 'cancelado') return;
    if (data.status === 'pago') throw new Error('Pagamento pago não pode ser cancelado por este fluxo');
    const historico = Array.isArray(data.historico) ? data.historico : [];
    const chamadoIds = ((data.chamadoIds as string[] | undefined) ?? pagamento.chamadoIds);
    const chamadoRefs = chamadoIds.map(chamadoId => doc(db, CHAMADOS_COL, chamadoId));
    const chamadoSnaps = await Promise.all(chamadoRefs.map(ref => tx.get(ref)));
    const now = Date.now();

    tx.update(pagRef, {
      status: 'cancelado',
      canceladoPor: canceladoPor ?? null,
      canceladoPorNome: canceladoPorNome ?? null,
      canceladoEm: now,
      motivoCancelamento: motivo ?? null,
      historico: [
        ...historico,
        {
          status: 'cancelado',
          por: canceladoPor ?? '',
          porNome: canceladoPorNome ?? 'Financeiro',
          em: now,
          observacao: motivo || 'Pagamento cancelado',
        } satisfies PagamentoHistoricoEntry,
      ],
    });

    for (const chamadoSnap of chamadoSnaps) {
      if (!chamadoSnap.exists()) continue;
      const chamadoData = chamadoSnap.data();
      const chamadoHistorico: HistoricoEntry = {
        status: 'validado_financeiro',
        por: canceladoPor ?? '',
        porNome: canceladoPorNome ?? 'Financeiro',
        em: now,
        observacao: motivo ? `Pagamento ${id} cancelado: ${motivo}` : `Pagamento ${id} cancelado`,
      };
      tx.update(doc(db, CHAMADOS_COL, chamadoSnap.id), {
        pagamentoId: null,
        status: 'validado_financeiro',
        historico: [...(Array.isArray(chamadoData.historico) ? chamadoData.historico : []), chamadoHistorico],
        atualizadoEm: serverTimestamp(),
      });
    }
  });
}
