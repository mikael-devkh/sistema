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

// Tipo para os campos de uma issue do Jira
export type JiraFields = {
  summary: string;
  description?: string; // O 'description' pode não vir se não for pedido
  created: string;
  // Campos do Bot de Agendamento
  customfield_14954?: { value: string }; // Loja
  customfield_14829?: string; // PDV
  customfield_14825?: { value: string }; // Ativo
  customfield_12374?: string; // Problema
  customfield_12271?: string; // Endereço
  customfield_11948?: { value: string }; // Estado
  customfield_11993?: string; // CEP
  customfield_11994?: string; // Cidade
  customfield_12036?: string; // Data Agendada
};

// Tipo para uma issue completa do Jira
export interface JiraIssue {
  id: string;
  key: string;
  fields: JiraFields;
}

// Tipo para a resposta da API de busca do Jira
export interface JiraSearchResult {
  expand?: string;
  startAt?: number;
  maxResults?: number;
  total?: number;
  issues: JiraIssue[];
}
