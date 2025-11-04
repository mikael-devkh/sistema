import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  loadEditableProcedures,
  loadEditableTemplates,
  saveProceduresToLocalStorage,
  saveTemplatesToLocalStorage,
  resetToDefaults,
} from "../data-editor-utils";
import { mockProcedures } from "../../data/troubleshootingData";
import { ratTemplates } from "../../data/ratTemplatesData";

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

describe("data-editor-utils", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("carrega dados padrão quando não há overrides", () => {
    expect(loadEditableProcedures()).toEqual(mockProcedures);
    expect(loadEditableTemplates()).toEqual(ratTemplates);
  });

  it("persiste e recarrega templates customizados", () => {
    const custom = [{ ...ratTemplates[0], title: "Template Teste", id: "custom" }];
    saveTemplatesToLocalStorage(custom);
    expect(loadEditableTemplates()).toEqual(custom);
  });

  it("reseta dados locais para o padrão", () => {
    const customProcedures = [{ ...mockProcedures[0], title: "Proc" }];
    saveProceduresToLocalStorage(customProcedures);
    const snapshot = resetToDefaults();
    expect(snapshot.procedures).toEqual(mockProcedures);
    expect(snapshot.templates).toEqual(ratTemplates);
  });
});
