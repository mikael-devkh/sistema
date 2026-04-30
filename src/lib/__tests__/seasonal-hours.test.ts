import { describe, expect, it } from 'vitest';
import {
  normalizeSeasonalDate,
  normalizeStoreCode,
  parseSeasonalHoursMatrix,
  parseSeasonalHoursRows,
  seasonalHoursLabel,
} from '../seasonal-hours';

describe('seasonal-hours', () => {
  it('normaliza codigo de loja e datas comuns de planilha', () => {
    expect(normalizeStoreCode('Loja 00123')).toBe('123');
    expect(normalizeSeasonalDate('24/12/2026')).toBe('2026-12-24');
    expect(normalizeSeasonalDate('01/mai', '2026-05-01')).toBe('2026-05-01');
    expect(normalizeSeasonalDate('', '2026-12-25')).toBe('2026-12-25');
  });

  it('importa horarios por colunas de abertura e fechamento', () => {
    const result = parseSeasonalHoursRows([
      { Loja: '00123', Data: '24/12/2026', Abertura: '8h', Fechamento: '18:30', Obs: 'Vespera' },
    ]);

    expect(result.skipped).toBe(0);
    expect(result.entries[0]).toMatchObject({
      loja: '123',
      date: '2026-12-24',
      opensAt: '08:00',
      closesAt: '18:30',
      closed: false,
      note: 'Vespera',
    });
  });

  it('entende horario combinado e loja fechada', () => {
    const result = parseSeasonalHoursRows([
      { Codigo: '45', Data: '25/12/2026', Funcionamento: 'Fechado' },
      { Codigo: '46', Data: '26/12/2026', Funcionamento: '09:00 as 21:00' },
      { Codigo: '', Data: '26/12/2026', Funcionamento: '09:00 as 21:00' },
    ]);

    expect(result.skipped).toBe(1);
    expect(result.entries[0]).toMatchObject({ loja: '45', closed: true, opensAt: '', closesAt: '' });
    expect(result.entries[1]).toMatchObject({ loja: '46', opensAt: '09:00', closesAt: '21:00' });
    expect(seasonalHoursLabel(result.entries[0])).toBe('25/12: fechado');
  });

  it('entende planilha com data no cabecalho da coluna', () => {
    const result = parseSeasonalHoursMatrix([
      ['Horário Padrão', '', '', 'Sex'],
      ['Região', 'Distrito', 'Loja', '01/mai'],
      ['GR06', 'PIAUI/CE NORTE', 1007, 'Fechada'],
      ['GR08', 'SERGIPE/BA', 1008, 'Fechada'],
      ['GR05', 'ES/MG', 1015, '09:00 as 18:00'],
    ], '2026-05-01');

    expect(result.skipped).toBe(0);
    expect(result.entries).toHaveLength(3);
    expect(result.entries[0]).toMatchObject({
      loja: '1007',
      date: '2026-05-01',
      closed: true,
      opensAt: '',
      closesAt: '',
    });
    expect(result.entries[2]).toMatchObject({
      loja: '1015',
      date: '2026-05-01',
      closed: false,
      opensAt: '09:00',
      closesAt: '18:00',
    });
  });
});
