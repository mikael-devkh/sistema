import { describe, it, expect } from 'vitest';
import { calcularDetalhesDeChamados } from '../pagamento-calc';
import type { Chamado } from '../../types/chamado';
import type { CatalogoServico } from '../../types/catalogo';

// ─── Builders ────────────────────────────────────────────────────────────────

let _id = 0;
function chamado(overrides: Partial<Chamado> = {}): Chamado {
  return {
    id: `c${++_id}`,
    fsa: overrides.fsa ?? `FSA-${_id}`,
    codigoLoja: overrides.codigoLoja ?? '0001',
    tecnicoId: 'tec1',
    tecnicoNome: 'Técnico Teste',
    dataAtendimento: '2026-04-10',
    status: 'validado_financeiro',
    historico: [],
    registradoPor: 'u1',
    registradoPorNome: 'User',
    registradoEm: Date.now(),
    pagamentoId: null,
    ...overrides,
  };
}

function servico(overrides: Partial<CatalogoServico> = {}): CatalogoServico {
  return {
    id: overrides.id ?? 's1',
    clienteId: 'cli1',
    nome: overrides.nome ?? 'Serviço Padrão',
    valorReceita: 200,
    valorAdicionalReceita: 50,
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

function mapaServicos(...servicos: CatalogoServico[]): Map<string, CatalogoServico> {
  return new Map(servicos.map(s => [s.id, s]));
}

// ─── Testes ───────────────────────────────────────────────────────────────────

describe('calcularDetalhesDeChamados', () => {
  // ── Fallback sem catálogo ──────────────────────────────────────────────────

  describe('sem catálogo', () => {
    it('cobra R$120 no primeiro chamado da loja', () => {
      const resultado = calcularDetalhesDeChamados(
        [chamado({ codigoLoja: '001' })],
        new Map(),
      );
      expect(resultado[0].valorChamado).toBe(120);
      expect(resultado[0].isAdicional).toBe(false);
    });

    it('cobra R$20 nos chamados adicionais da mesma loja', () => {
      const resultado = calcularDetalhesDeChamados(
        [
          chamado({ codigoLoja: '001' }),
          chamado({ codigoLoja: '001' }),
          chamado({ codigoLoja: '001' }),
        ],
        new Map(),
      );
      expect(resultado[0].valorChamado).toBe(120);
      expect(resultado[1].valorChamado).toBe(20);
      expect(resultado[2].valorChamado).toBe(20);
      expect(resultado[1].isAdicional).toBe(true);
    });

    it('reinicia contagem para loja diferente', () => {
      const resultado = calcularDetalhesDeChamados(
        [
          chamado({ codigoLoja: '001' }),
          chamado({ codigoLoja: '002' }),
        ],
        new Map(),
      );
      expect(resultado[0].valorChamado).toBe(120); // loja 001 — 1º
      expect(resultado[1].valorChamado).toBe(120); // loja 002 — 1º
    });
  });

  // ── Com catálogo ───────────────────────────────────────────────────────────

  describe('com catálogo', () => {
    it('usa valorCustoTecnico no primeiro chamado da loja', () => {
      const s = servico({ id: 's1', valorCustoTecnico: 150, valorAdicionalCusto: 40 });
      const resultado = calcularDetalhesDeChamados(
        [chamado({ codigoLoja: '001', catalogoServicoId: 's1' })],
        mapaServicos(s),
      );
      expect(resultado[0].valorChamado).toBe(150);
      expect(resultado[0].isAdicional).toBe(false);
    });

    it('usa valorAdicionalCusto do 2º chamado em diante na mesma loja', () => {
      const s = servico({ id: 's1', valorCustoTecnico: 150, valorAdicionalCusto: 40 });
      const resultado = calcularDetalhesDeChamados(
        [
          chamado({ codigoLoja: '001', catalogoServicoId: 's1' }),
          chamado({ codigoLoja: '001', catalogoServicoId: 's1' }),
        ],
        mapaServicos(s),
      );
      expect(resultado[0].valorChamado).toBe(150);
      expect(resultado[1].valorChamado).toBe(40);
      expect(resultado[1].isAdicional).toBe(true);
    });

    it('pagaTecnico=false resulta em valorChamado=0 (chamado de falha)', () => {
      const s = servico({ id: 's1', pagaTecnico: false, valorCustoTecnico: 150 });
      const resultado = calcularDetalhesDeChamados(
        [chamado({ codigoLoja: '001', catalogoServicoId: 's1' })],
        mapaServicos(s),
      );
      expect(resultado[0].valorChamado).toBe(0);
    });

    it('pagamentoIntegral=true sempre usa valorCustoTecnico, ignora lote', () => {
      const s = servico({
        id: 's1',
        pagamentoIntegral: true,
        valorCustoTecnico: 200,
        valorAdicionalCusto: 50,
      });
      const resultado = calcularDetalhesDeChamados(
        [
          chamado({ codigoLoja: '001', catalogoServicoId: 's1' }),
          chamado({ codigoLoja: '001', catalogoServicoId: 's1' }),
          chamado({ codigoLoja: '001', catalogoServicoId: 's1' }),
        ],
        mapaServicos(s),
      );
      expect(resultado[0].valorChamado).toBe(200);
      expect(resultado[1].valorChamado).toBe(200);
      expect(resultado[2].valorChamado).toBe(200);
    });

    it('catálogos diferentes na mesma loja — batch conta corretamente', () => {
      const s1 = servico({ id: 's1', valorCustoTecnico: 150, valorAdicionalCusto: 40 });
      const s2 = servico({ id: 's2', valorCustoTecnico: 100, valorAdicionalCusto: 30 });
      const resultado = calcularDetalhesDeChamados(
        [
          chamado({ codigoLoja: '001', catalogoServicoId: 's1' }), // 1º → 150
          chamado({ codigoLoja: '001', catalogoServicoId: 's2' }), // 2º → 30 (adicional s2)
        ],
        mapaServicos(s1, s2),
      );
      expect(resultado[0].valorChamado).toBe(150);
      expect(resultado[1].valorChamado).toBe(30);
    });

    it('chamado de loja desconhecida no catálogo → fallback (120/20)', () => {
      const resultado = calcularDetalhesDeChamados(
        [chamado({ codigoLoja: '001', catalogoServicoId: 'inexistente' })],
        new Map(),
      );
      expect(resultado[0].valorChamado).toBe(120);
    });
  });

  // ── Reembolso de peça ──────────────────────────────────────────────────────

  describe('reembolso de peça', () => {
    it('reembolsa peça quando fornecedor é Tecnico', () => {
      const resultado = calcularDetalhesDeChamados(
        [chamado({ fornecedorPeca: 'Tecnico', custoPeca: 75 })],
        new Map(),
      );
      expect(resultado[0].reembolsoPeca).toBe(75);
    });

    it('não reembolsa quando fornecedor é Empresa', () => {
      const resultado = calcularDetalhesDeChamados(
        [chamado({ fornecedorPeca: 'Empresa', custoPeca: 75 })],
        new Map(),
      );
      expect(resultado[0].reembolsoPeca).toBe(0);
    });

    it('não reembolsa quando custoPeca não informado', () => {
      const resultado = calcularDetalhesDeChamados(
        [chamado({ fornecedorPeca: 'Tecnico', custoPeca: undefined })],
        new Map(),
      );
      expect(resultado[0].reembolsoPeca).toBe(0);
    });
  });

  // ── Cálculo do total ───────────────────────────────────────────────────────

  describe('totalização', () => {
    it('soma valorChamado + reembolsoPeca reflete o total devido ao técnico', () => {
      const s = servico({ id: 's1', valorCustoTecnico: 150 });
      const resultado = calcularDetalhesDeChamados(
        [chamado({ catalogoServicoId: 's1', fornecedorPeca: 'Tecnico', custoPeca: 50 })],
        mapaServicos(s),
      );
      const total = resultado.reduce((acc, d) => acc + d.valorChamado + d.reembolsoPeca, 0);
      expect(total).toBe(200); // 150 + 50
    });

    it('múltiplos técnicos com mesma loja não interferem entre si', () => {
      // Mesma loja, mas chamados de técnicos diferentes
      // A função não sabe de técnicos — agrupa só por loja
      // O agrupamento por técnico é feito em gerarPreviewPagamentos
      const resultado = calcularDetalhesDeChamados(
        [
          chamado({ codigoLoja: '001', tecnicoId: 'tec1' }),
          chamado({ codigoLoja: '001', tecnicoId: 'tec2' }),
        ],
        new Map(),
      );
      // Ambos no mesmo slice de chamados → 2º é adicional
      expect(resultado[0].valorChamado).toBe(120);
      expect(resultado[1].valorChamado).toBe(20);
    });
  });
});
