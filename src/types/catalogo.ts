export interface Cliente {
  id: string;
  nome: string;
  ativo: boolean;
  criadoEm?: number;
  atualizadoEm?: number;
}

export interface CatalogoServico {
  id: string;
  clienteId: string;
  clienteNome?: string; // desnormalizado para exibição
  nome: string;
  // Receita (o que a empresa recebe pelo serviço)
  valorReceita: number;
  valorAdicionalReceita: number;
  valorHoraAdicionalReceita: number;
  // Custo (o que o técnico recebe)
  valorCustoTecnico: number;
  valorAdicionalCusto: number;
  valorHoraAdicionalCusto: number;
  // Regras de negócio
  exigePeca: boolean;          // exige seleção de peça
  pagaTecnico: boolean;        // paga técnico (false p/ "Falha")
  pagamentoIntegral: boolean;  // sempre valor cheio (ex: retorno SPARE)
  isRetorno: boolean;          // chamado de retorno
  horasFranquia: number;       // horas inclusas no valor base (padrão: 2)
  criadoEm?: number;
  atualizadoEm?: number;
}
