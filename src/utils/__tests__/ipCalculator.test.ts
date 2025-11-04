import { describe, expect, it } from "vitest";
import { calcularIP } from "../ipCalculator";

describe("calcularIP", () => {
  it("gera IP válido para PDV acima de 300", () => {
    const resultado = calcularIP("10.10.10.0", "PDV", "305");
    expect(resultado.ip).toBe("10.10.10.105");
    expect(resultado.gateway).toBe("10.10.10.254");
    expect(resultado.mascara).toBe("255.255.255.0");
  });

  it("lança erro quando PDV é inválido", () => {
    expect(() => calcularIP("10.10.10.0", "PDV", "200")).toThrow();
  });

  it("atribui IP padrão para impressora Zebra 1", () => {
    const resultado = calcularIP("10.50.20.0", "Impressora Zebra 1");
    expect(resultado.ip).toBe("10.50.20.19");
    expect(resultado.mascara).toBe("255.255.255.128");
  });
});
