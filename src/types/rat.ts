export interface RatFormData {
  codigoLoja: string;
  pdv: string;
  fsa: string;
  endereco: string;
  cidade: string;
  uf: string;
  nomeSolicitante: string;
  serial: string;
  patrimonio: string;
  marca: string;
  modelo: string;
  houveTroca: string;
  origemEquipamento: string;
  numeroSerieTroca: string;
  equipNovoRecond: string;
  marcaTroca: string;
  modeloTroca: string;
  mauUso: string;
  observacoesPecas: string;
  defeitoProblema: string;
  diagnosticoTestes: string;
  solucao: string;
  problemaResolvido: string;
  motivoNaoResolvido: string;
  haveraRetorno: string;
  horaInicio: string;
  horaTermino: string;
  data: string;
  clienteNome: string;
  clienteRgMatricula: string;
  clienteTelefone: string;
  prestadorNome: string;
  prestadorRgMatricula: string;
  prestadorTelefone: string;
  // Novos campos para os dropdowns dinâmicos
  equipamentoSelecionado?: string;
  pecaSelecionada?: string;
  opcaoExtraZebra?: string;
}

// Define os campos que esperamos do Jira, incluindo os customfields
export type JiraFields = {
  summary: string;
  description?: string; // Descrição é opcional
  created: string;
  // Campos do Bot de Agendamento
  customfield_14954?: { value: string }; // Loja
  customfield_14829?: string; // PDV
  customfield_14825?: { value: string }; // Ativo
  customfield_12374?: string; // Problema
  customfield_12271?: string; // Endereço
  customfield_11948?: { value: string }; // Estado (UF)
  customfield_11993?: string; // CEP
  customfield_11994?: string; // Cidade
  customfield_12036?: string; // Data Agendada
};

export type JiraIssue = {
  key: string;
  fields: JiraFields;
};

export type JiraSearchResult = {
  total: number;
  issues: JiraIssue[];
};
