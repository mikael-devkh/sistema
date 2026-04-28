import type { ChamadoStatus, LoteItem } from '../types/chamado';

export interface ChamadoValidationPayload {
  fsa?: string;
  codigoLoja?: string;
  tecnicoId?: string;
  dataAtendimento?: string;
  horaInicio?: string;
  horaFim?: string;
  durationMinutes?: number;
  itensAdicionais?: LoteItem[];
  pecaUsada?: string;
  custoPeca?: number;
  fornecedorPeca?: 'Tecnico' | 'Empresa';
}

export interface ChamadoValidationResult {
  ok: boolean;
  errors: string[];
}

export const CHAMADO_ALLOWED_TRANSITIONS: Record<ChamadoStatus, ChamadoStatus[]> = {
  rascunho: ['submetido'],
  submetido: ['validado_operador', 'rejeitado_operacional', 'rejeitado'],
  validado_operador: ['validado_financeiro', 'rejeitado_financeiro', 'rejeitado'],
  rejeitado_operacional: ['submetido', 'cancelado'],
  rejeitado_financeiro: ['submetido', 'cancelado'],
  rejeitado: ['submetido'],
  validado_financeiro: ['pagamento_pendente', 'rejeitado_financeiro', 'rejeitado', 'cancelado'],
  pagamento_pendente: ['validado_financeiro', 'pago', 'rejeitado_financeiro', 'rejeitado', 'cancelado'],
  pago: [],
  cancelado: [],
};

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const HOUR_RE = /^\d{2}:\d{2}$/;

export function normalizeChamadoCode(value: string): string {
  return value.trim().toUpperCase();
}

export function buildChamadoIdempotencyKey(payload: ChamadoValidationPayload): string {
  return [
    normalizeChamadoCode(payload.fsa ?? ''),
    payload.tecnicoId?.trim() ?? '',
    payload.dataAtendimento ?? '',
  ].join('|');
}

export function validateChamadoPayload(payload: ChamadoValidationPayload): ChamadoValidationResult {
  const errors: string[] = [];
  const fsa = normalizeChamadoCode(payload.fsa ?? '');
  const codigoLoja = payload.codigoLoja?.trim() ?? '';
  const tecnicoId = payload.tecnicoId?.trim() ?? '';

  if (!fsa) errors.push('Código do chamado é obrigatório.');
  if (!codigoLoja) errors.push('Código da loja é obrigatório.');
  if (!tecnicoId) errors.push('Técnico é obrigatório.');
  if (!payload.dataAtendimento || !ISO_DATE_RE.test(payload.dataAtendimento)) {
    errors.push('Data de atendimento deve estar no formato YYYY-MM-DD.');
  }

  const hasOnlyOneHour = Boolean(payload.horaInicio) !== Boolean(payload.horaFim);
  if (hasOnlyOneHour) errors.push('Informe hora inicial e final, ou deixe ambas em branco.');

  if (payload.horaInicio && !HOUR_RE.test(payload.horaInicio)) errors.push('Hora inicial inválida.');
  if (payload.horaFim && !HOUR_RE.test(payload.horaFim)) errors.push('Hora final inválida.');
  if (payload.horaInicio && payload.horaFim && payload.horaFim <= payload.horaInicio) {
    errors.push('Hora final deve ser posterior à hora inicial.');
  }

  if (payload.durationMinutes != null && (!Number.isFinite(payload.durationMinutes) || payload.durationMinutes <= 0)) {
    errors.push('Duração do atendimento deve ser positiva.');
  }

  if (payload.custoPeca != null && (!Number.isFinite(payload.custoPeca) || payload.custoPeca < 0)) {
    errors.push('Custo da peça não pode ser negativo.');
  }

  if (payload.pecaUsada?.trim() && !payload.fornecedorPeca) {
    errors.push('Fornecedor da peça é obrigatório quando há peça usada.');
  }

  const seenCodes = new Set<string>([fsa]);
  for (const [idx, item] of (payload.itensAdicionais ?? []).entries()) {
    const code = normalizeChamadoCode(item.codigoChamado ?? '');
    if (!code) errors.push(`Código do item adicional ${idx + 2} é obrigatório.`);
    if (!item.codigoLoja?.trim()) errors.push(`Código da loja do item adicional ${idx + 2} é obrigatório.`);
    if (code && seenCodes.has(code)) errors.push(`Código duplicado no lote: ${code}.`);
    if (code) seenCodes.add(code);
  }

  return { ok: errors.length === 0, errors };
}

export function assertChamadoPayload(payload: ChamadoValidationPayload): void {
  const result = validateChamadoPayload(payload);
  if (!result.ok) throw new Error(result.errors.join(' '));
}

export function assertChamadoTransition(from: ChamadoStatus, to: ChamadoStatus): void {
  if (from === to) return;
  if (!CHAMADO_ALLOWED_TRANSITIONS[from]?.includes(to)) {
    throw new Error(`Transição de chamado inválida: ${from} -> ${to}.`);
  }
}
