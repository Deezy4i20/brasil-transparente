import { describe, expect, it } from "vitest";
import { consultar, topN } from "../src/lib/dados/consulta";
import type { Cubo } from "../src/lib/dados/tipos";

const cubo: Cubo = {
  versao: 1,
  conjunto: "execucao",
  ano: 2026,
  dimensoes: ["mes", "funcao", "uf"],
  medidas: ["empenhado", "pago"],
  dicionarios: {
    funcao: [{ cod: "10", nome: "Saúde" }, { cod: "12", nome: "Educação" }],
    uf: [{ cod: "SP", nome: "São Paulo" }, { cod: "BA", nome: "Bahia" }, { cod: "NI", nome: "Localização não identificada" }],
  },
  linhas: [
    [1, 0, 0, 100.1, 50.05],
    [2, 0, 0, 100.2, 60.1],
    [1, 1, 1, 30, 20],
    [3, 1, 2, 10, 5],
  ],
};

describe("motor de consulta", () => {
  it("soma cada medida separadamente, sem misturar etapas", () => {
    const r = consultar(cubo);
    expect(r.total).toEqual({ empenhado: 240.3, pago: 135.15 });
  });
  it("aplica filtros por código e intervalo de meses", () => {
    const r = consultar(cubo, { filtros: { funcao: ["10"] }, meses: [1, 1] });
    expect(r.total.pago).toBe(50.05);
    expect(r.filtrosAplicados.sort()).toEqual(["funcao", "mes"]);
  });
  it("reporta filtros não aplicáveis em vez de ignorá-los em silêncio", () => {
    const r = consultar(cubo, { filtros: { orgaoSuperior: ["36000"] } });
    expect(r.filtrosNaoAplicaveis).toEqual(["orgaoSuperior"]);
    expect(r.total.pago).toBe(135.15);
  });
  it("agrupa e preserva código e nome oficiais", () => {
    const r = consultar(cubo, { agrupar: ["uf"] });
    const sp = r.grupos.find((g) => (g.chave.uf as { cod: string }).cod === "SP")!;
    expect(sp.valores.pago).toBe(110.15);
    expect((sp.chave.uf as { nome: string }).nome).toBe("São Paulo");
    const ni = r.grupos.find((g) => (g.chave.uf as { cod: string }).cod === "NI")!;
    expect(ni.valores.pago).toBe(5);
  });
  it("soma dos grupos = total (sem duplicidade)", () => {
    const r = consultar(cubo, { agrupar: ["mes", "funcao"] });
    const s = r.grupos.reduce((a, g) => a + Math.round(g.valores.empenhado * 100), 0) / 100;
    expect(s).toBe(r.total.empenhado);
  });
  it("topN agrega o restante em “demais”", () => {
    const r = consultar(cubo, { agrupar: ["uf"] });
    const t = topN(r.grupos, "pago", 1);
    expect(t.top).toHaveLength(1);
    expect(t.quantidadeDemais).toBe(2);
    expect(t.demais).toBe(25);
  });
  it("filtro sem correspondência zera o resultado", () => {
    expect(consultar(cubo, { filtros: { uf: ["RJ"] } }).total.pago).toBe(0);
  });
});
