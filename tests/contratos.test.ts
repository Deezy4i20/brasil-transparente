import { describe, expect, it } from "vitest";
import {
  COLUNAS_CONTRATO, grupoModalidade, normalizarContratacao, normalizarContrato, resumirContratos, situacaoContrato,
  type LocalUasg,
} from "../scripts/etl/contratos";

// Registros reais da API de Dados Abertos do Compras.gov.br (out/2026), reduzidos.
const contratoUFSC = {
  codigoOrgao: "26246", nomeOrgao: "UNIVERSIDADE FEDERAL DE SANTA CATARINA", codigoUnidadeGestora: "153163",
  nomeUnidadeGestora: "UNIVERSIDADE FEDERAL DE SANTA CATARINA", receitaDespesa: "D", numeroContrato: "00209/2025",
  nomeModalidadeCompra: "Pregão", codigoTipo: "50", nomeTipo: "Contrato", nomeCategoria: "Informática (TIC)",
  niFornecedor: "59717553000617", nomeRazaoSocialFornecedor: "GRUPO MULTILASER S.A.", objeto: "AQUISIÇÃO DE NOTEBOOKS",
  dataVigenciaInicial: "2026-01-08T00:00:00", dataVigenciaFinal: "2027-01-08T00:00:00", valorGlobal: 159400.0,
  valorAcumulado: 159400.0, numeroControlePncpContrato: "83899526000182-2-002359/2025", idCompra: "20105705900012025",
  dataHoraExclusao: null, contratoExcluido: false,
};
const empenhoMS = {
  ...contratoUFSC, codigoUnidadeGestora: "250030", numeroContrato: "2026NE000023", codigoTipo: "99", nomeTipo: "Empenho",
  niFornecedor: "19568836000115", valorGlobal: 4149.9,
};
const uasg = new Map<string, LocalUasg>([["153163", { uf: "SC", ibge: 4205407, municipio: "FLORIANÓPOLIS" }]]);

describe("contratos (Compras.gov.br)", () => {
  it("normaliza contrato e localiza pela unidade gestora", () => {
    const n = normalizarContrato(contratoUFSC, uasg);
    expect("linha" in n).toBe(true);
    if (!("linha" in n)) return;
    const I = (c: (typeof COLUNAS_CONTRATO)[number]) => n.linha[COLUNAS_CONTRATO.indexOf(c)];
    expect(n.uf).toBe("SC");
    expect(n.empenho).toBe(false);
    expect(I("ibge")).toBe(4205407);
    expect(I("fornecedor")).toBe("GRUPO MULTILASER S.A.");
    expect(I("inicio")).toBe("2026-01-08");
    expect(I("valorGlobal")).toBe(159400);
    expect(n.linha).toHaveLength(COLUNAS_CONTRATO.length);
  });
  it("marca nota de empenho e unidade sem local como NI", () => {
    const n = normalizarContrato(empenhoMS, uasg);
    expect("linha" in n && n.empenho && n.uf === "NI").toBe(true);
  });
  it("oculta nome e CPF de pessoa física contratada", () => {
    const n = normalizarContrato({ ...contratoUFSC, niFornecedor: "123.456.789-01", nomeRazaoSocialFornecedor: "FULANO DE TAL" }, uasg);
    if (!("linha" in n)) throw new Error();
    expect(n.linha[COLUNAS_CONTRATO.indexOf("fornecedor")]).toBe("Pessoa física");
    expect(n.linha[COLUNAS_CONTRATO.indexOf("documento")]).toBe("");
  });
  it("descarta excluídos e contratos de receita", () => {
    expect(normalizarContrato({ ...contratoUFSC, contratoExcluido: true }, uasg)).toEqual({ descarte: "contrato excluído" });
    expect(normalizarContrato({ ...contratoUFSC, receitaDespesa: "R" }, uasg)).toHaveProperty("descarte");
  });
  it("situação pela data de hoje", () => {
    expect(situacaoContrato("2026-01-08", "2027-01-08", "2026-10-27")).toBe("vigente");
    expect(situacaoContrato("2026-11-01", "2027-01-08", "2026-10-27")).toBe("futuro");
    expect(situacaoContrato("2025-01-01", "2025-12-31", "2026-10-27")).toBe("encerrado");
  });
  it("agrupa modalidades em com/sem disputa", () => {
    expect(grupoModalidade("Pregão - Eletrônico")).toBe("com_disputa");
    expect(grupoModalidade("Dispensa")).toBe("sem_disputa");
    expect(grupoModalidade("Inexigibilidade")).toBe("sem_disputa");
    expect(grupoModalidade("Concorrência")).toBe("com_disputa");
  });
  it("resumo soma só contratos vigentes, sem empenhos, sem somar fases", () => {
    const a = normalizarContrato(contratoUFSC, uasg), b = normalizarContrato({ ...contratoUFSC, numeroContrato: "2", dataVigenciaFinal: "2025-06-01T00:00:00", valorGlobal: 1e6 }, uasg);
    if (!("linha" in a) || !("linha" in b)) throw new Error();
    const r = resumirContratos({ SC: [a.linha, b.linha] }, { qtd: 3, valor: 10 }, "2026-10-27");
    expect(r.totais.vigentes).toBe(1);
    expect(r.totais.valorVigentes).toBe(159400);
    expect(r.porUF.SC).toEqual([2, 1, 159400]);
    expect(r.porMunicipio["4205407"]).toEqual([1, 159400]);
    expect(r.empresas[0]).toEqual(["GRUPO MULTILASER S.A.", "59717553000617", 1, 159400]);
    expect(r.totais.empenhos).toBe(3);
  });
});

describe("licitações (PNCP via Compras.gov.br)", () => {
  const base = {
    idCompra: "12063005900362025", numeroControlePNCP: "00394429000100-1-003992/2025", orgaoEntidadeRazaoSocial: "COMANDO DA AERONAUTICA",
    orgaoEntidadeEsferaId: "F", unidadeOrgaoNomeUnidade: "GRUPAMENTO DE APOIO DE MANAUS", unidadeOrgaoUfSigla: "AM",
    unidadeOrgaoMunicipioNome: "MANAUS", unidadeOrgaoCodigoIbge: 1302603, modalidadeNome: "Pregão - Eletrônico",
    amparoLegalNome: "Lei 14.133/2021, Art. 28, I", objetoCompra: "Contratacao de empresa", situacaoCompraNomePncp: "Divulgada no PNCP",
    valorTotalEstimado: 1000.5, valorTotalHomologado: 900, dataPublicacaoPncp: "2026-01-05T10:00:00", srp: true, contratacaoExcluida: false,
  };
  it("mantém só órgãos federais", () => {
    const n = normalizarContratacao(base);
    expect("linha" in n && n.uf === "AM").toBe(true);
    expect(normalizarContratacao({ ...base, orgaoEntidadeEsferaId: "E" })).toEqual({ descarte: "órgão não federal" });
  });
});
