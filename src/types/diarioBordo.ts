export type Gravidade = 'baixa' | 'media' | 'alta';

export interface DiarioEntry {
  id: string;
  timestamp: number;
  data: string;              // YYYY-MM-DD
  tecnico: string;
  loja: string;
  descricaoProblema: string;
  gravidade: Gravidade;
  criadoPor: string;         // uid
  criadoPorEmail: string;
}

export type DiarioEntryInput = Omit<DiarioEntry, 'id'>;
