export type ChamadoStatus =
  | 'rascunho'
  | 'submetido'
  | 'validado_operador'
  | 'rejeitado'
  | 'validado_financeiro'
  | 'pago';

export interface HistoricoEntry {
  status: ChamadoStatus;
  por: string;      // UID
  porNome: string;
  em: number;       // timestamp ms
  observacao?: string;
}

/**
 * Um item adicional dentro de um lote de chamados.
 * O chamado principal tem seus campos no nível raiz do documento;
 * os demais itens ficam aqui.
 */
export interface LoteItem {
  codigoChamado: string;   // o código do chamado deste ativo (equivalente ao campo fsa do principal)
  codigoLoja: string;
  catalogoServicoId?: string;
  catalogoServicoNome?: string;
}

export interface Chamado {
  id: string;
  // Identificação — campo "fsa" mantido no Firestore por compatibilidade;
  // exibido no sistema como "Código de Chamado"
  fsa: string;
  codigoLoja: string;
  // Lote: itens adicionais além do chamado principal
  itensAdicionais?: LoteItem[];
  // Técnico (selecionado da lista)
  tecnicoId: string;
  tecnicoNome: string;
  tecnicoCodigo?: string;       // Código denominador (ex: TEC-001) — usado em RATs e pagamentos
  tecnicoPaiId?: string;        // Se subcontratado, UID do técnico pai
  tecnicoPaiCodigo?: string;    // Código do técnico pai
  pagamentoDestino?: 'self' | 'parent'; // Para quem vai o pagamento deste chamado
  // Serviço (do item principal)
  catalogoServicoId?: string;
  catalogoServicoNome?: string;
  // Período
  dataAtendimento: string;   // YYYY-MM-DD
  horaInicio?: string;       // HH:MM
  horaFim?: string;          // HH:MM
  durationMinutes?: number;
  // Peça
  pecaUsada?: string;
  custoPeca?: number;
  fornecedorPeca?: 'Tecnico' | 'Empresa';
  // Evidência / link da plataforma do cliente
  linkPlataforma?: string;
  observacoes?: string;
  // Status e histórico
  status: ChamadoStatus;
  historico: HistoricoEntry[];
  motivoRejeicao?: string;
  // Pagamento
  pagamentoId?: string | null;
  // Metadados
  registradoPor: string;
  registradoPorNome: string;
  registradoEm: number;
  atualizadoEm?: number;
}
