/**
 * Teste ponta a ponta do ETL com arquivos no formato oficial:
 * CSV em ISO-8859-1, separador ";", aspas, cabeçalhos conforme os dicionários de dados.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { executarETL, verificarConsistencia } from "../scripts/etl/index";
import { extrairMes, normalizarColuna } from "../scripts/etl/csv";
import type { Cubo, Manifesto } from "../src/lib/dados/tipos";

const dir = mkdtempSync(join(tmpdir(), "bt-teste-etl-"));
const saida = join(dir, "agregados");
const csv = (nome: string, linhas: string[][]) => {
  const txt = linhas.map((l) => l.map((c) => `"${c}"`).join(";")).join("\r\n") + "\r\n";
  const p = join(dir, nome);
  writeFileSync(p, Buffer.from(txt, "latin1"));
  return p;
};

const CAB_ORC = ["EXERCÍCIO", "CÓDIGO ÓRGÃO SUPERIOR", "NOME ÓRGÃO SUPERIOR", "CÓDIGO ÓRGÃO SUBORDINADO", "NOME ÓRGÃO SUBORDINADO", "CÓDIGO UNIDADE ORÇAMENTÁRIA", "NOME UNIDADE ORÇAMENTÁRIA", "CÓDIGO FUNÇÃO", "NOME FUNÇÃO", "CÓDIGO SUBFUNÇÃO", "NOME SUBFUNÇÃO", "CÓDIGO PROGRAMA ORÇAMENTÁRIO", "NOME PROGRAMA ORÇAMENTÁRIO", "CÓDIGO AÇÃO", "NOME AÇÃO", "CÓDIGO CATEGORIA ECONÔMICA", "CÓDIGO GRUPO DE DESPESA", "NOME GRUPO DE DESPESA", "CÓDIGO ELEMENTO DE DESPESA", "NOME ELEMENTO DE DESPESA", "ORÇAMENTO INICIAL (R$)", "ORÇAMENTO ATUALIZADO (R$)", "ORÇAMENTO EMPENHADO (R$)", "ORÇAMENTO REALIZADO (R$)", "% REALIZADO DO ORÇAMENTO (COM RELAÇÃO AO ORÇAMENTO ATUALIZADO) (R$)"];
const linhaOrc = (ano: string, atual: string, emp: string, real: string) => [ano, "36000", "Ministério da Saúde", "36901", "Fundo Nacional de Saúde", "36901", "FNS", "10", "Saúde", "302", "Assistência Hospitalar", "5018", "Atenção Especializada", "8585", "Atenção à Saúde", "3", "3", "Outras Despesas Correntes", "41", "Contribuições", "100,00", atual, emp, real, "50,00"];

const CAB_EXE = ["Ano e mês do lançamento", "Código Órgão Superior", "Nome Órgão Superior", "Código Órgão Subordinado", "Nome Órgão Subordinado", "Código Unidade Gestora", "Nome Unidade Gestora", "Código Gestão", "Nome Gestão", "Código Unidade Orçamentária", "Nome Unidade Orçamentária", "Código Função", "Nome Função", "Código Subfunção", "Nome Subfunção", "Código Programa Orçamentário", "Nome Programa Orçamentário", "Código Ação", "Nome Ação", "Código Plano Orçamentário", "Plano Orçamentário", "Código Programa Governo", "Nome Programa Governo", "UF", "Município", "Código Subtítulo", "Nome Subtítulo", "Código Localizador", "Nome Localizador", "Sigla Localizador", "Descrição Complementar Localizador", "Código Autor Emenda", "Nome Autor Emenda", "Código Categoria Econômica", "Nome Categoria Econômica", "Código Grupo de Despesa", "Nome Grupo de Despesa", "Código Elemento de Despesa", "Nome Elemento de Despesa", "Código Modalidade da Despesa", "Modalidade da Despesa", "Valor Empenhado (R$)", "Valor Liquidado (R$)", "Valor Pago (R$)", "Valor Restos a Pagar Inscritos (R$)", "Valor Restos a Pagar Cancelado (R$)", "Valor Restos a Pagar Pagos (R$)"];
const linhaExe = (am: string, uf: string, mun: string, emp: string, liq: string, pago: string) => {
  const l = CAB_EXE.map(() => "");
  const set = (k: string, v: string) => (l[CAB_EXE.indexOf(k)] = v);
  set("Ano e mês do lançamento", am); set("Código Órgão Superior", "36000"); set("Nome Órgão Superior", "Ministério da Saúde");
  set("Código Órgão Subordinado", "36901"); set("Nome Órgão Subordinado", "Fundo Nacional de Saúde"); set("Código Função", "10"); set("Nome Função", "Saúde");
  set("Código Programa Orçamentário", "5018"); set("Nome Programa Orçamentário", "Atenção Especializada"); set("Código Ação", "8585"); set("Nome Ação", "Atenção à Saúde");
  set("Código Grupo de Despesa", "3"); set("Nome Grupo de Despesa", "Outras Despesas Correntes"); set("UF", uf); set("Município", mun);
  set("Valor Empenhado (R$)", emp); set("Valor Liquidado (R$)", liq); set("Valor Pago (R$)", pago);
  set("Valor Restos a Pagar Inscritos (R$)", "0,00"); set("Valor Restos a Pagar Cancelado (R$)", "0,00"); set("Valor Restos a Pagar Pagos (R$)", "0,00");
  return l;
};

const CAB_TRA = ["ANO / MÊS", "TIPO TRANSFERÊNCIA", "TIPO FAVORECIDO", "UF", "CÓDIGO MUNICÍPIO SIAFI", "NOME MUNICÍPIO", "CÓDIGO ÓRGÃO SIAFI", "NOME ÓRGÃO", "CÓDIGO UNIDADE GESTORA", "NOME UNIDADE GESTORA", "CÓDIGO FUNÇÃO", "NOME FUNÇÃO", "CÓDIGO SUBFUNÇÃO", "NOME SUBFUNÇÃO", "CÓDIGO PROGRAMA", "NOME PROGRAMA", "CÓDIGO AÇÃO", "NOME AÇÃO", "LINGUAGEM CIDADÃ", "CÓDIGO GRUPO DESPESA", "GRUPO DE DESPESA", "CÓDIGO MODALIDADE APLICAÇÃO DESPESA", "NOME MODALIDADE APLICAÇÃO DESPESA", "CÓDIGO ELEMENTO DESPESA", "NOME ELEMENTO DESPESA", "CÓDIGO PLANO ORÇAMENTÁRIO", "NOME PLANO ORÇAMENTÁRIO", "CÓDIGO SUBTÍTULO", "NOME SUBTÍTULO", "CÓDIGO LOCALIZADOR", "NOME LOCALIZADOR", "SIGLA LOCALIZADOR", "DESCRIÇÃO COMPLEMENTAR LOCALIZADOR", "CÓDIGO FAVORECIDO", "NOME FAVORECIDO", "VALOR TRANSFERIDO"];
const linhaTra = (am: string, tipoFav: string, uf: string, mun: string, cod: string, nome: string, valor: string) => {
  const l = CAB_TRA.map(() => "");
  const set = (k: string, v: string) => (l[CAB_TRA.indexOf(k)] = v);
  set("ANO / MÊS", am); set("TIPO TRANSFERÊNCIA", "Constitucionais e Royalties"); set("TIPO FAVORECIDO", tipoFav); set("UF", uf);
  set("NOME MUNICÍPIO", mun); set("CÓDIGO MUNICÍPIO SIAFI", "7107"); set("CÓDIGO ÓRGÃO SIAFI", "25000"); set("NOME ÓRGÃO", "Ministério da Fazenda");
  set("CÓDIGO FUNÇÃO", "28"); set("NOME FUNÇÃO", "Encargos especiais"); set("CÓDIGO PROGRAMA", "0903"); set("NOME PROGRAMA", "Transferências Constitucionais");
  set("CÓDIGO AÇÃO", "0044"); set("NOME AÇÃO", "FPM"); set("LINGUAGEM CIDADÃ", "Fundo de Participação dos Municípios");
  set("CÓDIGO FAVORECIDO", cod); set("NOME FAVORECIDO", nome); set("VALOR TRANSFERIDO", valor);
  return l;
};

const CAB_EME = ["Código da Emenda", "Ano da Emenda", "Tipo de Emenda", "Código do Autor da Emenda", "Nome do Autor da Emenda", "Número da emenda", "Localidade do gasto", "Código Município IBGE", "Município", "Código UF IBGE", "UF", "Região", "Código Função", "Nome Função", "Código Subfunção", "Nome Subfunção", "Código Programa", "Nome Programa", "Código Ação", "Nome Ação", "Código Plano Orçamentário", "Nome Plano Orçamentário", "Valor Empenhado", "Valor Liquidado", "Valor Pago", "Valor Restos A Pagar Inscritos", "Valor Restos A Pagar Cancelados", "Valor Restos A Pagar Pagos"];
const linhaEme = (cod: string, ano: string, codMun: string, mun: string, uf: string, emp: string, pago: string) =>
  [cod, ano, "Emenda Individual", "1234", "AUTOR TESTE", "0001", `${mun} - ${uf}`, codMun, mun, "29", uf, "Nordeste", "10", "Saúde", "301", "Atenção Básica", "5019", "Atenção Primária", "2E89", "Incremento", "0000", "PO", emp, pago, pago, "0,00", "0,00", "0,00"];

let manifesto: Manifesto;
const lerCubo = (n: string) => JSON.parse(readFileSync(join(saida, "2025", `${n}.json`), "utf8")) as Cubo;
const soma = (c: Cubo, m: string) => c.linhas.reduce((s, l) => s + Math.round(l[c.dimensoes.length + c.medidas.indexOf(m)] * 100), 0) / 100;

beforeAll(async () => {
  const orc = csv("2025_OrcamentoDespesa.csv", [CAB_ORC, linhaOrc("2025", "1.000,00", "900,00", "700,00"), linhaOrc("2025", "500,50", "400,00", "300,00"), linhaOrc("2024", "999,00", "1,00", "1,00")]);
  const exe = csv("202501_Despesas.csv", [
    CAB_EXE,
    linhaExe("2025/01", "BA", "Salvador", "800,00", "700,00", "600,00"),
    linhaExe("2025/02", "", "", "500,00", "400,00", "300,00"),
    linhaExe("2025/13", "BA", "", "1,00", "1,00", "1,00"),
  ]);
  const tra = csv("202501_Transferencias.csv", [
    CAB_TRA,
    linhaTra("2025/01", "Administração Pública", "BA", "SALVADOR", "13927801000149", "MUNICIPIO DE SALVADOR", "1.000.000,00"),
    linhaTra("2025/01", "Pessoa Física", "BA", "SALVADOR", "***.123.456-**", "FULANO", "100,00"),
    linhaTra("2025/02", "Administração Pública", "", "", "000", "SEM UF", "50,00"),
    linhaTra("2025/02", "Administração Pública", "SP", "MUNICIPIO INEXISTENTE", "111", "X", "abc"),
  ]);
  const eme = csv("EmendasParlamentares.csv", [CAB_EME, linhaEme("202512340001", "2025", "2927408", "Salvador", "Bahia", "300,00", "200,00"), linhaEme("202512340002", "2025", "", "", "NACIONAL", "100,00", "0,00"), linhaEme("202412340003", "2024", "", "", "Bahia", "1,00", "1,00")]);
  // O arquivo de emendas oficial é um .zip com vários CSVs; o ETL deve escolher o certo pelo cabeçalho.
  const outro = csv("EmendasParlamentares_Convenios.csv", [["Código da Emenda", "Convenente", "Valor Convênio"], ["202512340001", "X", "10,00"]]);
  let emeArq = eme;
  try {
    emeArq = join(dir, "EmendasParlamentares.zip");
    execFileSync("zip", ["-j", "-q", emeArq, eme, outro]);
  } catch {
    emeArq = eme; // ambiente sem `zip`: testa o CSV solto
  }
  const r = await executarETL({ ano: 2025, conjuntos: ["orcamento", "execucao", "transferencias", "emendas"], meses: [1], arquivos: { orcamento: [orc], execucao: [exe], transferencias: [tra], emendas: [emeArq] }, saida });
  manifesto = JSON.parse(readFileSync(join(saida, "manifesto.json"), "utf8"));
  expect(r).toHaveLength(4);
}, 60_000);

afterAll(() => rmSync(dir, { recursive: true, force: true }));

describe("ETL — utilitários", () => {
  it("normaliza cabeçalhos oficiais", () => {
    expect(normalizarColuna("ORÇAMENTO ATUALIZADO (R$)")).toBe("orcamentoatualizado");
    expect(normalizarColuna("﻿ANO / MÊS")).toBe("anomes");
    expect(normalizarColuna("Ano e mês do lançamento")).toBe("anoemesdolancamento");
  });
  it("extrai mês de vários formatos", () => {
    expect(extrairMes("2025/03")).toBe(3);
    expect(extrairMes("03/2025")).toBe(3);
    expect(extrairMes("202503")).toBe(3);
    expect(extrairMes("2025/13")).toBeNull();
  });
});

describe("ETL — orçamento", () => {
  it("soma o exercício pedido e descarta outros anos, registrando o motivo", () => {
    const c = lerCubo("orcamento");
    expect(soma(c, "atualizado")).toBe(1500.5);
    expect(soma(c, "empenhado")).toBe(1300);
    const m = manifesto.conjuntos.find((x) => x.conjunto === "orcamento")!;
    expect(m.arquivos[0].linhasLidas).toBe(3);
    expect(m.arquivos[0].motivosDescarte).toEqual({ "exercício diferente do solicitado": 1 });
  });
});

describe("ETL — execução", () => {
  it("lê acentos em latin1 e soma etapas separadamente", () => {
    const c = lerCubo("execucao");
    expect(c.dicionarios.orgaoSuperior[0].nome).toBe("Ministério da Saúde");
    expect(soma(c, "empenhado")).toBe(1300);
    expect(soma(c, "pago")).toBe(900);
  });
  it("sem UF → localização não identificada (não vai para a sede do órgão)", () => {
    const c = lerCubo("execucao");
    expect(c.dicionarios.uf.map((u) => u.cod).sort()).toEqual(["BA", "NI"]);
  });
  it("associa município pelo nome usando a malha do IBGE", () => {
    const c = lerCubo("execucao_municipios");
    expect(c.dicionarios.municipio[0]).toMatchObject({ cod: "2927408", extra: { correspondencia: "nome" } });
  });
  it("descarta mês inválido com motivo", () => {
    const m = manifesto.conjuntos.find((x) => x.conjunto === "execucao")!;
    expect(m.arquivos[0].motivosDescarte).toEqual({ "mês inválido": 1 });
    expect(m.mesesDisponiveis).toEqual([1, 2]);
  });
  it("consistência execução × orçamento passa quando os empenhos batem", async () => {
    expect(await verificarConsistencia(join(saida, "2025"))).toBeNull();
  });
});

describe("ETL — transferências", () => {
  it("mantém PF nos totais mas não lista individualmente; valor inválido é descartado", () => {
    const c = lerCubo("transferencias");
    expect(soma(c, "valor")).toBe(1_000_150);
    const fav = lerCubo("transferencias_favorecidos");
    expect(fav.dicionarios.favorecido.map((f) => f.nome)).not.toContain("FULANO");
    const m = manifesto.conjuntos.find((x) => x.conjunto === "transferencias")!;
    expect(m.arquivos[0].motivosDescarte).toEqual({ "valor monetário inválido": 1 });
    expect(m.avisos.join(" ")).toMatch(/pessoa física/);
  });
  it("preserva a linguagem cidadã da ação", () => {
    const c = lerCubo("transferencias");
    expect(c.dicionarios.acao[0].extra?.linguagemCidada).toBe("Fundo de Participação dos Municípios");
  });
});

describe("ETL — emendas", () => {
  it("filtra pelo ano da emenda, usa código IBGE e classifica destino nacional como não identificado", () => {
    const c = lerCubo("emendas");
    expect(soma(c, "empenhado")).toBe(400);
    expect(c.dicionarios.municipio.map((m) => m.cod)).toContain("2927408");
    expect(c.dicionarios.uf.map((u) => u.cod).sort()).toEqual(["BA", "NI"]);
  });
});

describe("ETL — erros de estrutura", () => {
  it("falha com mensagem listando as colunas encontradas", async () => {
    const ruim = csv("ruim.csv", [["COLUNA A", "COLUNA B"], ["1", "2"]]);
    await expect(
      executarETL({ ano: 2025, conjuntos: ["orcamento"], meses: [1], arquivos: { orcamento: [ruim] }, saida: join(dir, "x") }),
    ).rejects.toThrow(/Colunas encontradas: .*colunaa, colunab/);
  });
});
