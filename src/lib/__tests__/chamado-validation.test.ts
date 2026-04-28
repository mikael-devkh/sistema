import { describe, expect, it } from 'vitest';
import {
  assertChamadoTransition,
  buildChamadoIdempotencyKey,
  normalizeChamadoCode,
  validateChamadoPayload,
} from '../chamado-validation';

const validPayload = {
  fsa: 'wts-123',
  codigoLoja: '100',
  tecnicoId: 'tec-1',
  dataAtendimento: '2026-04-28',
};

describe('chamado-validation', () => {
  it('normaliza codigo do chamado e gera chave idempotente estavel', () => {
    expect(normalizeChamadoCode(' wts-123 ')).toBe('WTS-123');
    expect(buildChamadoIdempotencyKey(validPayload)).toBe('WTS-123|tec-1|2026-04-28');
  });

  it('valida campos obrigatorios e intervalo de horario', () => {
    const result = validateChamadoPayload({
      ...validPayload,
      fsa: '',
      horaInicio: '14:00',
      horaFim: '13:59',
    });

    expect(result.ok).toBe(false);
    expect(result.errors).toEqual(expect.arrayContaining([
      'Código do chamado é obrigatório.',
      'Hora final deve ser posterior à hora inicial.',
    ]));
  });

  it('bloqueia codigo duplicado dentro do lote', () => {
    const result = validateChamadoPayload({
      ...validPayload,
      itensAdicionais: [
        { codigoChamado: ' WTS-123 ', codigoLoja: '100' },
      ],
    });

    expect(result.ok).toBe(false);
    expect(result.errors).toContain('Código duplicado no lote: WTS-123.');
  });

  it('permite apenas transicoes previstas no workflow', () => {
    expect(() => assertChamadoTransition('rascunho', 'submetido')).not.toThrow();
    expect(() => assertChamadoTransition('validado_financeiro', 'pagamento_pendente')).not.toThrow();
    expect(() => assertChamadoTransition('pagamento_pendente', 'pago')).not.toThrow();
    expect(() => assertChamadoTransition('rascunho', 'pago')).toThrow('Transição de chamado inválida');
  });
});
