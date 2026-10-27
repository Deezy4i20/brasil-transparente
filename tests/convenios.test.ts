/** ETL de convênios com arquivo no formato do dicionário oficial (latin1, ";", zip com dois CSVs). */
import { afterAll, describe, expect, it } from "vitest";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { dataISO, executarConvenios, resumir, COLUNAS_SAIDA } from "../scripts/etl/convenios";

const dir = mkdtempSync(join(tmpdir(), "bt-teste-conv-"));
afterAll(() => rmSync(dir, { recursive: true, force: true }));
const csv = (nome: string, linhas: string[][]) => {
  const p = join(dir, nome);
  writeFileSync(p, Buffer.from(linhas.map((l) => l.map((c) => `"${c}"`).join(";")).join("\r\n") + "\r\n", "latin1"));
  return p;
};
const CAB = ["NÚMERO CONVÊNIO", "UF", "CÓDIGO SIAFI MUNICÍPIO", "NOME MUNICÍPIO", "SITUAÇÃO CONVÊNIO", "NÚMERO ORIGINAL", "NÚMERO PROCESSO DO CONVÊNIO", "OBJETO DO CONVÊNIO", "CÓDIGO ÓRGÃO SUPERIOR", "NOME ÓRGÃO SUPERIOR", "CÓDIGO ÓRGÃO CONCEDENTE", "NOME ÓRGÃO CONCEDENTE", "CÓDIGO UG CONCEDENTE", "NOME UG CONCEDENTE", "CÓDIGO CONVENENTE", "TIPO CONVENENTE", "NOME CONVENENTE", "TIPO ENTE CONVENENTE", "TIPO INSTRUMENTO", "VALOR CONVÊNIO", "VALOR LIBERADO", "DATA PUBLICAÇÃO", "DATA INÍCIO VIGÊNCIA", "DATA FINAL VIGÊNCIA", "VALOR CONTRAPARTIDA", "DATA ÚLTIMA LIBERAÇÃO", "VALOR ÚLTIMA LIBERAÇÃO"];
const linha = (num: string, uf: string, mun: string, obj: string, codConv: string, conv: string, valor: string, lib: string, ini: string, fim: string) =>
  [num, uf, "3849", mun, "EM EXECUÇÃO", "", "", obj, "56000", "Ministério das Cidades", "56101", "Ministério das Cidades", "", "", codConv, "Administração Pública Municipal", conv, "Municipal", "Contrato de Repasse", valor, lib, "01/02/2025", ini, fim, "10.000,00", "", ""];

describe("convênios", () => {
  it("converte datas", () => {
    expect(dataISO("31/12/2026")).toBe("2026-12-31");
    expect(dataISO("")).toBeNull();
  });

  it("processa o arquivo oficial, filtra por vigência, localiza município e protege pessoa física", async () => {
    const principal = csv("Convenios.csv", [
      CAB,
      linha("900001", "BA", "SALVADOR", "Pavimentação de vias no bairro X", "13927801000149", "MUNICIPIO DE SALVADOR", "1.000.000,00", "250.000,00", "01/03/2025", "31/12/2027"),
      linha("900002", "BA", "SALVADOR", "Construção de creche", "13927801000149", "MUNICIPIO DE SALVADOR", "2.000.000,00", "0,00", "01/01/2027", "31/12/2028"),
      linha("900003", "BA", "SALVADOR", "Obra antiga", "13927801000149", "MUNICIPIO DE SALVADOR", "5.000,00", "5.000,00", "01/01/2015", "31/12/2016"),
      linha("900004", "SP", "MUNICIPIO QUE NAO EXISTE", "Reforma", "12345678901", "FULANO DE TAL", "3.000,00", "0,00", "01/01/2026", "31/12/2026"),
    ]);
    const ob = csv("Convenios_OrdensBancarias.csv", [["NÚMERO CONVÊNIO", "NÚMERO ORIGINAL", "DATA EMISSÃO OB", "NÚMERO DA ORDEM BANCÁRIA", "VALOR LIBERADO"], ["900001", "", "01/04/2025", "2025OB1", "250.000,00"]]);
    let arq = principal;
    try {
      arq = join(dir, "20261020_Convenios.zip");
      execFileSync("zip", ["-j", "-q", arq, principal, ob]);
    } catch {
      arq = principal;
    }
    const saida = join(dir, "agregados");
    const { res, resumo } = await executarConvenios({ arquivos: [arq], desde: "2025-01-01", saida });
    expect(res.lidas).toBe(4);
    expect(res.mantidas).toBe(3);
    expect(res.descartes).toEqual({ "vigência terminou antes do período considerado": 1 });

    const ba = JSON.parse(readFileSync(join(saida, "convenios", "BA.json"), "utf8"));
    const i = (k: (typeof COLUNAS_SAIDA)[number]) => COLUNAS_SAIDA.indexOf(k);
    expect(ba.itens).toHaveLength(2);
    expect(ba.itens[0][i("municipioCod")]).toBe("2927408");
    expect(ba.itens[0][i("objeto")]).toBe("Pavimentação de vias no bairro X");
    expect(ba.itens[0][i("valor")]).toBe(1_000_000);
    expect(ba.itens[0][i("fim")]).toBe("2027-12-31");

    const sp = JSON.parse(readFileSync(join(saida, "convenios", "SP.json"), "utf8"));
    expect(sp.itens[0][i("convenente")]).toBe("Pessoa física (nome não exibido)");
    expect(sp.itens[0][i("municipioCod")]).toBeNull();
    expect(res.semMunicipio).toBe(1);

    // Referência = data do arquivo (2026-10-20): pavimentação vigente, creche futura (começa em 2027).
    expect(resumo.porMunicipio["2927408"]).toEqual([2, 3_000_000, 250_000, 1, 1]);
    const m = JSON.parse(readFileSync(join(saida, "manifesto.json"), "utf8"));
    expect(m.conjuntos.find((c: { conjunto: string }) => c.conjunto === "convenios").arquivos[0].linhasLidas).toBe(4);
  });

  it("classifica futuro e vigente pela data de referência", () => {
    const porUF = { BA: [["1", "2927408", "Salvador", "", "", "", "", "", "", "", 100, 0, 0, "2027-01-01", "2028-01-01", null, null], ["2", "2927408", "Salvador", "", "", "", "", "", "", "", 50, 20, 0, "2025-01-01", "2027-01-01", null, null], ["3", "2927408", "Salvador", "", "", "", "", "", "", "", 10, 10, 0, "2020-01-01", "2025-06-01", null, null]] };
    const r = resumir(porUF, "2026-10-20");
    expect(r.porMunicipio["2927408"]).toEqual([3, 160, 30, 1, 1]);
    expect(r.porUF.BA[0]).toBe(3);
  });
});
