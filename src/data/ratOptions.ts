import { RatFormData } from "../types/rat";

interface PdfPosition {
  x: number;
  yFromTop: number;
}

export interface RatCheckboxOption {
  value: string;
  label: string;
  pdfPosition: PdfPosition;
}

export const origemEquipamentoOptions: RatCheckboxOption[] = [
  { value: "E1-Novo Delfia", label: "E1 - Novo Delfia", pdfPosition: { x: 455, yFromTop: 282 } },
  { value: "E2-Novo Parceiro", label: "E2 - Novo Parceiro", pdfPosition: { x: 555, yFromTop: 282 } },
  { value: "E3-Recond. Delfia", label: "E3 - Recond. Delfia", pdfPosition: { x: 645, yFromTop: 282 } },
  { value: "E4-Equip.Americanas", label: "E4 - Equip. Americanas", pdfPosition: { x: 745, yFromTop: 282 } },
  { value: "E5-Peça-Delfia", label: "E5 - Peça Delfia", pdfPosition: { x: 455, yFromTop: 294 } },
  { value: "E6-Peça-Parceiro", label: "E6 - Peça Parceiro", pdfPosition: { x: 545, yFromTop: 294 } },
  { value: "E7-Peça-Americanas", label: "E7 - Peça Americanas", pdfPosition: { x: 665, yFromTop: 294 } },
  { value: "E8-Garantia Schalter", label: "E8 - Garantia Schalter", pdfPosition: { x: 780, yFromTop: 294 } },
  { value: "E9-Garantia Delfia", label: "E9 - Garantia Delfia", pdfPosition: { x: 455, yFromTop: 306 } },
  { value: "E10-Garantia Parceiro", label: "E10 - Garantia Parceiro", pdfPosition: { x: 555, yFromTop: 306 } },
];

export const createEmptyRatFormData = (): RatFormData => ({
  codigoLoja: "",
  pdv: "",
  fsa: "",
  endereco: "",
  cidade: "",
  uf: "",
  nomeSolicitante: "",
  serial: "",
  patrimonio: "",
  marca: "",
  modelo: "",
  houveTroca: "",
  origemEquipamento: "",
  numeroSerieTroca: "",
  equipNovoRecond: "",
  marcaTroca: "",
  modeloTroca: "",
  mauUso: "",
  observacoesPecas: "",
  defeitoProblema: "",
  diagnosticoTestes: "",
  solucao: "",
  problemaResolvido: "",
  motivoNaoResolvido: "",
  haveraRetorno: "",
  horaInicio: "",
  horaTermino: "",
  data: "",
  clienteNome: "",
  clienteRgMatricula: "",
  clienteTelefone: "",
  prestadorNome: "",
  prestadorRgMatricula: "",
  prestadorTelefone: "",
});

export const sampleRatFormData: RatFormData = {
  codigoLoja: "1234",
  pdv: "02",
  fsa: "FSA-5678",
  endereco: "Rua Exemplo, 123 - Centro",
  cidade: "São Paulo",
  uf: "SP",
  nomeSolicitante: "Maria Souza",
  serial: "SN123456",
  patrimonio: "ATV123456",
  marca: "Epson",
  modelo: "TM-T20",
  houveTroca: "sim",
  origemEquipamento: "E1-Novo Delfia",
  numeroSerieTroca: "SN987654",
  equipNovoRecond: "Novo",
  marcaTroca: "Epson",
  modeloTroca: "TM-T20 II",
  mauUso: "nao",
  observacoesPecas: "Fonte substituída preventivamente.",
  defeitoProblema: "Impressora não ligava no início do expediente.",
  diagnosticoTestes: "Verificado cabeamento, substituída fonte e realizados testes de impressão.",
  solucao: "Fonte trocada e firmware atualizado.",
  problemaResolvido: "sim",
  motivoNaoResolvido: "",
  haveraRetorno: "nao",
  horaInicio: "09:15",
  horaTermino: "10:05",
  data: "2024-04-01",
  clienteNome: "João Pereira",
  clienteRgMatricula: "RG 12.345.678-9",
  clienteTelefone: "(11) 90000-0000",
  prestadorNome: "Ana Lima",
  prestadorRgMatricula: "CREA 123456",
  prestadorTelefone: "(11) 98888-7777",
};

export const cloneRatFormData = (data: RatFormData): RatFormData => ({
  ...data,
});
