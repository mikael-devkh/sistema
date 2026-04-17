export type PagamentoStatus = 'pendente' | 'pago' | 'cancelado';

export interface PagamentoChamadoDetalhe {
  serviceReportId: string;
  fsa: string;
  codigoLoja: string;
  durationMinutes: number;
  catalogoServicoId?: string;
  catalogoServicoNome?: string;
  pecaUsada?: string;
  custoPeca?: number;
  fornecedorPeca?: string;
  /** Valor calculado para este chamado (custo técnico, inclui horas extras) */
  valorChamado: number;
  /** Verdadeiro se é chamado adicional no lote da mesma loja */
  isAdicional: boolean;
  /** Reembolso de peça incluído */
  reembolsoPeca: number;
  /** Link da plataforma do cliente para referência */
  linkPlataforma?: string;
  /** Horas além da franquia contratada */
  horasExtras?: number;
  /** Valor das horas extras cobrado */
  valorHorasExtras?: number;
}

export interface Pagamento {
  id: string;
  tecnicoId: string;       // userId / Firebase Auth UID
  tecnicoNome: string;
  status: PagamentoStatus;
  /** Valor total a pagar ao técnico */
  valor: number;
  /** IDs dos serviceReports incluídos */
  chamadoIds: string[];
  periodo: {
    de: string;   // YYYY-MM-DD
    ate: string;
  };
  criadoPor: string;
  criadoEm: number;
  pagoEm?: number;
  observacoes?: string;
  detalhesChamados: PagamentoChamadoDetalhe[];
}

/** Prévia calculada antes de confirmar a geração do pagamento */
export interface PagamentoPreview {
  tecnicoId: string;
  tecnicoNome: string;
  valorTotal: number;
  qtdChamados: number;
  detalhesChamados: PagamentoChamadoDetalhe[];
}
