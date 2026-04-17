import { describe, it, expect } from 'vitest';
import {
  calculateBillingWithCatalog,
  BASE_FEE_INITIAL_CALL,
  FEE_PER_EXTRA_ACTIVE,
  FEE_PER_EXTRA_HOUR,
} from '../billing-calculator';
import type { ActiveCall, StoreTimerRecord } from '../../hooks/use-service-manager';
import type { CatalogoServico } from '../../types/catalogo';

// ─── Builders ────────────────────────────────────────────────────────────────

let _id = 0;
function call(overrides: Partial<ActiveCall> = {}): ActiveCall {
  return {
    id: `call${++_id}`,
    fsa: `FSA-${_id}`,
    codigoLoja: overrides.codigoLoja ?? '0001',
    pdv: overrides.pdv,
    status: 'open',
    photos: {} as ActiveCall['photos'],
    openedAt: new Date().toISOString(),
    timeStarted: null,
    timeTotalServiceMinutes: 0,
    ...overrides,
  };
}

function timer(totalMinutes: number): StoreTimerRecord {
  return { codigoLoja: '0001', timeStarted: null, totalMinutes };
}

function servico(overrides: Partial<CatalogoServico> = {}): CatalogoServico {
  return {
    id: overrides.id ?? 's1',
    clienteId: 'cli1',
    nome: 'Serviço Teste',
    valorReceita: 200,
    valorAdicionalReceita: 60,
    valorHoraAdicionalReceita: 30,
    valorCustoTecnico: 150,
    valorAdicionalCusto: 40,
    valorHoraAdicionalCusto: 20,
    exigePeca: false,
    pagaTecnico: true,
    pagamentoIntegral: false,
    isRetorno: false,
    horasFranquia: 2,
    ...overrides,
  };
}

// ─── Testes ───────────────────────────────────────────────────────────────────

describe('calculateBillingWithCatalog', () => {
  // ── Fallback sem catálogo ──────────────────────────────────────────────────

  describe('fallback para calculateBilling quando nenhum chamado tem catálogo', () => {
    it('usa os valores padrão (120/20)', () => {
      const calls = [
        call({ codigoLoja: '001' }),
        call({ codigoLoja: '001' }),
      ];
      const timers = { '001': timer(60) };
      const resultado = calculateBillingWithCatalog(calls, timers, []);

      expect(resultado.detailsByStore['001'].fee).toBe(
        BASE_FEE_INITIAL_CALL + FEE_PER_EXTRA_ACTIVE,
      );
    });
  });

  // ── Batch por loja ────────────────────────────────────────────────────────

  describe('batch pricing por loja', () => {
    it('1º chamado usa valorCustoTecnico, 2º usa valorAdicionalCusto', () => {
      const s = servico({ id: 's1', valorCustoTecnico: 150, valorAdicionalCusto: 40 });
      const calls = [
        call({ codigoLoja: '001', catalogoServicoId: 's1' }),
        call({ codigoLoja: '001', catalogoServicoId: 's1' }),
      ];
      const resultado = calculateBillingWithCatalog(calls, {}, [s]);

      expect(resultado.detailsByStore['001'].custoTecnico).toBe(190); // 150 + 40
    });

    it('lojas diferentes têm contagem independente', () => {
      const s = servico({ id: 's1', valorCustoTecnico: 150, valorAdicionalCusto: 40 });
      const calls = [
        call({ codigoLoja: '001', catalogoServicoId: 's1' }),
        call({ codigoLoja: '002', catalogoServicoId: 's1' }),
      ];
      const resultado = calculateBillingWithCatalog(calls, {}, [s]);

      expect(resultado.detailsByStore['001'].custoTecnico).toBe(150);
      expect(resultado.detailsByStore['002'].custoTecnico).toBe(150);
    });

    it('3 chamados na mesma loja: 1 cheio + 2 adicionais', () => {
      const s = servico({ id: 's1', valorCustoTecnico: 150, valorAdicionalCusto: 40 });
      const calls = [
        call({ codigoLoja: '001', catalogoServicoId: 's1' }),
        call({ codigoLoja: '001', catalogoServicoId: 's1' }),
        call({ codigoLoja: '001', catalogoServicoId: 's1' }),
      ];
      const resultado = calculateBillingWithCatalog(calls, {}, [s]);

      expect(resultado.detailsByStore['001'].custoTecnico).toBe(230); // 150 + 40 + 40
    });
  });

  // ── pagamentoIntegral ─────────────────────────────────────────────────────

  describe('pagamentoIntegral=true', () => {
    it('não entra na contagem de lote — sempre valorCustoTecnico', () => {
      const s = servico({
        id: 's1',
        pagamentoIntegral: true,
        valorCustoTecnico: 200,
        valorAdicionalCusto: 50,
      });
      const calls = [
        call({ codigoLoja: '001', catalogoServicoId: 's1' }),
        call({ codigoLoja: '001', catalogoServicoId: 's1' }),
      ];
      const resultado = calculateBillingWithCatalog(calls, {}, [s]);

      expect(resultado.detailsByStore['001'].custoTecnico).toBe(400); // 200 + 200
    });

    it('mistura integral + normal: integral não avança o índice de lote', () => {
      const integral = servico({ id: 'sint', pagamentoIntegral: true, valorCustoTecnico: 200 });
      const normal   = servico({ id: 'snor', pagamentoIntegral: false, valorCustoTecnico: 150, valorAdicionalCusto: 40 });

      const calls = [
        call({ codigoLoja: '001', catalogoServicoId: 'sint' }), // integral — não conta no lote
        call({ codigoLoja: '001', catalogoServicoId: 'snor' }), // 1º normal → 150
        call({ codigoLoja: '001', catalogoServicoId: 'snor' }), // 2º normal → 40
      ];
      const resultado = calculateBillingWithCatalog(calls, {}, [integral, normal]);

      // 200 (integral) + 150 (1º normal) + 40 (2º normal)
      expect(resultado.detailsByStore['001'].custoTecnico).toBe(390);
    });
  });

  // ── pagaTecnico=false ─────────────────────────────────────────────────────

  describe('pagaTecnico=false', () => {
    it('custo técnico = 0 mesmo com valorCustoTecnico definido', () => {
      const s = servico({ id: 's1', pagaTecnico: false, valorCustoTecnico: 150 });
      const calls = [call({ codigoLoja: '001', catalogoServicoId: 's1' })];
      const resultado = calculateBillingWithCatalog(calls, {}, [s]);

      expect(resultado.detailsByStore['001'].custoTecnico).toBe(0);
    });
  });

  // ── Horas extras ──────────────────────────────────────────────────────────

  describe('horas extras', () => {
    it('dentro da franquia — sem cobrança extra', () => {
      const s = servico({ id: 's1', horasFranquia: 2, valorHoraAdicionalCusto: 20 });
      const calls = [call({ codigoLoja: '001', catalogoServicoId: 's1' })];
      const timers = { '001': timer(120) }; // exatamente 2h → sem extra

      const resultado = calculateBillingWithCatalog(calls, timers, [s]);

      expect(resultado.detailsByStore['001'].extraHours).toBe(0);
      expect(resultado.detailsByStore['001'].timeCustoTecnico).toBe(0);
    });

    it('1 hora excedente usa valorHoraAdicionalCusto do catálogo', () => {
      const s = servico({ id: 's1', horasFranquia: 2, valorHoraAdicionalCusto: 20 });
      const calls = [call({ codigoLoja: '001', catalogoServicoId: 's1' })];
      const timers = { '001': timer(180) }; // 3h → 1h extra

      const resultado = calculateBillingWithCatalog(calls, timers, [s]);

      expect(resultado.detailsByStore['001'].extraHours).toBe(1);
      expect(resultado.detailsByStore['001'].timeCustoTecnico).toBe(20);
    });

    it('hora parcial arredonda para cima (ceil)', () => {
      const s = servico({ id: 's1', horasFranquia: 2, valorHoraAdicionalCusto: 20 });
      const calls = [call({ codigoLoja: '001', catalogoServicoId: 's1' })];
      const timers = { '001': timer(179) }; // 1h59min excedendo 0 → 59min excedente → ceil = 1h cobrada

      const resultado = calculateBillingWithCatalog(calls, timers, [s]);

      expect(resultado.detailsByStore['001'].extraHours).toBe(1);
    });

    it('franquia customizada de 4h respeitada', () => {
      const s = servico({ id: 's1', horasFranquia: 4, valorHoraAdicionalCusto: 25 });
      const calls = [call({ codigoLoja: '001', catalogoServicoId: 's1' })];
      const timers = { '001': timer(300) }; // 5h → 1h extra (franquia = 4h)

      const resultado = calculateBillingWithCatalog(calls, timers, [s]);

      expect(resultado.detailsByStore['001'].extraHours).toBe(1);
      expect(resultado.detailsByStore['001'].timeCustoTecnico).toBe(25);
    });

    it('usa FEE_PER_EXTRA_HOUR padrão quando não há catálogo para a franquia', () => {
      const calls = [call({ codigoLoja: '001', catalogoServicoId: 's1' })];
      const timers = { '001': timer(180) };
      // catalogoMap sem 's1' → horasFranquia = 2, valorHoraAdicionalCusto = FEE_PER_EXTRA_HOUR
      const resultado = calculateBillingWithCatalog(calls, timers, []);

      // Sem catálogo → fallback total, mas o timer ainda é avaliado
      expect(resultado.detailsByStore['001'].timeFee).toBe(FEE_PER_EXTRA_HOUR);
    });
  });

  // ── Peça fornecida pelo técnico ───────────────────────────────────────────

  describe('reembolso de peça (fornecedorPeca=Tecnico)', () => {
    it('adiciona custoPeca ao custo da loja', () => {
      const s = servico({ id: 's1', valorCustoTecnico: 150 });
      const calls = [
        call({ codigoLoja: '001', catalogoServicoId: 's1', fornecedorPeca: 'Tecnico', custoPeca: 80 }),
      ];
      const resultado = calculateBillingWithCatalog(calls, {}, [s]);

      expect(resultado.detailsByStore['001'].custoTecnico).toBe(230); // 150 + 80
    });

    it('não adiciona quando fornecedor é Empresa', () => {
      const s = servico({ id: 's1', valorCustoTecnico: 150 });
      const calls = [
        call({ codigoLoja: '001', catalogoServicoId: 's1', fornecedorPeca: 'Empresa', custoPeca: 80 }),
      ];
      const resultado = calculateBillingWithCatalog(calls, {}, [s]);

      expect(resultado.detailsByStore['001'].custoTecnico).toBe(150);
    });
  });

  // ── Totais globais ────────────────────────────────────────────────────────

  describe('totais agregados', () => {
    it('totalActiveCount soma chamados de todas as lojas', () => {
      const s = servico({ id: 's1' });
      const calls = [
        call({ codigoLoja: '001', catalogoServicoId: 's1' }),
        call({ codigoLoja: '002', catalogoServicoId: 's1' }),
        call({ codigoLoja: '002', catalogoServicoId: 's1' }),
      ];
      const resultado = calculateBillingWithCatalog(calls, {}, [s]);

      expect(resultado.totalActiveCount).toBe(3);
    });

    it('totalCustoTecnico é a soma dos custos de todas as lojas', () => {
      const s = servico({ id: 's1', valorCustoTecnico: 150, valorAdicionalCusto: 40 });
      const calls = [
        call({ codigoLoja: '001', catalogoServicoId: 's1' }),
        call({ codigoLoja: '002', catalogoServicoId: 's1' }),
        call({ codigoLoja: '002', catalogoServicoId: 's1' }),
      ];
      const resultado = calculateBillingWithCatalog(calls, {}, [s]);

      // loja 001: 150 | loja 002: 150 + 40 = 190
      expect(resultado.totalCustoTecnico).toBe(340);
    });
  });
});
