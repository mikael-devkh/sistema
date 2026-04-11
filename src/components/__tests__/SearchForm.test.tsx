import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { SearchForm } from "../SearchForm";

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

describe("SearchForm", () => {
  it("envia valores válidos para o callback", async () => {
    const user = userEvent.setup();
    const handleSearch = vi.fn();

    render(<SearchForm onSearch={handleSearch} />);

    await user.type(screen.getByLabelText(/loja/i), "1234");
    await user.clear(screen.getByLabelText(/número do pdv/i));
    await user.type(screen.getByLabelText(/número do pdv/i), "305");

    const submitButton = screen.getByRole("button", {
      name: /gerar configuração de ip/i,
    });
    await user.click(submitButton);

    expect(handleSearch).toHaveBeenCalledWith("1234", "PDV", "305");
  });
});
