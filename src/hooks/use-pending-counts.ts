import { useEffect, useState } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../firebase';

export interface PendingCounts {
  chamadosValidacaoOp: number;     // status 'submetido'
  chamadosValidacaoFin: number;    // status 'validado_operador'
  chamadosRejeitados: number;      // status rejeitado/rejeitado_operacional/rejeitado_financeiro
  chamadosAprovados: number;       // status 'validado_financeiro' (prontos p/ pagamento)
  pagamentosPendentes: number;     // status 'pendente'
  estoqueBaixo: number;            // quantidadeAtual <= quantidadeMinima
}

const INITIAL: PendingCounts = {
  chamadosValidacaoOp: 0,
  chamadosValidacaoFin: 0,
  chamadosRejeitados: 0,
  chamadosAprovados: 0,
  pagamentosPendentes: 0,
  estoqueBaixo: 0,
};

const CHAMADOS_PENDING_STATUSES = [
  'submetido',
  'validado_operador',
  'rejeitado',
  'rejeitado_operacional',
  'rejeitado_financeiro',
  'validado_financeiro',
] as const;

export function usePendingCounts(enabled = true): PendingCounts {
  const [counts, setCounts] = useState<PendingCounts>(INITIAL);

  useEffect(() => {
    if (!enabled) return;

    const unsubs: Array<() => void> = [];

    // Single listener for all 4 active chamado statuses (was 4 separate listeners)
    try {
      unsubs.push(onSnapshot(
        query(collection(db, 'chamados'), where('status', 'in', CHAMADOS_PENDING_STATUSES)),
        snap => {
          const next = { chamadosValidacaoOp: 0, chamadosValidacaoFin: 0, chamadosRejeitados: 0, chamadosAprovados: 0 };
          snap.forEach(d => {
            const s = (d.data() as { status?: string }).status;
            if (s === 'submetido') next.chamadosValidacaoOp++;
            else if (s === 'validado_operador') next.chamadosValidacaoFin++;
            else if (s === 'rejeitado' || s === 'rejeitado_operacional' || s === 'rejeitado_financeiro') next.chamadosRejeitados++;
            else if (s === 'validado_financeiro') next.chamadosAprovados++;
          });
          setCounts(c => ({ ...c, ...next }));
        },
        (err) => console.warn('[pending-counts]', err.code, err.message),
      ));
    } catch {}

    // Pagamentos pendentes
    try {
      unsubs.push(onSnapshot(
        query(collection(db, 'pagamentos'), where('status', '==', 'pendente')),
        snap => setCounts(c => ({ ...c, pagamentosPendentes: snap.size })),
        (err) => console.warn('[pending-counts]', err.code, err.message),
      ));
    } catch {}

    // Estoque — itens abaixo do mínimo (no Firestore operator for this comparison)
    try {
      unsubs.push(onSnapshot(
        collection(db, 'estoqueItens'),
        snap => {
          let low = 0;
          snap.forEach(d => {
            const data = d.data() as { quantidadeAtual?: number; quantidadeMinima?: number };
            const atual = data.quantidadeAtual ?? 0;
            const minimo = data.quantidadeMinima ?? 0;
            if (minimo > 0 && atual <= minimo) low++;
          });
          setCounts(c => ({ ...c, estoqueBaixo: low }));
        },
        (err) => console.warn('[pending-counts]', err.code, err.message),
      ));
    } catch {}

    return () => { unsubs.forEach(u => u()); };
  }, [enabled]);

  return counts;
}
