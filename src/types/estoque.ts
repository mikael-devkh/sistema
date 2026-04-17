export type MovimentoTipo = 'entrada' | 'saida';

export interface EstoqueItem {
  id: string;
  nome: string;
  descricao?: string;
  unidade: string;          // 'un', 'par', 'kg', 'metro', etc.
  quantidadeAtual: number;
  quantidadeMinima: number; // limiar de alerta de estoque baixo
  criadoPor: string;
  criadoEm: number;
  atualizadoEm: number;
}

export interface MovimentoEstoque {
  id: string;
  itemId: string;
  itemNome: string;
  tipo: MovimentoTipo;
  quantidade: number;
  /** Saldo após este movimento */
  saldoApos: number;
  chamadoId?: string;
  chamadoFsa?: string;
  tecnicoId?: string;
  tecnicoNome?: string;
  observacao?: string;
  registradoPor: string;
  registradoPorNome: string;
  registradoEm: number;
}
