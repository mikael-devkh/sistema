import { describe, it, expect } from 'vitest';
import { normalizeFsa, extractStoreCode } from '../fsa';

describe('normalizeFsa', () => {
  it('extrai número de formatos comuns', () => {
    expect(normalizeFsa('FSA 1234')).toBe('1234');
    expect(normalizeFsa('FSA-1234')).toBe('1234');
    expect(normalizeFsa('fsa1234')).toBe('1234');
    expect(normalizeFsa('1234')).toBe('1234');
    expect(normalizeFsa('  FSA 1234  ')).toBe('1234');
  });

  it('aceita 2 a 6 dígitos', () => {
    expect(normalizeFsa('FSA 12')).toBe('12');
    expect(normalizeFsa('FSA 123456')).toBe('123456');
  });

  it('retorna undefined em entradas inválidas', () => {
    expect(normalizeFsa(undefined)).toBeUndefined();
    expect(normalizeFsa('')).toBeUndefined();
    expect(normalizeFsa('   ')).toBeUndefined();
    expect(normalizeFsa('abc')).toBeUndefined();
  });
});

describe('extractStoreCode', () => {
  it('extrai 3 a 5 dígitos', () => {
    expect(extractStoreCode('Loja 1234')).toBe('1234');
    expect(extractStoreCode('store 305')).toBe('305');
    expect(extractStoreCode('12345')).toBe('12345');
  });

  it('retorna undefined sem dígitos suficientes', () => {
    expect(extractStoreCode('AB')).toBeUndefined();
    expect(extractStoreCode('12')).toBeUndefined();
    expect(extractStoreCode(undefined)).toBeUndefined();
  });
});
