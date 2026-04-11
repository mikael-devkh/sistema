import { Procedure, mockProcedures } from "../data/troubleshootingData";
import { RatTemplate, ratTemplates } from "../data/ratTemplatesData";
import { toast } from "sonner";

const LOCAL_STORAGE_KEY_PROCEDURES = "kb_procedures_data";
const LOCAL_STORAGE_KEY_TEMPLATES = "rat_templates_data";

interface EditableSnapshot {
  procedures: Procedure[];
  templates: RatTemplate[];
}

// Helper para fazer parse de JSON com segurança e tratamento de erro
function safeParseJson<T>(jsonString: string | null, fallbackData: T): T {
  if (!jsonString) {
    return fallbackData;
  }

  try {
    const parsed = JSON.parse(jsonString) as T;
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed;
    }
    return fallbackData;
  } catch (error) {
    console.error("Erro ao fazer parse do JSON no Local Storage:", error);
    return fallbackData;
  }
}

export function loadEditableProcedures(): Procedure[] {
  const storedProcedures =
    typeof window !== "undefined" ? localStorage.getItem(LOCAL_STORAGE_KEY_PROCEDURES) : null;
  return safeParseJson(storedProcedures, mockProcedures);
}

export function loadEditableTemplates(): RatTemplate[] {
  const storedTemplates =
    typeof window !== "undefined" ? localStorage.getItem(LOCAL_STORAGE_KEY_TEMPLATES) : null;
  return safeParseJson(storedTemplates, ratTemplates);
}

export function saveProceduresToLocalStorage(data: Procedure[]) {
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY_PROCEDURES, JSON.stringify(data, null, 2));
  } catch (error) {
    console.error("Erro ao salvar procedimentos no Local Storage:", error);
    toast.error("Erro ao salvar procedimentos.");
  }
}

export function saveTemplatesToLocalStorage(data: RatTemplate[]) {
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY_TEMPLATES, JSON.stringify(data, null, 2));
  } catch (error) {
    console.error("Erro ao salvar templates no Local Storage:", error);
    toast.error("Erro ao salvar templates de RAT.");
  }
}

export function resetToDefaults(): EditableSnapshot {
  if (typeof window !== "undefined") {
    localStorage.removeItem(LOCAL_STORAGE_KEY_PROCEDURES);
    localStorage.removeItem(LOCAL_STORAGE_KEY_TEMPLATES);
  }
  toast.info("Dados locais removidos. Os valores padrão foram restaurados.");

  return {
    procedures: mockProcedures,
    templates: ratTemplates,
  };
}
