import type { ChamadoStatus } from '../types/chamado';

export interface StatusConfig {
  label: string;
  color: string;
  badge: string;
}

export const CHAMADO_STATUS_CONFIG: Record<ChamadoStatus, StatusConfig> = {
  rascunho:            { label: 'Rascunho',           color: 'text-muted-foreground',                  badge: 'bg-muted text-muted-foreground border-border' },
  submetido:           { label: 'Ag. Validação Op.',  color: 'text-blue-600 dark:text-blue-400',       badge: 'bg-blue-500/10 text-blue-700 border-blue-500/25 dark:text-blue-400' },
  validado_operador:   { label: 'Ag. Validação Fin.', color: 'text-purple-600 dark:text-purple-400',   badge: 'bg-purple-500/10 text-purple-700 border-purple-500/25 dark:text-purple-400' },
  rejeitado:           { label: 'Rejeitado',          color: 'text-red-600 dark:text-red-400',         badge: 'bg-red-500/10 text-red-700 border-red-500/25 dark:text-red-400' },
  validado_financeiro: { label: 'Aprovado',           color: 'text-green-600 dark:text-green-400',     badge: 'bg-green-500/10 text-green-700 border-green-500/25 dark:text-green-400' },
  pagamento_pendente:  { label: 'Ag. Pagamento',      color: 'text-amber-600 dark:text-amber-400',     badge: 'bg-amber-500/10 text-amber-700 border-amber-500/25 dark:text-amber-400' },
  pago:                { label: 'Pago',               color: 'text-emerald-600 dark:text-emerald-400', badge: 'bg-emerald-500/10 text-emerald-700 border-emerald-500/25 dark:text-emerald-400' },
};
