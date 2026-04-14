export interface SchedulingIssue {
  key: string;
  loja: string;
  pdv: string;
  ativo: string;
  problema: string;
  endereco: string;
  cidade: string;
  uf: string;
  cep: string;
  dataAgenda: string | null;
  tecnico: string;
  req: string;
  status: string;
  statusId: string;
  created: Date | null;
  updated: Date | null;
  resolutiondate: Date | null;
  /** SLA badge: '' | '🟢' | '🟡 ALERTA SLA' | '🔴 SLA ESTOURADO' */
  slaBadge: string;
}

export interface LojaGroup {
  loja: string;
  cidade: string;
  uf: string;
  qtd: number;
  lastUpdated: Date | null;
  endereco: string;
  cep: string;
  /** true if qtd >= 5 OR last update > 7 days ago */
  isCritical: boolean;
  /** Staleness based on lastUpdated age */
  slaGroupStatus: 'ok' | 'warning' | 'critical';
  issues: SchedulingIssue[];
}

export interface KpiData {
  agendamento: number;
  agendado: number;
  tecCampo: number;
  lojasMultiplas: number;
}

export interface TrendPoint {
  label: string; // dd/mm
  Novos: number;
  Resolvidos: number;
}

export interface TransitionOption {
  id: string;
  name: string;
  toName: string;
}

/** Form data for scheduling a visit */
export interface AgendaFormData {
  data: string;   // yyyy-MM-dd
  hora: string;   // HH:MM
  tecnico: string;
  moverTecCampo: boolean;
}

/** Internal note stored in localStorage */
export interface InternalNote {
  fsa: string;
  classificacao: string;
  tecnico: string;
  data: string;
  obs: string;
  escalonado: boolean;
}

/** Grouped data returned by useAgendamentoData */
export interface AgendamentoData {
  pendentes: LojaGroup[];
  agendados: Map<string, LojaGroup[]>; // date string → lojas
  tecCampo: LojaGroup[];
  kpi: KpiData;
  top5: LojaGroup[];
  trendPoints: TrendPoint[];
  /** All issues for REQ tracker */
  allIssues: SchedulingIssue[];
  /** All loja groups (combo) for route optimization */
  allLojaGroups: LojaGroup[];
}

export interface ManagerContact {
  loja: string;
  nome: string;
  telefone: string;
}

export interface RouteGroup {
  cepPrefix: string;
  cidade: string;
  lojas: string[];
}
