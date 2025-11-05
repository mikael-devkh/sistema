export interface TechnicianProfile {
  // IDs e identificação
  uid: string; // Firebase Auth UID
  codigoTecnico: string; // TEC-001, TEC-002, etc (único)
  email: string;
  
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
  
  // Dados de localização/operação
  regiaoAtuacao?: string[]; // ['SP', 'RJ', 'MG']
  cidade?: string;
  uf?: string;
  endereco?: string;
  
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

