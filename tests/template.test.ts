/**
 * Testa as funções de cálculo e formatação que rodam na página (prototipo/modelo.template.html).
 * O trecho é extraído do próprio arquivo, para o teste acompanhar o código publicado.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import vm from "node:vm";
import { describe, expect, it } from "vitest";
import { variacao as variacaoTS } from "../src/lib/auditoria";

const html = readFileSync(join(__dirname, "..", "prototipo", "modelo.template.html"), "utf8");
const trecho = (de: string, ate: string) => { const i = html.indexOf(de), j = html.indexOf(ate, i); if (i < 0 || j < 0) throw new Error(`trecho não encontrado: ${de}`); return html.slice(i, j); };
const linha = (inicio: string) => { const i = html.indexOf(inicio); if (i < 0) throw new Error(inicio); return html.slice(i, html.indexOf("\n", i)); };

const codigo = [
  trecho("const nf1 =", "const esc ="),
  linha("function variacao("),
  linha("function parciais("),
  linha("function mesesUsaveis("),
  linha("function temParcial("),
  linha("function cobre("),
  linha("function mesesEf("),
].join("\n");
const ctx: Record<string, unknown> = { Intl, isFinite, Math, E: { mi: 1, mf: 12, incluirParcial: false }, D: { porAno: {} } };
vm.createContext(ctx);
vm.runInContext(codigo + "\nthis.f = { comp, extenso, pct, cheio, variacao, mesesUsaveis, temParcial, cobre, mesesEf }; this.A = ano => D.porAno[ano];", ctx);
vm.runInContext("var A = this.A;", ctx);
const f = ctx.f as Record<string, (...a: unknown[]) => unknown>;
const nb = (s: unknown) => String(s).replace(/ /g, " ");

describe("formatação de valores (página)", () => {
  it("valores compactos", () => {
    expect(f.comp(4757592142516.1)).toBe("R$ 4,8 tri");
    expect(f.comp(690.4e9)).toBe("R$ 690,4 bi");
    expect(f.comp(-1.5e6)).toBe("−R$ 1,5 mi");
    expect(f.comp(null)).toBe("—");
  });
  it("arredondamento muda de unidade na fronteira", () => {
    expect(f.comp(999.96e9)).toBe("R$ 1 tri");
    expect(f.extenso(999.96e9)).toBe("R$ 1 trilhão");
    expect(f.extenso(999_999)).toBe("R$ 1 milhão");
  });
  it("singular e plural em palavras", () => {
    expect(f.extenso(1.94e12)).toBe("R$ 1,9 trilhão");
    expect(f.extenso(1.96e12)).toBe("R$ 2 trilhões");
    expect(f.extenso(6.4277e12)).toBe("R$ 6,4 trilhões");
    expect(f.extenso(23427)).toBe("R$ 23 mil");
    expect(f.extenso(Number.NaN)).toBe("—");
  });
  it("valor cheio em reais", () => {
    expect(nb(f.cheio(1232828992.77))).toBe("R$ 1.232.828.992,77");
  });
  it("percentual", () => {
    expect(f.pct(0.114)).toBe("11,4%");
    expect(f.pct(Infinity)).toBe("—");
  });
});

describe("variação (página = regra auditada)", () => {
  const casos: [number | null, number | null][] = [[110, 100], [90, 100], [10, 0], [0, 0], [null, 5], [5, null], [-50, -100]];
  it("mesmo resultado da função testada em src/lib/auditoria.ts", () => {
    for (const [a, b] of casos) expect(f.variacao(a, b)).toEqual(variacaoTS(a, b));
  });
});

describe("meses incompletos e comparações", () => {
  const preparar = (incluir: boolean) => {
    ctx.E = { mi: 1, mf: 12, incluirParcial: incluir };
    ctx.D = { porAno: { 2026: { meses: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10], parciais: { exe: [10], tra: [10] } }, 2025: { meses: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], parciais: { exe: [], tra: [] } } } };
    vm.runInContext("E = this.E; D = this.D;", ctx);
  };
  it("por padrão o período vai só até o último mês completo", () => {
    preparar(false);
    expect(f.mesesEf(2026)).toEqual([1, 9]);
    expect(f.temParcial(2026, [1, 9])).toBe(false);
    expect(f.cobre(2025, [1, 9], "meses")).toBe(true);
  });
  it("incluindo o mês parcial, a comparação fica inválida", () => {
    preparar(true);
    expect(f.mesesEf(2026)).toEqual([1, 10]);
    expect(f.temParcial(2026, [1, 10])).toBe(true);
  });
  it("ano anterior sem os mesmos meses não é comparável", () => {
    preparar(false);
    expect(f.cobre(2026, [1, 12], "meses")).toBe(false);
  });
});
