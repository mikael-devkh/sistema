import type { ComponentType } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";

vi.mock("../../components/Navigation", () => ({
  Navigation: () => <div data-testid="nav" />,
}));

vi.mock("../../hooks/use-haptic-feedback", () => ({
  useHapticFeedback: () => ({ trigger: vi.fn() }),
}));

vi.mock("../../context/RatAutofillContext", () => ({
  useRatAutofill: () => ({
    autofillData: { isAvailable: false },
    clearAutofillData: vi.fn(),
    setAutofillData: vi.fn(),
  }),
}));

vi.mock("../../context/AuthContext", () => ({
  useAuth: () => ({
    user: { uid: "user-1" },
    loadingAuth: false,
    profile: { nome: "Técnico WT", matricula: "RG123" },
    loadingProfile: false,
    refreshProfile: vi.fn(),
    updateProfileLocally: vi.fn(),
  }),
}));

vi.mock("../../utils/ratPdfGenerator", () => ({
  generateRatPDF: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

const loadRatForm = () => require("../RatForm").default as ComponentType;

describe("RatForm", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("pré-preenche o nome do prestador a partir do perfil", async () => {
    const RatForm = loadRatForm();

    render(
      <MemoryRouter>
        <RatForm />
      </MemoryRouter>,
    );

    const nomeInput = screen.getByLabelText(/nome legível/i) as HTMLInputElement;
    expect(nomeInput.value).toBe("Técnico WT");
    const matriculaInput = screen.getByLabelText(/rg ou matrícula/i) as HTMLInputElement;
    expect(matriculaInput.value).toBe("RG123");
  });

  it("permite recuperar um rascunho salvo", async () => {
    const draft = {
      codigoLoja: "9999",
      defeitoProblema: "Teste de defeito",
    };
    localStorage.setItem("ratFormDraft", JSON.stringify(draft));

    const RatForm = loadRatForm();
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <RatForm />
      </MemoryRouter>,
    );

    const defeitoField = screen.getByLabelText(/defeito/i) as HTMLTextAreaElement;
    expect(defeitoField.value).toContain("Teste de defeito");

    await user.click(screen.getByRole("button", { name: /recuperar rascunho/i }));
    expect(defeitoField.value).toContain("Teste de defeito");
  });
});
