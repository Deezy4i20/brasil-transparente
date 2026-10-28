import { describe, expect, it } from "vitest";
import { mesCompleto, mesesParciais, naturezaDivida, variacao } from "../src/lib/auditoria";

describe("natureza da despesa com a dívida", () => {
  it("identifica refinanciamento pela ação (com e sem acento)", () => {
    expect(naturezaDivida("REFINANCIAMENTO DA DIVIDA PUBLICA MOBILIARIA FEDERAL INTERNA", "6")).toBe(1);
    expect(naturezaDivida("Refinanciamento da Dívida Pública Mobiliária Federal Externa", "6")).toBe(1);
  });
  it("juros (GND 2) e amortização fora do refinanciamento (GND 6) são serviço da dívida", () => {
    expect(naturezaDivida("SERVICOS DA DIVIDA PUBLICA FEDERAL INTERNA", "2")).toBe(2);
    expect(naturezaDivida("SERVICOS DA DIVIDA PUBLICA FEDERAL INTERNA", "6")).toBe(2);
  });
  it("demais despesas ficam como 0", () => {
    expect(naturezaDivida("PISO DE ATENCAO PRIMARIA A SAUDE", "3")).toBe(0);
    expect(naturezaDivida("TRANSFERENCIA AO FUNDO DE PARTICIPACAO DOS MUNICIPIOS - FPM", "3")).toBe(0);
  });
});

describe("meses incompletos", () => {
  it("arquivo do mês baixado antes do fim do mês é parcial", () => {
    expect(mesCompleto("202610", "2026-10-27T17:51:13.942Z")).toBe(false);
  });
  it("arquivo baixado depois da virada (horário de Brasília) é completo", () => {
    expect(mesCompleto("202609", "2026-10-27T17:51:13.942Z")).toBe(true);
    expect(mesCompleto("202610", "2026-11-01T03:00:00.000Z")).toBe(true);
    expect(mesCompleto("202610", "2026-11-01T02:59:59.000Z")).toBe(false); // ainda 31/10 em Brasília
  });
  it("dezembro vira o ano corretamente", () => {
    expect(mesCompleto("202512", "2026-01-01T03:00:00.000Z")).toBe(true);
    expect(mesCompleto("202512", "2025-12-31T20:00:00.000Z")).toBe(false);
  });
  it("lista os meses parciais e ignora períodos não mensais", () => {
    expect(mesesParciais([{ periodo: "202609", baixadoEm: "2026-10-27T00:00:00Z" }, { periodo: "202610", baixadoEm: "2026-10-27T00:00:00Z" }, { periodo: "2026", baixadoEm: "2026-01-02T00:00:00Z" }])).toEqual([10]);
  });
});

describe("variação percentual", () => {
  it("calcula a variação relativa", () => {
    expect(variacao(110, 100)).toBeCloseTo(0.1);
    expect(variacao(90, 100)).toBeCloseTo(-0.1);
  });
  it("nunca devolve NaN ou infinito", () => {
    expect(variacao(10, 0)).toBeNull();
    expect(variacao(0, 0)).toBeNull();
    expect(variacao(null, 10)).toBeNull();
    expect(variacao(10, undefined)).toBeNull();
    expect(variacao(Number.NaN, 10)).toBeNull();
  });
  it("base negativa usa o módulo", () => {
    expect(variacao(-50, -100)).toBeCloseTo(0.5);
  });
});
