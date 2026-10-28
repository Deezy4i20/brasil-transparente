/**
 * ETL de contratos e licitações federais → API de Dados Abertos do Compras.gov.br.
 *
 * Por que esta fonte: desde a Lei 14.133/2021, os contratos do governo federal são
 * registrados no Contratos.gov.br e as licitações no PNCP. O arquivo "Compras" do
 * Portal da Transparência quase não recebe registros novos (jul/2026: 18 contratos),
 * então a fonte oficial e completa é a API pública do Compras.gov.br (sem token).
 *
 *   Contratos:  /modulo-contratos/1.2_consultarContratos_FimVigencia (por órgão)
 *   Licitações: /modulo-contratacoes/1_consultarContratacoes_PNCP_14133 (por modalidade)
 *   Local:      /modulo-uasg/1_consultarUasg (UF e município de cada unidade compradora)
 *   Documentação: https://dadosabertos.compras.gov.br/swagger-ui/index.html
 *
 * Uso:
 *   npm run etl:contratos                         (contratos com fim de vigência desde 1º/jan do ano passado;
 *                                                  licitações publicadas desde 1º/jan deste ano)
 *   npm run etl:contratos -- --desde 2025-01-01 --licitacoes-desde 2026-01-01 --orgaos 36000,26246
 *
 * Saída:
 *   data/agregados/contratos/<UF>.json    contratos (exceto notas de empenho) por UF da unidade contratante
 *   data/agregados/contratos/resumo.json  totais, maiores empresas, órgãos, modalidades, por UF e por município
 *   data/agregados/licitacoes/<UF>.json   licitações e contratações diretas federais, com as empresas contratadas
 *   + entradas "contratos" e "licitacoes" em data/agregados/manifesto.json
 *
 * Cuidados:
 *   - O local é o da UNIDADE que contratou (ex.: um hospital federal em Recife), não necessariamente
 *     onde o serviço é prestado. A interface diz isso; contratos não entram no mapa de gastos.
 *   - Pessoas físicas contratadas aparecem como "Pessoa física", sem nome nem CPF.
 *   - Notas de empenho registradas como "contrato" (compras pequenas) entram só nas contagens do resumo.
 */
import { mkdirSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { ManifestoConjunto } from "../../src/lib/dados/tipos";
import { UFS } from "../../src/lib/referencia/ufs";
import { atualizarManifesto } from "./index";

export const API = "https://dadosabertos.compras.gov.br";
export const FONTE_CONTRATOS = {
  nome: "Contratos — Compras.gov.br (Ministério da Gestão), API de Dados Abertos",
  url: "https://dadosabertos.compras.gov.br/swagger-ui/index.html#/02%20-%20Contratos",
  dicionario: "https://www.gov.br/compras/pt-br/acesso-a-informacao/manuais/manual-dados-abertos/manual-api-compras.pdf",
};
export const FONTE_LICITACOES = {
  nome: "Licitações e contratações (PNCP, Lei 14.133) — Compras.gov.br, API de Dados Abertos",
  url: "https://dadosabertos.compras.gov.br/swagger-ui/index.html#/05%20-%20Contrata%C3%A7%C3%B5es",
  dicionario: "https://www.gov.br/compras/pt-br/acesso-a-informacao/manuais/manual-dados-abertos/manual-api-compras.pdf",
};

export const COLUNAS_CONTRATO = [
  "id", "numero", "orgao", "ug", "ibge", "municipio", "fornecedor", "documento", "tipo", "categoria",
  "modalidade", "objeto", "inicio", "fim", "valorGlobal", "valorAcumulado", "idCompra", "pncp",
] as const;
export const COLUNAS_LICITACAO = [
  "id", "pncp", "orgao", "unidade", "ibge", "municipio", "modalidade", "amparo", "objeto", "situacao",
  "estimado", "homologado", "publicacao", "abertura", "registroPreco", "contratadas",
] as const;

type Bruto = Record<string, unknown>;
const txt = (v: unknown) => (v == null ? "" : String(v).trim());
const num = (v: unknown) => { const n = Number(v); return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0; };
const dia = (v: unknown) => txt(v).slice(0, 10);
const corta = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1).trimEnd() + "…" : s);
export const ehPessoaFisica = (doc: string) => doc.replace(/\D/g, "").length === 11;

export interface LocalUasg { uf: string; ibge: number; municipio: string }

/** Contrato bruto da API → linha de saída. Retorna motivo quando o registro fica de fora. */
export function normalizarContrato(r: Bruto, uasg: Map<string, LocalUasg>): { linha: (string | number)[]; uf: string; empenho: boolean } | { descarte: string } {
  if (r.contratoExcluido === true || txt(r.dataHoraExclusao)) return { descarte: "contrato excluído" };
  if (txt(r.receitaDespesa) === "R") return { descarte: "contrato de receita (o governo recebe)" };
  const ug = txt(r.codigoUnidadeGestora);
  const loc = uasg.get(ug) ?? uasg.get(ug.padStart(6, "0"));
  const doc = txt(r.niFornecedor);
  const pf = ehPessoaFisica(doc);
  const empenho = txt(r.codigoTipo) === "99" || /empenho/i.test(txt(r.nomeTipo));
  const linha = [
    `${ug}-${txt(r.numeroContrato)}`,
    txt(r.numeroContrato),
    txt(r.nomeOrgao),
    txt(r.nomeUnidadeGestora),
    loc?.ibge ?? 0,
    loc?.municipio ?? "",
    pf ? "Pessoa física" : txt(r.nomeRazaoSocialFornecedor),
    pf ? "" : doc,
    txt(r.nomeTipo),
    txt(r.nomeCategoria),
    txt(r.nomeModalidadeCompra),
    corta(txt(r.objeto).replace(/\s+/g, " "), 240),
    dia(r.dataVigenciaInicial),
    dia(r.dataVigenciaFinal),
    num(r.valorGlobal),
    num(r.valorAcumulado),
    txt(r.idCompra),
    txt(r.numeroControlePncpContrato),
  ];
  return { linha, uf: loc?.uf ?? "NI", empenho };
}

/** Contratação (licitação ou contratação direta) bruta → linha. Só esfera federal. */
export function normalizarContratacao(r: Bruto): { linha: (string | number | unknown[])[]; uf: string } | { descarte: string } {
  if (txt(r.orgaoEntidadeEsferaId) !== "F") return { descarte: "órgão não federal" };
  if (r.contratacaoExcluida === true) return { descarte: "contratação excluída" };
  const uf = txt(r.unidadeOrgaoUfSigla) || "NI";
  return {
    uf: UFS.some((u) => u.sigla === uf) ? uf : "NI",
    linha: [
      txt(r.idCompra),
      txt(r.numeroControlePNCP),
      txt(r.orgaoEntidadeRazaoSocial),
      txt(r.unidadeOrgaoNomeUnidade),
      Number(r.unidadeOrgaoCodigoIbge) || 0,
      txt(r.unidadeOrgaoMunicipioNome),
      txt(r.modalidadeNome),
      txt(r.amparoLegalNome),
      corta(txt(r.objetoCompra).replace(/\s+/g, " "), 240),
      txt(r.situacaoCompraNomePncp),
      num(r.valorTotalEstimado),
      num(r.valorTotalHomologado),
      dia(r.dataPublicacaoPncp),
      dia(r.dataAberturaPropostaPncp),
      r.srp === true ? 1 : 0,
      [],
    ],
  };
}

export const situacaoContrato = (inicio: string, fim: string, hoje: string) =>
  inicio && inicio > hoje ? "futuro" : !fim || fim >= hoje ? "vigente" : "encerrado";

/** Agrupa modalidades em linguagem simples: houve disputa entre empresas ou não? */
export function grupoModalidade(m: string): "com_disputa" | "sem_disputa" | "outros" {
  const s = m.toLowerCase();
  if (/dispensa|inexigib|n[aã]o se aplica|sem licita/.test(s)) return "sem_disputa";
  if (/preg[aã]o|concorr|tomada|convite|leil|concurso|di[aá]logo|rdc|regime diferenciado/.test(s)) return "com_disputa";
  return "outros";
}

export interface ResumoContratos {
  referencia: string;
  colunasUF: string[];
  porUF: Record<string, number[]>;
  porMunicipio: Record<string, number[]>;
  empresas: (string | number)[][];
  orgaos: (string | number)[][];
  modalidades: (string | number)[][];
  categorias: (string | number)[][];
  totais: { vigentes: number; valorVigentes: number; contratos: number; empenhos: number; valorEmpenhos: number; semLocal: number };
}

/** Totais dos contratos (sem notas de empenho). Valores somados: valor global dos contratos vigentes hoje. */
export function resumirContratos(porUF: Record<string, (string | number)[][]>, empenhos: { qtd: number; valor: number }, hoje: string): ResumoContratos {
  const I = Object.fromEntries(COLUNAS_CONTRATO.map((c, i) => [c, i])) as Record<(typeof COLUNAS_CONTRATO)[number], number>;
  const uf: Record<string, number[]> = {}, mun: Record<string, number[]> = {};
  const emp = new Map<string, [string, string, number, number]>(), org = new Map<string, [number, number]>();
  const mod = new Map<string, [number, number]>(), cat = new Map<string, [number, number]>();
  let vig = 0, valVig = 0, total = 0, semLocal = 0;
  for (const [sigla, itens] of Object.entries(porUF)) {
    for (const c of itens) {
      total++;
      const st = situacaoContrato(String(c[I.inicio]), String(c[I.fim]), hoje);
      const v = Number(c[I.valorGlobal]) || 0;
      const u = (uf[sigla] ??= [0, 0, 0]);
      u[0]++;
      if (sigla === "NI") semLocal++;
      if (st !== "vigente") continue;
      u[1]++; u[2] += v; vig++; valVig += v;
      const ib = Number(c[I.ibge]);
      if (ib) { const m = (mun[ib] ??= [0, 0]); m[0]++; m[1] += v; }
      const chaveE = String(c[I.documento]) || String(c[I.fornecedor]);
      if (c[I.documento]) { const e = emp.get(chaveE) ?? [String(c[I.fornecedor]), String(c[I.documento]), 0, 0]; e[2]++; e[3] += v; emp.set(chaveE, e); }
      const o = org.get(String(c[I.orgao])) ?? [0, 0]; o[0]++; o[1] += v; org.set(String(c[I.orgao]), o);
      const md = String(c[I.modalidade]) || "Não informada";
      const x = mod.get(md) ?? [0, 0]; x[0]++; x[1] += v; mod.set(md, x);
      const ct = String(c[I.categoria]) || "Não informada";
      const y = cat.get(ct) ?? [0, 0]; y[0]++; y[1] += v; cat.set(ct, y);
    }
  }
  const r2 = (n: number) => Math.round(n * 100) / 100;
  const top = <T extends unknown[]>(m: Map<string, T>, iv: number, n: number) => [...m.entries()].sort((a, b) => Number(b[1][iv]) - Number(a[1][iv])).slice(0, n);
  return {
    referencia: hoje,
    colunasUF: ["contratos", "vigentes", "valorVigentes"],
    porUF: Object.fromEntries(Object.entries(uf).map(([k, v]) => [k, [v[0], v[1], r2(v[2])]])),
    porMunicipio: Object.fromEntries(Object.entries(mun).map(([k, v]) => [k, [v[0], r2(v[1])]])),
    empresas: top(emp, 3, 60).map(([, e]) => [e[0], e[1], e[2], r2(e[3])]),
    orgaos: top(org, 1, 40).map(([k, o]) => [k, o[0], r2(o[1])]),
    modalidades: top(mod, 1, 30).map(([k, o]) => [k, o[0], r2(o[1]), grupoModalidade(k)]),
    categorias: top(cat, 1, 30).map(([k, o]) => [k, o[0], r2(o[1])]),
    totais: { vigentes: vig, valorVigentes: r2(valVig), contratos: total, empenhos: empenhos.qtd, valorEmpenhos: r2(empenhos.valor), semLocal },
  };
}

/* ---------------- acesso à API ---------------- */
let requisicoes = 0;
export async function pegar(caminho: string, params: Record<string, string | number>, tentativas = 7): Promise<{ resultado: Bruto[]; totalPaginas: number; totalRegistros: number }> {
  const url = `${API}${caminho}?${new URLSearchParams(Object.entries(params).map(([k, v]) => [k, String(v)]))}`;
  let espera = 3000, ultimo = "";
  for (let t = 1; t <= tentativas; t++) {
    try {
      requisicoes++;
      const r = await fetch(url, { headers: { accept: "application/json", "user-agent": "brasil-transparente (dados abertos)" }, signal: AbortSignal.timeout(120_000) });
      if (r.ok) {
        const j = (await r.json()) as { resultado?: Bruto[]; totalPaginas?: number; totalRegistros?: number };
        return { resultado: j.resultado ?? [], totalPaginas: j.totalPaginas ?? 0, totalRegistros: j.totalRegistros ?? 0 };
      }
      ultimo = `${r.status}`;
      const corpo = await r.text().catch(() => "");
      if (r.status === 400 || r.status === 404) throw Object.assign(new Error(`${r.status} ${corpo.slice(0, 200)}`), { definitivo: true });
    } catch (e) {
      if ((e as { definitivo?: boolean }).definitivo) throw e;
      ultimo = (e as Error).message;
    }
    await new Promise((ok) => setTimeout(ok, espera));
    espera = Math.min(espera * 2, 90_000);
  }
  throw new Error(`falhou após ${tentativas} tentativas (${ultimo}): ${url}`);
}

async function todasAsPaginas(caminho: string, params: Record<string, string | number>, aoReceber: (r: Bruto[]) => void, tamanho = 500): Promise<number> {
  let p = 1, total = 1, n = 0;
  while (p <= total) {
    const r = await pegar(caminho, { ...params, pagina: p, ...(tamanho ? { tamanhoPagina: tamanho } : {}) });
    total = r.totalPaginas || 0;
    n += r.resultado.length;
    aoReceber(r.resultado);
    p++;
  }
  return n;
}

/** Roda tarefas com concorrência limitada. */
async function emParalelo<T>(itens: T[], n: number, f: (x: T, i: number) => Promise<void>) {
  let i = 0;
  await Promise.all(Array.from({ length: n }, async () => { while (i < itens.length) { const k = i++; await f(itens[k], k); } }));
}

export async function executarContratos(opts: { desde?: string; licitacoesDesde?: string; orgaos?: string[]; saida?: string; semLicitacoes?: boolean } = {}) {
  const saida = opts.saida ?? join(process.cwd(), "data", "agregados");
  const ano = new Date().getFullYear();
  const desde = opts.desde ?? `${ano - 1}-01-01`;
  const licDesde = opts.licitacoesDesde ?? `${ano}-01-01`;
  const hoje = new Date(Date.now() - 3 * 3600_000).toISOString().slice(0, 10);
  const processadoEm = new Date().toISOString();
  const inicio = Date.now();
  console.log(`\n▶ ${FONTE_CONTRATOS.nome}\n  contratos com fim de vigência desde ${desde}; licitações publicadas desde ${licDesde}`);

  // 1. Local de cada unidade compradora (UASG)
  const uasg = new Map<string, LocalUasg>();
  for (const status of ["true", "false"]) {
    const n = await todasAsPaginas("/modulo-uasg/1_consultarUasg", { statusUasg: status }, (rs) => {
      for (const u of rs) if (u.siglaUf) uasg.set(txt(u.codigoUasg), { uf: txt(u.siglaUf), ibge: Number(u.codigoMunicipioIbge) || 0, municipio: txt(u.nomeMunicipioIbge) });
    }, 0);
    console.log(`  unidades compradoras (ativas=${status}): ${n}`);
  }

  // 2. Órgãos federais
  let orgaos = opts.orgaos ?? [];
  if (!orgaos.length) {
    const f: string[] = [];
    await todasAsPaginas("/modulo-uasg/2_consultarOrgao", { statusOrgao: "true" }, (rs) => { for (const o of rs) if (txt(o.esfera) === "F") f.push(txt(o.codigoOrgao)); }, 0);
    orgaos = [...new Set(f)];
    console.log(`  órgãos federais ativos: ${orgaos.length}`);
  }

  // 3. Contratos por órgão
  const porUF: Record<string, (string | number)[][]> = {};
  const vistos = new Set<string>();
  const descartes: Record<string, number> = {};
  const empenhos = { qtd: 0, valor: 0 };
  let lidos = 0, falhasOrgao = 0;
  const vencedores = new Map<string, [string, number][]>(); // idCompra → [[empresa, valor]]
  const I = Object.fromEntries(COLUNAS_CONTRATO.map((c, i) => [c, i])) as Record<string, number>;
  await emParalelo(orgaos, 4, async (cod, k) => {
    try {
      await todasAsPaginas("/modulo-contratos/1.2_consultarContratos_FimVigencia", { codigoOrgao: cod, dataVigenciaFinalMin: desde, dataVigenciaFinalMax: "2099-12-31" }, (rs) => {
        for (const r of rs) {
          lidos++;
          const n = normalizarContrato(r, uasg);
          if ("descarte" in n) { descartes[n.descarte] = (descartes[n.descarte] ?? 0) + 1; continue; }
          const id = String(n.linha[I.id]);
          if (vistos.has(id)) { descartes["registro repetido"] = (descartes["registro repetido"] ?? 0) + 1; continue; }
          vistos.add(id);
          const idc = String(n.linha[I.idCompra]);
          if (idc) { const l = vencedores.get(idc) ?? []; l.push([String(n.linha[I.fornecedor]), Number(n.linha[I.valorGlobal])]); vencedores.set(idc, l); }
          if (n.empenho) { empenhos.qtd++; empenhos.valor += Number(n.linha[I.valorGlobal]) || 0; continue; }
          (porUF[n.uf] ??= []).push(n.linha);
        }
      });
    } catch (e) {
      falhasOrgao++;
      console.log(`  ✗ órgão ${cod}: ${(e as Error).message.slice(0, 160)}`);
    }
    if ((k + 1) % 50 === 0) console.log(`  … ${k + 1}/${orgaos.length} órgãos, ${lidos.toLocaleString("pt-BR")} registros lidos, ${requisicoes} requisições, ${Math.round((Date.now() - inicio) / 60000)} min`);
  });
  if (falhasOrgao > orgaos.length * 0.1) throw new Error(`[contratos] ${falhasOrgao} de ${orgaos.length} órgãos falharam; dados não publicados.`);

  const dirC = join(saida, "contratos");
  mkdirSync(dirC, { recursive: true });
  for (const u of [...UFS.map((x) => x.sigla), "NI"]) {
    const itens = (porUF[u] ?? []).sort((a, b) => Number(b[I.valorGlobal]) - Number(a[I.valorGlobal]));
    await writeFile(join(dirC, `${u}.json`), JSON.stringify({ uf: u, referencia: hoje, processadoEm, colunas: COLUNAS_CONTRATO, itens }));
  }
  const resumo = resumirContratos(porUF, empenhos, hoje);
  await writeFile(join(dirC, "resumo.json"), JSON.stringify({ processadoEm, desde, parcial: !!opts.orgaos?.length, orgaosConsultados: orgaos.length, ...resumo }));
  const mantidos = Object.values(porUF).reduce((s, x) => s + x.length, 0);
  console.log(`  ✓ contratos: ${mantidos.toLocaleString("pt-BR")} contratos (${resumo.totais.vigentes.toLocaleString("pt-BR")} vigentes) + ${empenhos.qtd.toLocaleString("pt-BR")} notas de empenho; ${falhasOrgao} órgãos com falha`);
  const manifestos: ManifestoConjunto[] = [{
    conjunto: "contratos", ano, origem: "oficial", fonte: FONTE_CONTRATOS,
    arquivos: [{ nome: "API 1.2_consultarContratos_FimVigencia", url: `${API}/modulo-contratos/1.2_consultarContratos_FimVigencia?dataVigenciaFinalMin=${desde}`, periodo: `fim de vigência desde ${desde}`, baixadoEm: processadoEm, bytes: 0, linhasLidas: lidos, linhasDescartadas: Object.values(descartes).reduce((s, x) => s + x, 0) + empenhos.qtd, motivosDescarte: { ...descartes, "nota de empenho (só no resumo)": empenhos.qtd } }],
    mesesDisponiveis: [], processadoEm, linhasAgregadas: mantidos,
    avisos: [
      `Consultados ${orgaos.length} órgãos federais; ${falhasOrgao} falharam.`,
      `${resumo.totais.semLocal.toLocaleString("pt-BR")} contratos sem UF da unidade contratante (lista "NI").`,
      "O local é o da unidade que assinou o contrato, não necessariamente onde o serviço é prestado.",
    ],
  }];

  // 4. Licitações e contratações diretas (PNCP, Lei 14.133), só órgãos federais
  if (!opts.semLicitacoes) {
    const licUF: Record<string, (string | number | unknown[])[][]> = {};
    const descL: Record<string, number> = {};
    let lidasL = 0;
    const fim = hoje;
    for (let mod = 1; mod <= 14; mod++) {
      // Janelas mensais para não pedir intervalos longos demais
      for (let d = new Date(`${licDesde}T00:00:00Z`); d.toISOString().slice(0, 10) <= fim; d.setUTCMonth(d.getUTCMonth() + 1)) {
        const ini = d.toISOString().slice(0, 10);
        const f = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).toISOString().slice(0, 10);
        try {
          await todasAsPaginas("/modulo-contratacoes/1_consultarContratacoes_PNCP_14133", { dataPublicacaoPncpInicial: ini, dataPublicacaoPncpFinal: f < fim ? f : fim, codigoModalidade: mod }, (rs) => {
            for (const r of rs) {
              lidasL++;
              const n = normalizarContratacao(r);
              if ("descarte" in n) { descL[n.descarte] = (descL[n.descarte] ?? 0) + 1; continue; }
              const v = vencedores.get(String(n.linha[0]));
              if (v) n.linha[15] = v.slice(0, 8);
              (licUF[n.uf] ??= []).push(n.linha);
            }
          });
        } catch (e) {
          const msg = (e as Error).message;
          if (/^400|^404/.test(msg)) { console.log(`  modalidade ${mod}: não existe (${msg.slice(0, 80)})`); break; }
          console.log(`  ✗ licitações modalidade ${mod} ${ini}: ${msg.slice(0, 160)}`);
        }
      }
      console.log(`  … modalidade ${mod}: ${lidasL.toLocaleString("pt-BR")} registros lidos até agora`);
    }
    const dirL = join(saida, "licitacoes");
    mkdirSync(dirL, { recursive: true });
    const vistosL = new Set<string>();
    let mantidasL = 0;
    for (const u of [...UFS.map((x) => x.sigla), "NI"]) {
      const itens = (licUF[u] ?? []).filter((l) => { const k = String(l[0]); if (vistosL.has(k)) return false; vistosL.add(k); return true; })
        .sort((a, b) => String(b[12]).localeCompare(String(a[12])));
      mantidasL += itens.length;
      await writeFile(join(dirL, `${u}.json`), JSON.stringify({ uf: u, referencia: hoje, processadoEm, colunas: COLUNAS_LICITACAO, itens }));
    }
    console.log(`  ✓ licitacoes: ${mantidasL.toLocaleString("pt-BR")} contratações federais publicadas desde ${licDesde}`);
    manifestos.push({
      conjunto: "licitacoes", ano, origem: "oficial", fonte: FONTE_LICITACOES,
      arquivos: [{ nome: "API 1_consultarContratacoes_PNCP_14133", url: `${API}/modulo-contratacoes/1_consultarContratacoes_PNCP_14133?dataPublicacaoPncpInicial=${licDesde}`, periodo: `publicadas desde ${licDesde}`, baixadoEm: processadoEm, bytes: 0, linhasLidas: lidasL, linhasDescartadas: Object.values(descL).reduce((s, x) => s + x, 0), motivosDescarte: descL }],
      mesesDisponiveis: [], processadoEm, linhasAgregadas: mantidasL,
      avisos: ["Inclui licitações (pregão, concorrência…) e contratações diretas (dispensa, inexigibilidade) publicadas no PNCP pela Lei 14.133. Processos pela lei antiga (8.666) não entram."],
    });
  }
  await atualizarManifesto(saida, manifestos);
  console.log(`  concluído em ${Math.round((Date.now() - inicio) / 60000)} min, ${requisicoes} requisições`);
}

if (process.argv[1]?.endsWith("contratos.ts")) {
  const a = process.argv.slice(2);
  const get = (n: string) => (a.includes(n) ? a[a.indexOf(n) + 1] : undefined);
  executarContratos({ desde: get("--desde"), licitacoesDesde: get("--licitacoes-desde"), orgaos: get("--orgaos")?.split(","), semLicitacoes: a.includes("--sem-licitacoes") }).catch((e) => {
    console.error(`\nErro no ETL de contratos: ${(e as Error).message}`);
    process.exit(1);
  });
}
