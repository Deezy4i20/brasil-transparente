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

import { carregarIndiceMunicipios, localizarMunicipio } from "../scripts/etl/municipios";
describe("municípios com grafia diferente entre Portal e IBGE", () => {
  const idx = carregarIndiceMunicipios();
  it.each([["SP", "EMBU DAS ARTES", "3515004"], ["RJ", "PARATI", "3303807"], ["SP", "MOGI MIRIM", "3530805"], ["RS", "SANTANA DO LIVRAMENTO", "4317103"], ["RN", "SERRA CAIADA (EX-PRESIDENTE JUSCELINO)", "2410306"], ["RJ", "RIO DE JANEIRO", "3304557"], ["ES", "VITORIA", "3205309"]])("%s %s", (uf, nome, cod) => {
    expect(localizarMunicipio(idx, uf, nome).cod).toBe(cod);
  });
});

import { valorImplausivel } from "../src/lib/auditoria";
describe("valores implausíveis na fonte", () => {
  it("marca registros de R$ 100 bi ou mais", () => {
    expect(valorImplausivel(2_809_000_000_000)).toBe(true);
    expect(valorImplausivel(100e9)).toBe(true);
  });
  it("não marca contratos grandes mas possíveis", () => {
    expect(valorImplausivel(10e9)).toBe(false);
    expect(valorImplausivel(55.8e9)).toBe(false);
    expect(valorImplausivel(null)).toBe(false);
  });
});

import { acumuladoForaDoPadrao } from "../src/lib/auditoria";
describe("valor acumulado fora do padrão", () => {
  it("contrato de R$ 189 mil com acumulado de R$ 29,7 bi", () => expect(acumuladoForaDoPadrao(189_500, 29.7e9)).toBe(true));
  it("renovações normais não são marcadas", () => {
    expect(acumuladoForaDoPadrao(3.42e6, 10.3e6)).toBe(false); // ~3x
    expect(acumuladoForaDoPadrao(160.4e6, 1.9e9)).toBe(false); // ~12x (plano de saúde renovado anualmente)
    expect(acumuladoForaDoPadrao(100_000, 2.5e6)).toBe(false); // 25x mas diferença pequena
  });
});
