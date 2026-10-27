import { describe, expect, it } from "vitest";
import { formatarBRLCompacto, parseValorBR, somar, variacao } from "../src/lib/dinheiro";
import { filtrosDeCubo, lerFiltros, paraQuery } from "../src/lib/filtros";
import { POPULACAO_BRASIL, resolverUF, UFS } from "../src/lib/referencia/ufs";
import { alertasContrato, lerData } from "../src/lib/alertas";
import { LimitadorJanela, limiteOficialPorMinuto } from "../src/lib/portal/limitador";

describe("valores monetários", () => {
  it("interpreta formatos do Portal", () => {
    expect(parseValorBR("1.234.567,89")).toBe(1234567.89);
    expect(parseValorBR("-1.234,50")).toBe(-1234.5);
    expect(parseValorBR("(10,00)")).toBe(-10);
    expect(parseValorBR("R$ 2.000,00")).toBe(2000);
    expect(parseValorBR("0,01")).toBe(0.01);
    expect(parseValorBR("1.234.567")).toBe(1234567);
    expect(parseValorBR("1234.56")).toBe(1234.56);
    expect(parseValorBR(42)).toBe(42);
    expect(parseValorBR("")).toBeNull();
    expect(parseValorBR("-")).toBeNull();
    expect(parseValorBR("abc")).toBeNull();
    expect(parseValorBR(null)).toBeNull();
  });
  it("soma sem erro de ponto flutuante", () => {
    expect(somar(Array(10).fill(0.1))).toBe(1);
    expect(somar([0.1, 0.2])).toBe(0.3);
  });
  it("variação é nula sem base comparável", () => {
    expect(variacao(10, 0)).toBeNull();
    expect(variacao(10, null)).toBeNull();
    expect(variacao(110, 100)).toBeCloseTo(0.1);
  });
  it("formata valores grandes de forma compacta", () => {
    expect(formatarBRLCompacto(5.3e12)).toBe("R$ 5,3 tri");
    expect(formatarBRLCompacto(826e9)).toBe("R$ 826 bi");
    expect(formatarBRLCompacto(null)).toBe("—");
  });
});

describe("referência territorial", () => {
  it("tem 27 UFs e população do Censo 2022", () => {
    expect(UFS).toHaveLength(27);
    expect(POPULACAO_BRASIL).toBe(203_080_756);
  });
  it("resolve UF por sigla, nome (com/sem acento) e código", () => {
    expect(resolverUF("sp")?.sigla).toBe("SP");
    expect(resolverUF("São Paulo")?.sigla).toBe("SP");
    expect(resolverUF("SAO PAULO")?.sigla).toBe("SP");
    expect(resolverUF("53")?.sigla).toBe("DF");
    expect(resolverUF("NACIONAL")).toBeUndefined();
    expect(resolverUF("")).toBeUndefined();
  });
});

describe("filtros globais", () => {
  it("valida e saneia parâmetros da URL", () => {
    const f = lerFiltros({ ano: "1900", uf: "XX", mi: "9", mf: "3", orgao: "<script>", metrica: "hack", modo: "per_capita" }, 2026);
    expect(f.ano).toBe(2026);
    expect(f.uf).toBeUndefined();
    expect(f.meses).toEqual([3, 9]);
    expect(f.orgao).toBeUndefined();
    expect(f.metrica).toBe("transferencias");
    expect(f.modo).toBe("per_capita");
  });
  it("região vira lista de UFs; UF tem precedência", () => {
    const f = lerFiltros({ regiao: "Sul" }, 2026);
    expect(filtrosDeCubo(f).uf?.sort()).toEqual(["PR", "RS", "SC"]);
    expect(filtrosDeCubo(lerFiltros({ regiao: "Sul", uf: "BA" }, 2026)).uf).toEqual(["BA"]);
  });
  it("serializa sem valores padrão", () => {
    expect(paraQuery(lerFiltros({ ano: "2025" }, 2026))).toBe("?ano=2025");
    expect(paraQuery(lerFiltros({ ano: "2025", uf: "sp" }, 2026), { uf: null })).toBe("?ano=2025");
  });
});

describe("alertas de contrato", () => {
  const hoje = new Date(Date.UTC(2026, 9, 27));
  it("lê datas nos dois formatos", () => {
    expect(lerData("31/12/2026")?.toISOString().slice(0, 10)).toBe("2026-12-31");
    expect(lerData("2026-12-31")?.toISOString().slice(0, 10)).toBe("2026-12-31");
    expect(lerData("")).toBeNull();
  });
  it("gera alertas com regra e dados, e só quando aplicável", () => {
    const a = alertasContrato({ valorInicialCompra: 100, valorFinalCompra: 140, dataFimVigencia: "15/11/2026" }, hoje);
    expect(a.map((x) => x.id).sort()).toEqual(["variacao-valor", "vencimento"]);
    expect(a.every((x) => x.regra && x.dados && x.explicacao)).toBe(true);
    expect(alertasContrato({ valorInicialCompra: 100, valorFinalCompra: 120, dataFimVigencia: "15/06/2027" }, hoje)).toHaveLength(0);
    expect(alertasContrato({ valorInicialCompra: 0, valorFinalCompra: 50, dataFimVigencia: "01/01/2020" }, hoje)).toHaveLength(0);
  });
});

describe("limitador de requisições", () => {
  it("usa 400/min de dia e 700/min de madrugada (horário de Brasília)", () => {
    expect(limiteOficialPorMinuto(new Date("2026-10-27T15:00:00Z"))).toBe(400); // 12h em Brasília
    expect(limiteOficialPorMinuto(new Date("2026-10-27T05:30:00Z"))).toBe(700); // 02h30 em Brasília
  });
  it("não libera mais que a capacidade dentro da janela de 60s", async () => {
    let t = 1_000_000;
    const lim = new LimitadorJanela(1, () => t, () => 3);
    let liberadas = 0;
    for (let i = 0; i < 5; i++) lim.aguardar().then(() => liberadas++);
    await Promise.resolve();
    await Promise.resolve();
    expect(liberadas).toBe(3);
    expect(lim.disponivel()).toBe(0);
    t += 61_000;
    expect(lim.disponivel()).toBe(3);
  });
});
