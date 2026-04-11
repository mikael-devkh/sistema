import type { ComponentType } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { MemoryRouter } from "react-router-dom";

const navigateMock = vi.fn();
const signInMock = vi.fn();
const signOutMock = vi.fn();

vi.mock("firebase/auth", () => ({
  signInWithEmailAndPassword: (...args: unknown[]) => signInMock(...args),
  sendPasswordResetEmail: vi.fn(),
  signOut: (...args: unknown[]) => signOutMock(...args),
}));

vi.mock("../../context/AuthContext", () => ({
  useAuth: () => ({ user: null, loadingAuth: false }),
}));

vi.mock("../../firebase", () => ({ auth: {} }));

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

// Re-import component after mocks
const loadLoginPage = () => require("../LoginPage").default as ComponentType;

describe("LoginPage", () => {
  beforeEach(() => {
    navigateMock.mockReset();
    signInMock.mockReset();
    signOutMock.mockReset();
  });

  it("solicita verificação de e-mail quando usuário não está verificado", async () => {
    const user = userEvent.setup();
    signInMock.mockResolvedValue({
      user: { emailVerified: false },
    });

    const LoginPage = loadLoginPage();

    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>,
    );

    await user.type(screen.getByLabelText(/e-mail/i), "tech@wt.com");
    await user.type(screen.getByLabelText(/senha/i), "segredo123");
    await user.click(screen.getByRole("button", { name: /acessar/i }));

    expect(signInMock).toHaveBeenCalled();
    expect(signOutMock).toHaveBeenCalled();
    expect(navigateMock).not.toHaveBeenCalled();
  });
});
