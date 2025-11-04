import {
  PDFDocument,
  PDFPage,
  PDFFont,
  PDFTextField,
  StandardFonts,
  rgb,
  PDFWidgetAnnotation, // tipo auxiliar (pode não existir no build, por isso usamos any no runtime)
} from "pdf-lib";
import { loadPreferences } from "./settings";
import ratTemplateUrl from "../assets/rat-template.pdf?url";
import { RatFormData } from "../types/rat";
import { origemEquipamentoOptions } from "../data/ratOptions";

const log = (...args: any[]) => console.debug("[RAT]", ...args);

// Helper para setar texto em campos do formulário
function setTextSafe(form: any, fieldName: string, value?: string | null) {
  const textValue = value === undefined || value === null ? "" : String(value);
  try {
    form.getTextField(fieldName).setText(textValue);
  } catch {
    if (!textValue) return;
    try {
      form.getDropdown(fieldName).select(textValue);
    } catch {}
  }
}

// Helper para dividir texto automaticamente em linhas, baseando-se em um tamanho máximo por linha
function splitLinesAuto(text: string = "", maxLines: number = 4, maxLen: number = 56): string[] {
  if (!text) return Array(maxLines).fill("");

  // Normaliza espaços e quebras de linha
  const normalized = text
    .replace(/[\r\n]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const lines: string[] = [];
  let currentLine = "";

  const pushLine = (line: string) => {
    if (lines.length < maxLines) lines.push(line);
  };

  const words = normalized.split(" ");

  for (let i = 0; i < words.length && lines.length < maxLines; i++) {
    let word = words[i];
    while (word.length > maxLen) {
      pushLine(word.slice(0, maxLen));
      word = word.slice(maxLen);
      if (lines.length >= maxLines) break;
    }
    if (lines.length >= maxLines) break;
    const candidate = currentLine ? `${currentLine} ${word}` : word;
    if (candidate.length <= maxLen) {
      currentLine = candidate;
    } else {
      pushLine(currentLine);
      currentLine = word;
    }
  }

  if (lines.length < maxLines && currentLine) {
    pushLine(currentLine);
  }

  while (lines.length < maxLines) lines.push("");
  return lines.slice(0, maxLines);
}

function wrapByWidth(text: string, font: PDFFont, fontSize: number, maxWidth: number, maxLines: number): string[] {
  const words = text.replace(/[\r\n]+/g, " ").replace(/\s+/g, " ").trim().split(" ");
  const lines: string[] = [];
  let current = "";
  const push = (s: string) => { if (lines.length < maxLines) lines.push(s); };
  for (let i = 0; i < words.length && lines.length < maxLines; i++) {
    let w = words[i];
    // se palavra sozinha é maior que a largura, quebra em pedaços
    while (font.widthOfTextAtSize(w, fontSize) > maxWidth && lines.length < maxLines) {
      let lo = 1, hi = w.length;
      while (lo < hi) {
        const mid = Math.ceil((lo + hi) / 2);
        const part = w.slice(0, mid);
        const partWidth = font.widthOfTextAtSize(part, fontSize);
        if (partWidth <= maxWidth) {
          lo = mid;
        } else {
          hi = mid - 1;
        }
      }
      const take = lo;
      push(w.slice(0, take));
      w = w.slice(take);
      if (lines.length >= maxLines) return lines;
    }
    const candidate = current ? `${current} ${w}` : w;
    if (font.widthOfTextAtSize(candidate, fontSize) <= maxWidth) {
      current = candidate;
    } else {
      push(current);
      current = w;
    }
  }
  if (current && lines.length < maxLines) push(current);
  while (lines.length < maxLines) lines.push("");
  return lines.slice(0, maxLines);
}

function getFieldRectSafe(form: any, fieldName: string): { x: number; y: number; width: number; height: number } | null {
  try {
    const field: any = form.getTextField(fieldName);
    const widgets: any[] = field?.acroField?.getWidgets?.() || field?.getWidgets?.() || [];
    const w = widgets[0];
    if (!w) return null;
    const rect: any = w.getRectangle?.();
    if (rect && typeof rect?.x === "number") {
      return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
    }
    if (Array.isArray(rect) && rect.length === 4) {
      const [left, bottom, right, top] = rect as any;
      return { x: left, y: bottom, width: right - left, height: top - bottom };
    }
  } catch {}
  return null;
}

// Função auxiliar para desenhar texto em campo de uma linha com fonte personalizada
function drawSingleLineField(
  form: any,
  page: PDFPage,
  font: PDFFont,
  fieldName: string,
  text: string,
  fontSize: number
): boolean {
  try {
    const area = getFieldRectSafe(form, fieldName);
    if (!area) return false;
    
    setTextSafe(form, fieldName, "");
    const x = area.x + 2;
    const textToDraw = text || "";
    
    // Calcular Y: mesma lógica dos campos multi-linha
    // area.y é a base do campo, então area.y + height é o topo
    const lineHeightFactor = 1.05;
    const y = area.y + area.height - (fontSize * lineHeightFactor) + 1;
    
    // Quebrar texto se necessário para caber na largura
    let finalText = textToDraw;
    if (font.widthOfTextAtSize(finalText, fontSize) > area.width - 4) {
      // Encontrar o máximo de caracteres que cabem
      let chars = finalText.length;
      while (chars > 0 && font.widthOfTextAtSize(finalText.slice(0, chars), fontSize) > area.width - 4) {
        chars--;
      }
      finalText = finalText.slice(0, chars);
    }
    
    page.drawText(finalText, { x, y, size: fontSize, font, color: rgb(0, 0, 0) });
    return true;
  } catch {
    return false;
  }
}

// Função auxiliar para desenhar texto em campos multi-linha com fonte personalizada
function drawMultiLineField(
  form: any,
  page: PDFPage,
  font: PDFFont,
  fieldNames: string[],
  text: string,
  fontSize: number,
  maxLines: number
): boolean {
  try {
    const areas = fieldNames.map(name => getFieldRectSafe(form, name)).filter(Boolean) as Array<{ x: number; y: number; width: number; height: number }>;
    if (areas.length === 0) return false;
    
    // Limpar campos apenas se vamos desenhar com sucesso
    fieldNames.forEach(name => setTextSafe(form, name, ""));
    
    const minWidth = Math.min(...areas.map(a => a.width)) - 4;
    const x = areas[0].x + 2;
    
    // Quebrar texto em linhas
    const lines = wrapByWidth(text, font, fontSize, minWidth, maxLines);
    const lineHeight = fontSize * 1.05;
    
    // Desenhar cada linha em sua respectiva área
    for (let i = 0; i < Math.min(lines.length, maxLines, areas.length); i++) {
      const area = areas[i];
      const y = area.y + area.height - lineHeight + 1;
      page.drawText(lines[i] || "", { x, y, size: fontSize, font, color: rgb(0, 0, 0) });
    }
    
    return true;
  } catch {
    return false;
  }
}

const getOrigemCodigo = (value?: string) => {
  if (!value) return "";
  const [codigo] = value.split("-");
  return codigo?.trim() ?? "";
};

const formatDateBr = (value?: string) => {
  if (!value) return "";
  const [datePart] = value.split("T");
  const match = datePart?.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (match) {
    const [, year, month, day] = match;
    return `${day}/${month}/${year}`;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "";
  }

  return parsed.toLocaleDateString("pt-BR");
};

const normalizeHour = (hour?: string) => (hour ? hour.replace(/\s+/g, "") : hour);

const drawMark = (
  page: PDFPage,
  font: PDFFont,
  pageHeight: number,
  x: number,
  yFromTop: number,
  size = 12,
) => {
  page.drawText("X", {
    x,
    y: pageHeight - yFromTop,
    size,
    font,
    color: rgb(0, 0, 0),
  });
};

// Helpers para checkbox
function setCheckboxSafe(form: any, fieldName: string, checked: boolean) {
  try {
    const cb = form.getCheckBox(fieldName);
    if (checked) cb.check(); else cb.uncheck();
    return true;
  } catch {
    return false;
  }
}

function setMauUso(form: any, value?: string) {
  const isSim = value === "sim";
  const isNao = value === "nao";

  // Tentar como CheckBox
  const simOk = setCheckboxSafe(form, "Check1", isSim);
  const naoOk = setCheckboxSafe(form, "Check2", isNao);

  // Fallback: escrever como TextField (alguns templates usam TextField)
  if (!simOk) setTextSafe(form, "Check1", isSim ? "X" : "");
  if (!naoOk) setTextSafe(form, "Check2", isNao ? "X" : "");
}

const getOptionCode = (value?: string) => {
  if (!value) return "";
  const [codigo] = value.split("-");
  return (codigo || "").trim();
};

export const generateRatPDF = async (formData: RatFormData) => {
  try {
    log("Carregando template RAT...");
    const pdfBytes = await fetch(ratTemplateUrl).then((res) => res.arrayBuffer());

    const pdfDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
    const form = pdfDoc.getForm();
    const page = pdfDoc.getPages()[0];
    const pageHeight = page.getHeight();
    const font = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    // Limpa qualquer valor pré-existente no template antes de preencher
    try {
      form.getFields().forEach((field) => {
        if (field instanceof PDFTextField) {
          field.setText("");
        }
      });
    } catch (e) {
      log("Não foi possível limpar os campos do formulário:", e);
    }

    // Carregar preferências de fonte
    const prefs = loadPreferences();
    const preferred = prefs.pdfSolutionFont && prefs.pdfSolutionFont !== "auto" ? Number(prefs.pdfSolutionFont) : null;

    // IDENTIFICAÇÃO
    setTextSafe(form, "CódigodaLoja", formData.codigoLoja);
    setTextSafe(form, "PDV", formData.pdv);
    setTextSafe(form, "FSA", formData.fsa);
    
    // Endereço, Cidade e UF com fonte personalizada se escolhida
    if (preferred !== null) {
      drawSingleLineField(form, page, font, "Endereço", formData.endereco || "", preferred) || setTextSafe(form, "Endereço", formData.endereco);
      drawSingleLineField(form, page, font, "Cidade", formData.cidade || "", preferred) || setTextSafe(form, "Cidade", formData.cidade);
      drawSingleLineField(form, page, font, "UF", formData.uf || "", preferred) || setTextSafe(form, "UF", formData.uf);
    } else {
      setTextSafe(form, "Endereço", formData.endereco);
      setTextSafe(form, "Cidade", formData.cidade);
      setTextSafe(form, "UF", formData.uf);
    }
    
    setTextSafe(form, "Nomedosolicitante", formData.nomeSolicitante);

    // EQUIPAMENTOS ENVOLVIDOS - Removido

    // DADOS DO EQUIPAMENTO
    setTextSafe(form, "Serial", formData.serial);
    setTextSafe(form, "Patrimonio", formData.patrimonio);
    setTextSafe(form, "Marca", formData.marca);
    setTextSafe(form, "Modelo", formData.modelo);

    const possuiTroca =
      formData.houveTroca === "sim" || (!formData.houveTroca && !!formData.origemEquipamento);

    if (possuiTroca) {
      if (formData.origemEquipamento) {
        const origemOption = origemEquipamentoOptions.find(
          (option) => option.value === formData.origemEquipamento,
        );
        if (origemOption) {
          setTextSafe(form, "Origem", getOrigemCodigo(origemOption.value));
        } else if (formData.equipNovoRecond) {
          setTextSafe(form, "Origem", formData.equipNovoRecond);
        }
      } else if (formData.equipNovoRecond) {
        setTextSafe(form, "Origem", formData.equipNovoRecond);
      }

      if (formData.numeroSerieTroca) {
        setTextSafe(form, "SerialNovo", formData.numeroSerieTroca);
      }
      setTextSafe(form, "MarcaNovo", formData.marcaTroca);
      setTextSafe(form, "ModeloNovo", formData.modeloTroca);
    }

    // PEÇAS/CABOS - Removido
    
    // PEÇAS IMPRESSORA - Removido

    // MAU USO (Check1 = Sim, Check2 = Não)
    setMauUso(form, formData.mauUso);

    // Observações (multi-linha, só texto digitado)
    const obsLines = splitLinesAuto(formData.observacoesPecas, 3, 70);
    setTextSafe(form, "Row1", obsLines[0]);
    setTextSafe(form, "Row2", obsLines[1]);
    setTextSafe(form, "Row3", obsLines[2]);

    // Defeito/Problema (2 linhas de 60) - com fonte personalizada se escolhida
    if (preferred !== null) {
      const defeitoDrawn = drawMultiLineField(form, page, font, ["DefeitoProblemaRow1", "DefeitoProblemaRow2"], formData.defeitoProblema || "", preferred, 2);
      if (!defeitoDrawn) {
        const defeitoLines = splitLinesAuto(formData.defeitoProblema, 2, 60);
        setTextSafe(form, "DefeitoProblemaRow1", defeitoLines[0]);
        setTextSafe(form, "DefeitoProblemaRow2", defeitoLines[1]);
      }
    } else {
      const defeitoLines = splitLinesAuto(formData.defeitoProblema, 2, 60);
      setTextSafe(form, "DefeitoProblemaRow1", defeitoLines[0]);
      setTextSafe(form, "DefeitoProblemaRow2", defeitoLines[1]);
    }
    
    // Diagnóstico/Testes realizados (4x75) - com fonte personalizada se escolhida
    if (preferred !== null) {
      const diagnosticoDrawn = drawMultiLineField(form, page, font, ["DiagnósticoTestesrealizadosRow1", "DiagnósticoTestesrealizadosRow2", "DiagnósticoTestesrealizadosRow3", "DiagnósticoTestesrealizadosRow4"], formData.diagnosticoTestes || "", preferred, 4);
      if (!diagnosticoDrawn) {
        const diagnosticoLines = splitLinesAuto(formData.diagnosticoTestes, 4, 75);
        setTextSafe(form, "DiagnósticoTestesrealizadosRow1", diagnosticoLines[0]);
        setTextSafe(form, "DiagnósticoTestesrealizadosRow2", diagnosticoLines[1]);
        setTextSafe(form, "DiagnósticoTestesrealizadosRow3", diagnosticoLines[2]);
        setTextSafe(form, "DiagnósticoTestesrealizadosRow4", diagnosticoLines[3]);
      }
    } else {
      const diagnosticoLines = splitLinesAuto(formData.diagnosticoTestes, 4, 75);
      setTextSafe(form, "DiagnósticoTestesrealizadosRow1", diagnosticoLines[0]);
      setTextSafe(form, "DiagnósticoTestesrealizadosRow2", diagnosticoLines[1]);
      setTextSafe(form, "DiagnósticoTestesrealizadosRow3", diagnosticoLines[2]);
      setTextSafe(form, "DiagnósticoTestesrealizadosRow4", diagnosticoLines[3]);
    }
    
    // SOLUÇÃO: sempre desenhar manualmente para aplicar fonte personalizada
    const solucaoLines = splitLinesAuto(formData.solucao, 2, 75);
    const solucaoSug = solucaoLines.join("");
    // Se o texto que coube é menor que o texto total (ignorando espaços)
    const hasOverflow = (solucaoSug.replace(/\s/g, "")).length < (formData.solucao || "").replace(/\s/g, "").length;
    
    // Se o usuário escolheu um tamanho específico OU há overflow, desenhar manualmente
    if (preferred !== null || hasOverflow) {
      try {
        const area1 = getFieldRectSafe(form, "SoluçãoRow1");
        const area2 = getFieldRectSafe(form, "SoluçãoRow2");
        if (area1 && area2) {
          setTextSafe(form, "SoluçãoRow1", "");
          setTextSafe(form, "SoluçãoRow2", "");
          const x = area1.x + 2;
          const width = Math.min(area1.width, area2.width) - 4;
          const availableHeight = area1.height + area2.height - 2;
          const lineHeightFactor = 1.05;
          let fontSize = preferred || 10;
          const minFont = preferred ? Math.max(7.5, preferred) : 7.5;
          let lines: string[] = [];
          let lineHeight = fontSize * lineHeightFactor;
          
          // Se há fonte preferida, usar ela diretamente (só reduzir se overflow)
          if (preferred && !hasOverflow) {
            lines = wrapByWidth(formData.solucao || "", font, fontSize, width, 2);
            lineHeight = fontSize * lineHeightFactor;
          } else {
            // Modo adaptativo: reduzir até caber
            while (fontSize >= minFont) {
              lines = wrapByWidth(formData.solucao || "", font, fontSize, width, 2);
              lineHeight = fontSize * lineHeightFactor;
              const fitsH = (lineHeight * 2) <= availableHeight;
              const fitsW = lines.every(l => font.widthOfTextAtSize(l, fontSize) <= width);
              if (fitsH && fitsW) break;
              fontSize -= 0.5;
            }
          }
          
          const y1 = Math.max(area1.y + area1.height, area2.y + area2.height) - lineHeight + 1;
          page.drawText(lines[0] || "", { x, y: y1, size: fontSize, font, color: rgb(0,0,0) });
          const y2 = y1 - lineHeight;
          page.drawText(lines[1] || "", { x, y: y2, size: fontSize, font, color: rgb(0,0,0) });
        } else {
          setTextSafe(form, "SoluçãoRow1", solucaoLines[0]);
          setTextSafe(form, "SoluçãoRow2", solucaoLines[1]);
        }
      } catch {
        setTextSafe(form, "SoluçãoRow1", solucaoLines[0]);
        setTextSafe(form, "SoluçãoRow2", solucaoLines[1]);
      }
    } else {
      // Tudo coube! Use modo seguro via campo de formulário
      setTextSafe(form, "SoluçãoRow1", solucaoLines[0]);
      setTextSafe(form, "SoluçãoRow2", solucaoLines[1]);
    }

    // PROBLEMA RESOLVIDO
    if (formData.problemaResolvido === "sim") {
      setTextSafe(form, "SimProblemaresolvido", "X");
    } else if (formData.problemaResolvido === "nao") {
      setTextSafe(form, "NãoProblemaresolvido", "X");
      setTextSafe(form, "Motivo", formData.motivoNaoResolvido);
    }

    // HAVERÁ RETORNO
    if (formData.haveraRetorno === "sim") {
      setTextSafe(form, "SimHaveráretorno", "X");
    } else if (formData.haveraRetorno === "nao") {
      setTextSafe(form, "NãoHaveráretorno", "X");
    }

    // HORÁRIOS E DATA
    setTextSafe(form, "Horainício", normalizeHour(formData.horaInicio));
    setTextSafe(form, "Horatérmino", normalizeHour(formData.horaTermino));
    
    setTextSafe(form, "DATA", formatDateBr(formData.data));

    // CLIENTE
    setTextSafe(form, "NOMELEGÍVEL", formData.clienteNome);
    setTextSafe(form, "RGOUMATRÍCULA", formData.clienteRgMatricula);
    setTextSafe(form, "TELEFONE", formData.clienteTelefone);

    // PRESTADOR
    setTextSafe(form, "NOMELEGÍVEL_2", formData.prestadorNome);
    setTextSafe(form, "MATRÍCULA", formData.prestadorRgMatricula);
    setTextSafe(form, "TELEFONE_2", formData.prestadorTelefone);

    // Preencher campos dos dropdowns dinâmicos no PDF
    if (formData.equipamentoSelecionado) {
      setTextSafe(form, "EquipamentoEnvolvido", formData.equipamentoSelecionado);
    }
    if (formData.pecaSelecionada) {
      setTextSafe(form, "PecaEnvolvida", formData.pecaSelecionada);
    }
    if (formData.opcaoExtraZebra) {
      setTextSafe(form, "OpcaoExtraZebra", formData.opcaoExtraZebra);
    }

    // Preenchimento dos campos de Equipamento/Peça/Opção Zebra, conforme nomes novos do PDF.
    setTextSafe(form, "1", getOptionCode(formData.equipamentoSelecionado));
    setTextSafe(form, "2", getOptionCode(formData.pecaSelecionada));
    setTextSafe(form, "3", getOptionCode(formData.opcaoExtraZebra));

    // Achatar o formulário para tornar os campos não-editáveis
    try {
      form.flatten();
    } catch (e) {
      log("Não foi possível achatar o formulário:", e);
    }

    // Salvar e fazer download do PDF com nome personalizado
    const bytes = await pdfDoc.save();
    const blob = new Blob([new Uint8Array(Array.from(bytes)).buffer], { type: "application/pdf" });
    const url = URL.createObjectURL(blob);
    
    // Nome do arquivo baseado no FSA se disponível
    const fsaNumber = formData.fsa?.trim();
    const fileName = fsaNumber ? `FSA-${fsaNumber}.pdf` : `FSA-${Date.now()}.pdf`;
    
    // Criar link de download e clicar
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    log("PDF gerado com sucesso!");
    return { url };
  } catch (error) {
    console.error("[RAT] Erro ao gerar PDF:", error);
    throw error;
  }
};

// Gera o PDF e retorna um Blob/URL para uso em pré-visualização (não abre janela)
export const generateRatPDFBlob = async (formData: RatFormData) => {
  try {
    const pdfBytes = await fetch(ratTemplateUrl).then((res) => res.arrayBuffer());
    const pdfDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
    const form = pdfDoc.getForm();
    const page = pdfDoc.getPages()[0];
    const pageHeight = page.getHeight();
    const font = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    // Reusar o preenchimento chamando a própria função acima seria ideal, mas ela abre janela.
    // Portanto replicamos o preenchimento chamando internamente esta mesma lógica.

    try {
      form.getFields().forEach((field) => {
        if (field instanceof PDFTextField) field.setText("");
      });
    } catch {}

    // Carregar preferências de fonte
    const prefs = loadPreferences();
    const preferred = prefs.pdfSolutionFont && prefs.pdfSolutionFont !== "auto" ? Number(prefs.pdfSolutionFont) : null;

    // IDENTIFICAÇÃO
    setTextSafe(form, "CódigodaLoja", formData.codigoLoja);
    setTextSafe(form, "PDV", formData.pdv);
    setTextSafe(form, "FSA", formData.fsa);
    
    // Endereço, Cidade e UF com fonte personalizada se escolhida
    if (preferred !== null) {
      drawSingleLineField(form, page, font, "Endereço", formData.endereco || "", preferred) || setTextSafe(form, "Endereço", formData.endereco);
      drawSingleLineField(form, page, font, "Cidade", formData.cidade || "", preferred) || setTextSafe(form, "Cidade", formData.cidade);
      drawSingleLineField(form, page, font, "UF", formData.uf || "", preferred) || setTextSafe(form, "UF", formData.uf);
    } else {
      setTextSafe(form, "Endereço", formData.endereco);
      setTextSafe(form, "Cidade", formData.cidade);
      setTextSafe(form, "UF", formData.uf);
    }
    
    setTextSafe(form, "Nomedosolicitante", formData.nomeSolicitante);

    setTextSafe(form, "Serial", formData.serial);
    setTextSafe(form, "Patrimonio", formData.patrimonio);
    setTextSafe(form, "Marca", formData.marca);
    setTextSafe(form, "Modelo", formData.modelo);

    const possuiTroca = formData.houveTroca === "sim" || (!formData.houveTroca && !!formData.origemEquipamento);
    if (possuiTroca) {
      if (formData.origemEquipamento) {
        const origemOption = origemEquipamentoOptions.find((option) => option.value === formData.origemEquipamento);
        if (origemOption) setTextSafe(form, "Origem", getOrigemCodigo(origemOption.value));
        else if (formData.equipNovoRecond) setTextSafe(form, "Origem", formData.equipNovoRecond);
      } else if (formData.equipNovoRecond) setTextSafe(form, "Origem", formData.equipNovoRecond);
      if (formData.numeroSerieTroca) setTextSafe(form, "SerialNovo", formData.numeroSerieTroca);
      setTextSafe(form, "MarcaNovo", formData.marcaTroca);
      setTextSafe(form, "ModeloNovo", formData.modeloTroca);
    }

    setMauUso(form, formData.mauUso);

    const obsLines = splitLinesAuto(formData.observacoesPecas, 3, 70);
    setTextSafe(form, "Row1", obsLines[0]);
    setTextSafe(form, "Row2", obsLines[1]);
    setTextSafe(form, "Row3", obsLines[2]);

    // Defeito/Problema (2 linhas de 60) - com fonte personalizada se escolhida
    if (preferred !== null) {
      const defeitoDrawn = drawMultiLineField(form, page, font, ["DefeitoProblemaRow1", "DefeitoProblemaRow2"], formData.defeitoProblema || "", preferred, 2);
      if (!defeitoDrawn) {
        const defeitoLines = splitLinesAuto(formData.defeitoProblema, 2, 60);
        setTextSafe(form, "DefeitoProblemaRow1", defeitoLines[0]);
        setTextSafe(form, "DefeitoProblemaRow2", defeitoLines[1]);
      }
    } else {
      const defeitoLines = splitLinesAuto(formData.defeitoProblema, 2, 60);
      setTextSafe(form, "DefeitoProblemaRow1", defeitoLines[0]);
      setTextSafe(form, "DefeitoProblemaRow2", defeitoLines[1]);
    }
    
    // Diagnóstico/Testes realizados (4x75) - com fonte personalizada se escolhida
    if (preferred !== null) {
      const diagnosticoDrawn = drawMultiLineField(form, page, font, ["DiagnósticoTestesrealizadosRow1", "DiagnósticoTestesrealizadosRow2", "DiagnósticoTestesrealizadosRow3", "DiagnósticoTestesrealizadosRow4"], formData.diagnosticoTestes || "", preferred, 4);
      if (!diagnosticoDrawn) {
        const diagnosticoLines = splitLinesAuto(formData.diagnosticoTestes, 4, 75);
        setTextSafe(form, "DiagnósticoTestesrealizadosRow1", diagnosticoLines[0]);
        setTextSafe(form, "DiagnósticoTestesrealizadosRow2", diagnosticoLines[1]);
        setTextSafe(form, "DiagnósticoTestesrealizadosRow3", diagnosticoLines[2]);
        setTextSafe(form, "DiagnósticoTestesrealizadosRow4", diagnosticoLines[3]);
      }
    } else {
      const diagnosticoLines = splitLinesAuto(formData.diagnosticoTestes, 4, 75);
      setTextSafe(form, "DiagnósticoTestesrealizadosRow1", diagnosticoLines[0]);
      setTextSafe(form, "DiagnósticoTestesrealizadosRow2", diagnosticoLines[1]);
      setTextSafe(form, "DiagnósticoTestesrealizadosRow3", diagnosticoLines[2]);
      setTextSafe(form, "DiagnósticoTestesrealizadosRow4", diagnosticoLines[3]);
    }

    const solucaoLines = splitLinesAuto(formData.solucao, 2, 75);
    const solucaoSug = solucaoLines.join("");
    const hasOverflow = (solucaoSug.replace(/\s/g, "")).length < (formData.solucao || "").replace(/\s/g, "").length;
    
    if (preferred !== null || hasOverflow) {
      try {
        const area1 = getFieldRectSafe(form, "SoluçãoRow1");
        const area2 = getFieldRectSafe(form, "SoluçãoRow2");
        if (area1 && area2) {
          setTextSafe(form, "SoluçãoRow1", "");
          setTextSafe(form, "SoluçãoRow2", "");
          const x = area1.x + 2;
          const width = Math.min(area1.width, area2.width) - 4;
          const availableHeight = area1.height + area2.height - 2;
          const lineHeightFactor = 1.05;
          let fontSize = preferred || 10;
          const minFont = preferred ? Math.max(7.5, preferred) : 7.5;
          let lines: string[] = [];
          let lineHeight = fontSize * lineHeightFactor;
          
          if (preferred && !hasOverflow) {
            lines = wrapByWidth(formData.solucao || "", font, fontSize, width, 2);
            lineHeight = fontSize * lineHeightFactor;
          } else {
            while (fontSize >= minFont) {
              lines = wrapByWidth(formData.solucao || "", font, fontSize, width, 2);
              lineHeight = fontSize * lineHeightFactor;
              const fitsH = (lineHeight * 2) <= availableHeight;
              const fitsW = lines.every(l => font.widthOfTextAtSize(l, fontSize) <= width);
              if (fitsH && fitsW) break;
              fontSize -= 0.5;
            }
          }
          
          const y1 = Math.max(area1.y + area1.height, area2.y + area2.height) - lineHeight + 1;
          page.drawText(lines[0] || "", { x, y: y1, size: fontSize, font, color: rgb(0,0,0) });
          const y2 = y1 - lineHeight;
          page.drawText(lines[1] || "", { x, y: y2, size: fontSize, font, color: rgb(0,0,0) });
        } else {
          setTextSafe(form, "SoluçãoRow1", solucaoLines[0]);
          setTextSafe(form, "SoluçãoRow2", solucaoLines[1]);
        }
      } catch {
        setTextSafe(form, "SoluçãoRow1", solucaoLines[0]);
        setTextSafe(form, "SoluçãoRow2", solucaoLines[1]);
      }
    } else {
      setTextSafe(form, "SoluçãoRow1", solucaoLines[0]);
      setTextSafe(form, "SoluçãoRow2", solucaoLines[1]);
    }

    if (formData.problemaResolvido === "sim") {
      setTextSafe(form, "SimProblemaresolvido", "X");
    } else if (formData.problemaResolvido === "nao") {
      setTextSafe(form, "NãoProblemaresolvido", "X");
      setTextSafe(form, "Motivo", formData.motivoNaoResolvido);
    }

    if (formData.haveraRetorno === "sim") setTextSafe(form, "SimHaveráretorno", "X");
    else if (formData.haveraRetorno === "nao") setTextSafe(form, "NãoHaveráretorno", "X");

    setTextSafe(form, "Horainício", normalizeHour(formData.horaInicio));
    setTextSafe(form, "Horatérmino", normalizeHour(formData.horaTermino));
    setTextSafe(form, "DATA", formatDateBr(formData.data));

    setTextSafe(form, "NOMELEGÍVEL", formData.clienteNome);
    setTextSafe(form, "RGOUMATRÍCULA", formData.clienteRgMatricula);
    setTextSafe(form, "TELEFONE", formData.clienteTelefone);
    setTextSafe(form, "NOMELEGÍVEL_2", formData.prestadorNome);
    setTextSafe(form, "MATRÍCULA", formData.prestadorRgMatricula);
    setTextSafe(form, "TELEFONE_2", formData.prestadorTelefone);

    setTextSafe(form, "1", getOptionCode(formData.equipamentoSelecionado));
    setTextSafe(form, "2", getOptionCode(formData.pecaSelecionada));
    setTextSafe(form, "3", getOptionCode(formData.opcaoExtraZebra));

    try { form.flatten(); } catch {}

    const bytes = await pdfDoc.save();
    const blob = new Blob([new Uint8Array(Array.from(bytes)).buffer], { type: "application/pdf" });
    const url = URL.createObjectURL(blob);
    return { blob, url };
  } catch (error) {
    console.error("[RAT] Erro ao gerar PDF (preview):", error);
    throw error;
  }
};
