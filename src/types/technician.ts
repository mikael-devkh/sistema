/**
 * Define para onde vai o pagamento deste técnico:
 * - 'self': pagamento vai direto ao próprio técnico
 * - 'parent': pagamento vai ao técnico pai (ele atende em nome de outro)
 */
export type PaymentTarget = 'self' | 'parent';

/**
 * Área de atendimento do técnico. Usada no mapa e na busca por
 * técnicos disponíveis para uma localidade.
 */
export interface ServiceArea {
  /** Cidade base de onde o técnico parte */
  cidadeBase?: string;
  ufBase?: string;
  /** Coordenadas da cidade base (lng, lat). Preenchido a partir do brazilCityCoords */
  coordenadas?: { lat: number; lng: number };
  /** Se atende arredores da cidade base */
  atendeArredores: boolean;
  /** Raio (km) de atendimento a partir da cidade base quando atendeArredores = true */
  raioKm?: number;
  /** Cidades adicionais cobertas explicitamente (fora do raio) */
  cidadesAdicionais?: { cidade: string; uf: string }[];
}

export interface TechnicianProfile {
  // IDs e identificação
  uid: string; // ID do documento Firestore
  codigoTecnico: string; // TEC-001, TEC-002, etc (único)
  email?: string; // opcional — técnicos não têm conta no sistema

  // Dados pessoais
  nome: string;
  nomeCompleto: string;
  cpf?: string;
  rg?: string;
  telefone: string;
  telefoneEmergencia?: string;

  // Dados profissionais
  matricula?: string;
  cargo: 'tecnico' | 'supervisor' | 'coordenador';
  especialidades: string[]; // ['hardware', 'rede', 'impressora', etc]
  certificacoes?: string[];

  // ── Hierarquia pai/filho ────────────────────────────────────────────────
  /** UID do técnico pai (caso este seja filho / subcontratado) */
  tecnicoPaiId?: string;
  /** Código do técnico pai (denormalizado para facilitar exibição) */
  tecnicoPaiCodigo?: string;
  /** Nome do técnico pai (denormalizado) */
  tecnicoPaiNome?: string;
  /** Define quem recebe o pagamento pelos chamados atendidos por este técnico */
  pagamentoPara?: PaymentTarget;

  // ── Localização / Área de atendimento ──────────────────────────────────
  regiaoAtuacao?: string[]; // ['SP', 'RJ', 'MG']
  cidade?: string;
  uf?: string;
  endereco?: string;
  areaAtendimento?: ServiceArea;

  // Dados de pagamento
  pagamento?: {
    banco?: string;
    agencia?: string;
    conta?: string;
    tipoConta?: 'corrente' | 'poupanca';
    pix?: string;
    observacoes?: string;
  };

  // Status e disponibilidade
  status: 'ativo' | 'inativo' | 'ferias' | 'licenca' | 'desligado';
  disponivel: boolean;
  ultimaLocalizacao?: {
    lat: number;
    lng: number;
    timestamp: number;
  };

  // Metadados
  dataCadastro: number;
  dataAtualizacao: number;
  cadastradoPor?: string; // UID do admin que cadastrou
  avatarUrl?: string;

  // Estatísticas (calculadas)
  totalChamados?: number;
  chamadosConcluidos?: number;
  chamadosEmAndamento?: number;
  mediaTempoAtendimento?: number; // em minutos
  avaliacaoMedia?: number; // 1-5
}

