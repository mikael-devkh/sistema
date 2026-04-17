import { useEffect, useState } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../firebase';

export interface PendingCounts {
  chamadosValidacaoOp: number;     // status 'submetido'
  chamadosValidacaoFin: number;    // status 'validado_operador'
  chamadosRejeitados: number;      // status 'rejeitado'
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

/**
 * Assina em tempo real as contagens de itens pendentes em todas as áreas do
 * sistema para exibir badges na sidebar. Tolerante a falhas individuais de
 * coleções (ex.: usuário sem permissão em uma delas).
 */
export function usePendingCounts(enabled = true): PendingCounts {
  const [counts, setCounts] = useState<PendingCounts>(INITIAL);

  useEffect(() => {
    if (!enabled) return;

    const unsubs: Array<() => void> = [];

    // Chamados — ag. validação operador
    try {
      unsubs.push(onSnapshot(
        query(collection(db, 'chamados'), where('status', '==', 'submetido')),
        snap => setCounts(c => ({ ...c, chamadosValidacaoOp: snap.size })),
        () => {},
      ));
    } catch {}

    // Chamados — ag. validação financeiro
    try {
      unsubs.push(onSnapshot(
        query(collection(db, 'chamados'), where('status', '==', 'validado_operador')),
        snap => setCounts(c => ({ ...c, chamadosValidacaoFin: snap.size })),
        () => {},
      ));
    } catch {}

    // Chamados — rejeitados
    try {
      unsubs.push(onSnapshot(
        query(collection(db, 'chamados'), where('status', '==', 'rejeitado')),
        snap => setCounts(c => ({ ...c, chamadosRejeitados: snap.size })),
        () => {},
      ));
    } catch {}

    // Chamados — aprovados p/ pagamento
    try {
      unsubs.push(onSnapshot(
        query(collection(db, 'chamados'), where('status', '==', 'validado_financeiro')),
        snap => setCounts(c => ({ ...c, chamadosAprovados: snap.size })),
        () => {},
      ));
    } catch {}

    // Pagamentos pendentes
    try {
      unsubs.push(onSnapshot(
        query(collection(db, 'pagamentos'), where('status', '==', 'pendente')),
        snap => setCounts(c => ({ ...c, pagamentosPendentes: snap.size })),
        () => {},
      ));
    } catch {}

    // Estoque — itens abaixo do mínimo (filtro client-side)
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
        () => {},
      ));
    } catch {}

    return () => { unsubs.forEach(u => u()); };
  }, [enabled]);

  return counts;
}
