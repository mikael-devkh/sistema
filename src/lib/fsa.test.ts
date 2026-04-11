import { describe, it, expect } from 'vitest';
import { normalizeFsa, extractStoreCode } from './fsa';

describe('FSA Utils', () => {
  describe('normalizeFsa', () => {
    it('deve normalizar "FSA-1234" para "1234"', () => {
      expect(normalizeFsa('FSA-1234')).toBe('1234');
    });

    it('deve normalizar "FSA 1234" para "1234"', () => {
      expect(normalizeFsa('FSA 1234')).toBe('1234');
    });

    it('deve retornar undefined para entrada inválida', () => {
      expect(normalizeFsa('abc')).toBeUndefined();
    });
  });

  describe('extractStoreCode', () => {
    it('deve extrair código de loja de 3-5 dígitos', () => {
      expect(extractStoreCode('Loja 123')).toBe('123');
    });
  });
});
