/**
 * Lógica pura de cálculo de pagamentos — sem dependências de Firebase.
 * Extraído de pagamento-firestore.ts para permitir testes unitários.
 */
import type { Chamado } from '../types/chamado';
import type { CatalogoServico } from '../types/catalogo';
import type { PagamentoChamadoDetalhe } from '../types/pagamento';

export function calcularDetalhesDeChamados(
  chamados: Chamado[],
  catalogoMap: Map<string, CatalogoServico>,
): PagamentoChamadoDetalhe[] {
  const lojaCount = new Map<string, number>();

  return chamados.map(c => {
    const servico = c.catalogoServicoId ? catalogoMap.get(c.catalogoServicoId) : undefined;
    const count = lojaCount.get(c.codigoLoja) ?? 0;
    const isAdicional = count > 0;
    lojaCount.set(c.codigoLoja, count + 1);

    const reembolsoPeca = (c.fornecedorPeca === 'Tecnico' && c.custoPeca) ? c.custoPeca : 0;

    // Horas extras além da franquia
    const horasFranquia = servico?.horasFranquia ?? 2;
    const durationHoras = (c.durationMinutes ?? 0) / 60;
    const horasExtras = Math.max(0, durationHoras - horasFranquia);

    let valorChamado = 0;
    let valorHorasExtras = 0;

    if (!servico) {
      valorChamado = isAdicional ? 20 : 120;
    } else if (!servico.pagaTecnico) {
      valorChamado = 0;
    } else if (servico.pagamentoIntegral) {
      valorChamado = servico.valorCustoTecnico;
    } else {
      const base = isAdicional ? servico.valorAdicionalCusto : servico.valorCustoTecnico;
      valorHorasExtras = horasExtras > 0 ? horasExtras * (servico.valorHoraAdicionalCusto ?? 0) : 0;
      valorChamado = base + valorHorasExtras;
    }

    return {
      serviceReportId: c.id,
      fsa: c.fsa,
      codigoLoja: c.codigoLoja,
      tecnicoExecutorId: c.tecnicoId,
      tecnicoExecutorNome: c.tecnicoNome,
      tecnicoPaiId: c.tecnicoPaiId,
      tecnicoPaiCodigo: c.tecnicoPaiCodigo,
      pagamentoDestino: c.pagamentoDestino,
      durationMinutes: c.durationMinutes ?? 0,
      catalogoServicoId: c.catalogoServicoId,
      catalogoServicoNome: c.catalogoServicoNome,
      pecaUsada: c.pecaUsada,
      custoPeca: c.custoPeca,
      fornecedorPeca: c.fornecedorPeca,
      estoqueItemId: c.estoqueItemId,
      estoqueItemNome: c.estoqueItemNome,
      estoqueQuantidade: c.estoqueQuantidade,
      estoqueBaixadoEm: c.estoqueBaixadoEm,
      valorChamado,
      isAdicional,
      reembolsoPeca,
      linkPlataforma: c.linkPlataforma,
      horasExtras: horasExtras > 0 ? horasExtras : undefined,
      valorHorasExtras: valorHorasExtras > 0 ? valorHorasExtras : undefined,
    };
  });
}
