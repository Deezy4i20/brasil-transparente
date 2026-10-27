/**
 * ETL do arquivo "Convênios" do Portal da Transparência → projetos por município.
 *
 * Um convênio (ou contrato de repasse, termo de fomento etc.) é o instrumento oficial
 * pelo qual o governo federal repassa recursos para alguém EXECUTAR um objeto:
 * uma obra, uma compra, um serviço. Por isso é a fonte usada para "projetos":
 * tem objeto, executor (convenente), financiador (órgão concedente), local,
 * valores e vigência, todos publicados pela CGU.
 *
 * Dicionário: https://www.portaldatransparencia.gov.br/pagina-interna/603415-dicionario-de-dados-convenios
 *
 * Uso:
 *   npm run etl:convenios                       (baixa o arquivo mais recente)
 *   npm run etl:convenios -- --arquivo ./20261020_Convenios.zip
 *   npm run etl:convenios -- --desde 2024-01-01 (mantém convênios com fim de vigência a partir desta data)
 *
 * Saída:
 *   data/agregados/convenios/<UF>.json   lista de convênios por UF (para a aba Projetos e o painel da cidade)
 *   data/agregados/convenios/resumo.json totais por município e por UF
 *   + entrada "convenios" em data/agregados/manifesto.json
 */
import { mkdirSync, statSync } from "node:fs";
import { rm, writeFile } from "node:fs/promises";
import { join, basename } from "node:path";
import { tmpdir } from "node:os";
import type { ManifestoConjunto } from "../../src/lib/dados/tipos";
import { parseValorBR } from "../../src/lib/dinheiro";
import { resolverUF, UFS } from "../../src/lib/referencia/ufs";
import { lerCSV, paraCadaCSV, type Linha } from "./csv";
import { carregarIndiceMunicipios, localizarMunicipio, type IndiceMunicipios } from "./municipios";
import { createWriteStream } from "node:fs";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { atualizarManifesto } from "./index";

/**
 * Tenta baixar o arquivo de uma data. Uma única tentativa por URL, sem espera longa:
 * datas que ainda não existem respondem com erro e passamos para a anterior.
 */
async function tentarData(urls: string[], destino: string): Promise<{ url: string; status: number } | { status: number; erro: true }> {
  let ultimo = 0;
  for (const url of urls) {
    try {
      const r = await fetch(url, { redirect: "follow", signal: AbortSignal.timeout(15 * 60_000) });
      ultimo = r.status;
      const tipo = r.headers.get("content-type") ?? "";
      if (!r.ok || !r.body || tipo.includes("text/html")) {
        await r.body?.cancel();
        continue;
      }
      await pipeline(Readable.fromWeb(r.body as never), createWriteStream(destino));
      return { url: r.url || url, status: r.status };
    } catch {
      ultimo = -1;
    }
  }
  return { status: ultimo, erro: true };
}

export const FONTE_CONVENIOS = {
  nome: "Convênios — Portal da Transparência (CGU)",
  url: "https://portaldatransparencia.gov.br/download-de-dados/convenios",
  dicionario: "https://www.portaldatransparencia.gov.br/pagina-interna/603415-dicionario-de-dados-convenios",
};

/** Ordem das colunas de cada convênio na saída (o arquivo guarda arrays para ficar pequeno). */
export const COLUNAS_SAIDA = [
  "numero", "municipioCod", "municipio", "situacao", "objeto", "orgaoSuperior", "concedente",
  "convenente", "tipoConvenente", "instrumento", "valor", "liberado", "contrapartida",
  "inicio", "fim", "ultimaLiberacao", "publicacao",
] as const;

type Saida = (string | number | null)[];

const COLS: Record<string, string[]> = {
  numero: ["numeroconvenio"],
  uf: ["uf"],
  nomeMun: ["nomemunicipio"],
  situacao: ["situacaoconvenio"],
  objeto: ["objetodoconvenio", "objetoconvenio"],
  orgaoSup: ["nomeorgaosuperior"],
  concedente: ["nomeorgaoconcedente"],
  codConvenente: ["codigoconvenente"],
  tipoConvenente: ["tipoconvenente"],
  convenente: ["nomeconvenente"],
  instrumento: ["tipoinstrumento"],
  valor: ["valorconvenio"],
  liberado: ["valorliberado"],
  contrapartida: ["valorcontrapartida"],
  inicio: ["datainiciovigencia"],
  fim: ["datafimvigencia", "datafinalvigencia"], // o arquivo real usa "DATA FINAL VIGÊNCIA"
  ultima: ["dataultimaliberacao"],
  publicacao: ["datapublicacao"],
};

/** "31/12/2026" → "2026-12-31"; vazio ou inválido → null. */
export function dataISO(s: string | undefined): string | null {
  const m = s?.trim().match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  const i = s?.trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
  return i ? `${i[1]}-${i[2]}-${i[3]}` : null;
}

export interface ResultadoConvenios {
  porUF: Record<string, Saida[]>;
  lidas: number;
  mantidas: number;
  descartes: Record<string, number>;
  semMunicipio: number;
}

/** Processa um ou mais arquivos (zip ou csv) e devolve os convênios por UF. Função pura sobre os arquivos (testável). */
export async function processarConvenios(caminhos: string[], desde: string, idx: IndiceMunicipios): Promise<ResultadoConvenios> {
  const r: ResultadoConvenios = { porUF: {}, lidas: 0, mantidas: 0, descartes: {}, semMunicipio: 0 };
  const desc = (m: string) => (r.descartes[m] = (r.descartes[m] ?? 0) + 1);
  let reconhecido = false;
  const vistos: string[] = [];

  for (const caminho of caminhos) {
    await paraCadaCSV(caminho, async (nome, fluxo) => {
      let col: Record<string, string> | null = null;
      await lerCSV(
        fluxo,
        (cols) => {
          const s = new Set(cols);
          const mapa: Record<string, string> = {};
          const faltam: string[] = [];
          for (const [k, alts] of Object.entries(COLS)) {
            const a = alts.find((x) => s.has(x));
            if (a) mapa[k] = a;
            else faltam.push(k);
          }
          // O zip traz também "Convenios_OrdensBancarias": só o arquivo principal tem objeto e convenente.
          if (faltam.length) {
            vistos.push(`${basename(nome)}: faltam ${faltam.join(", ")} | colunas: ${cols.join(", ")}`);
            return;
          }
          col = mapa;
          reconhecido = true;
          console.log(`    lendo ${basename(nome)}`);
        },
        (l: Linha) => {
          if (!col) return;
          r.lidas++;
          const v = (k: string) => (l[col![k]] ?? "").trim();
          const fim = dataISO(v("fim"));
          if (fim && fim < desde) return desc("vigência terminou antes do período considerado");
          const numero = v("numero");
          if (!numero) return desc("sem número do convênio");
          const uf = resolverUF(v("uf"));
          const ufCod = uf?.sigla ?? "NI";
          let munCod: string | null = null;
          let munNome = v("nomeMun");
          if (uf && munNome) {
            const m = localizarMunicipio(idx, uf.sigla, munNome);
            if (m.correspondencia === "nome") {
              munCod = m.cod;
              munNome = m.nome;
            } else r.semMunicipio++;
          } else r.semMunicipio++;
          // Convenente pessoa física (CPF): não expõe o nome.
          const codConv = v("codConvenente").replace(/\D/g, "");
          const pf = codConv.length === 11 || /f[ií]sica/i.test(v("tipoConvenente"));
          const linha: Saida = [
            numero,
            munCod,
            munNome || null,
            v("situacao") || null,
            v("objeto") || null,
            v("orgaoSup") || null,
            v("concedente") || null,
            pf ? "Pessoa física (nome não exibido)" : v("convenente") || null,
            v("tipoConvenente") || null,
            v("instrumento") || null,
            parseValorBR(v("valor")),
            parseValorBR(v("liberado")),
            parseValorBR(v("contrapartida")),
            dataISO(v("inicio")),
            fim,
            dataISO(v("ultima")),
            dataISO(v("publicacao")),
          ];
          (r.porUF[ufCod] ??= []).push(linha);
          r.mantidas++;
        },
      );
    });
  }
  if (!reconhecido) throw new Error(`[convenios] Nenhum CSV com a estrutura esperada.\n${vistos.join("\n")}`);
  return r;
}

/** Totais por município e UF (para o mapa e o painel da cidade). Situação calculada pela data de referência. */
export function resumir(porUF: Record<string, Saida[]>, referencia: string) {
  const iV = COLUNAS_SAIDA.indexOf("valor"), iL = COLUNAS_SAIDA.indexOf("liberado");
  const iI = COLUNAS_SAIDA.indexOf("inicio"), iF = COLUNAS_SAIDA.indexOf("fim"), iM = COLUNAS_SAIDA.indexOf("municipioCod");
  const porMunicipio: Record<string, [number, number, number, number, number]> = {}; // [qtd, valor, liberado, futuros, vigentes]
  const porUFRes: Record<string, [number, number, number, number, number]> = {};
  for (const [uf, itens] of Object.entries(porUF)) {
    for (const c of itens) {
      const ini = c[iI] as string | null, fim = c[iF] as string | null;
      const futuro = ini !== null && ini > referencia;
      const vigente = !futuro && (fim === null || fim >= referencia);
      for (const [mapa, k] of [[porUFRes, uf], [porMunicipio, c[iM] as string | null]] as const) {
        if (!k) continue;
        const a = (mapa[k] ??= [0, 0, 0, 0, 0]);
        a[0]++;
        a[1] += (c[iV] as number) ?? 0;
        a[2] += (c[iL] as number) ?? 0;
        if (futuro) a[3]++;
        if (vigente) a[4]++;
      }
    }
  }
  const arred = (o: Record<string, number[]>) => Object.fromEntries(Object.entries(o).map(([k, a]) => [k, a.map((x) => Math.round(x * 100) / 100)]));
  return { porMunicipio: arred(porMunicipio), porUF: arred(porUFRes) };
}

function datasCandidatas(dias = 21): string[] {
  const out: string[] = [];
  for (let i = 0; i <= dias; i++) {
    const d = new Date(Date.now() - i * 86_400_000);
    out.push(d.toISOString().slice(0, 10).replace(/-/g, ""));
  }
  return out;
}

export async function executarConvenios(opts: { arquivos?: string[]; desde?: string; saida?: string } = {}) {
  const saida = opts.saida ?? join(process.cwd(), "data", "agregados");
  const dir = join(saida, "convenios");
  mkdirSync(dir, { recursive: true });
  const desde = opts.desde ?? `${new Date().getFullYear() - 1}-01-01`;
  const idx = carregarIndiceMunicipios();
  const tmp = join(tmpdir(), `bt-conv-${process.pid}`);
  mkdirSync(tmp, { recursive: true });
  console.log(`\n▶ ${FONTE_CONVENIOS.nome} (vigência a partir de ${desde})`);

  let caminhos = opts.arquivos ?? [];
  let url: string | null = null;
  let periodo = "arquivo local";
  if (!caminhos.length) {
    // O Portal publica o arquivo com a data de geração (AAAAMMDD). Procura o mais recente.
    for (const d of datasCandidatas()) {
      const destino = join(tmp, `convenios-${d}.zip`);
      await new Promise((ok) => setTimeout(ok, 1500));
      const r = await tentarData(
        [
          `https://dadosabertos-download.cgu.gov.br/PortalDaTransparencia/saida/convenios/${d}_Convenios.zip`,
          `https://portaldatransparencia.gov.br/download-de-dados/convenios/${d}`,
        ],
        destino,
      );
      console.log(`  procurando arquivo de ${d}… ${"erro" in r ? `não encontrado (${r.status})` : "encontrado"}`);
      if (!("erro" in r)) {
        caminhos = [destino];
        url = r.url;
        periodo = d;
        break;
      }
    }
    if (!caminhos.length) throw new Error("[convenios] Nenhum arquivo de convênios encontrado nos últimos 21 dias.");
  }

  const res = await processarConvenios(caminhos, desde, idx);
  const referencia = periodo.match(/^\d{8}$/) ? `${periodo.slice(0, 4)}-${periodo.slice(4, 6)}-${periodo.slice(6)}` : new Date().toISOString().slice(0, 10);
  const processadoEm = new Date().toISOString();
  for (const u of [...UFS.map((x) => x.sigla), "NI"]) {
    const itens = res.porUF[u] ?? [];
    await writeFile(join(dir, `${u}.json`), JSON.stringify({ uf: u, referencia, processadoEm, colunas: COLUNAS_SAIDA, itens }));
  }
  const resumo = resumir(res.porUF, referencia);
  await writeFile(join(dir, "resumo.json"), JSON.stringify({ referencia, processadoEm, colunas: ["quantidade", "valor", "liberado", "futuros", "vigentes"], ...resumo }));

  const avisos = [
    `Mantidos ${res.mantidas.toLocaleString("pt-BR")} convênios com fim de vigência a partir de ${desde} (ou sem data de fim).`,
    res.semMunicipio ? `${res.semMunicipio.toLocaleString("pt-BR")} convênios sem município identificado na malha do IBGE (aparecem só na lista do estado).` : "",
  ].filter(Boolean);
  const m: ManifestoConjunto = {
    conjunto: "convenios",
    ano: Number(referencia.slice(0, 4)),
    origem: "oficial",
    fonte: FONTE_CONVENIOS,
    arquivos: caminhos.map((c) => ({
      nome: basename(c),
      url,
      periodo,
      baixadoEm: processadoEm,
      bytes: statSync(c).size,
      linhasLidas: res.lidas,
      linhasDescartadas: Object.values(res.descartes).reduce((s, x) => s + x, 0),
      motivosDescarte: res.descartes,
    })),
    mesesDisponiveis: [],
    processadoEm,
    avisos,
    linhasAgregadas: res.mantidas,
  };
  await atualizarManifesto(saida, [m]);
  await rm(tmp, { recursive: true, force: true });
  console.log(`  ✓ convenios: ${res.mantidas} convênios em ${Object.keys(res.porUF).length} UFs (arquivo de ${referencia})`);
  return { res, resumo, referencia };
}

if (process.argv[1]?.endsWith("convenios.ts")) {
  const a = process.argv.slice(2);
  const get = (n: string) => (a.includes(n) ? a[a.indexOf(n) + 1] : undefined);
  const arquivos = a.flatMap((x, i) => (x === "--arquivo" ? [a[i + 1]] : []));
  executarConvenios({ arquivos: arquivos.length ? arquivos : undefined, desde: get("--desde") }).catch((e) => {
    console.error(`\nErro no ETL de convênios: ${(e as Error).message}`);
    process.exit(1);
  });
}
