/**
 * ETL dos dados abertos do Portal da Transparência → cubos pré-agregados.
 *
 * Uso:
 *   npm run etl -- --ano 2025
 *   npm run etl -- --ano 2025 --conjuntos orcamento,execucao --meses 1-9
 *   npm run etl -- --ano 2025 --arquivo transferencias=./downloads/202501_Transferencias.zip
 *        (processa arquivos baixados manualmente; pode repetir --arquivo)
 *
 * Saída: data/agregados/<ano>/<conjunto>.json e data/agregados/manifesto.json
 */
import { createWriteStream, existsSync, mkdirSync, statSync } from "node:fs";
import { readFile, rm, writeFile } from "node:fs/promises";
import { join, basename } from "node:path";
import { tmpdir } from "node:os";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import type { ArquivoProcessado, Manifesto, ManifestoConjunto } from "../../src/lib/dados/tipos";
import { lerCSV, paraCadaCSV } from "./csv";
import { CONJUNTOS_ETL, criarProcessador, type ConjuntoETL, type Processador } from "./processadores";
import { FONTES, periodos, urlsCandidatas } from "./fontes";
import { carregarIndiceMunicipios } from "./municipios";

interface Opcoes {
  ano: number;
  conjuntos: ConjuntoETL[];
  meses: number[];
  arquivos: Partial<Record<ConjuntoETL, string[]>>;
  saida: string;
}

export function lerArgs(argv: string[]): Opcoes {
  const get = (n: string) => {
    const i = argv.indexOf(n);
    return i >= 0 ? argv[i + 1] : undefined;
  };
  const ano = Number(get("--ano") ?? new Date().getFullYear());
  if (!Number.isInteger(ano) || ano < 2014 || ano > 2100) throw new Error(`Ano inválido: ${get("--ano")}`);
  const conjuntos = (get("--conjuntos")?.split(",") ?? [...CONJUNTOS_ETL]) as ConjuntoETL[];
  for (const c of conjuntos) if (!CONJUNTOS_ETL.includes(c)) throw new Error(`Conjunto desconhecido: ${c}`);
  let meses = Array.from({ length: 12 }, (_, i) => i + 1);
  // No ano corrente, não tenta baixar meses que ainda não terminaram de ser publicados no futuro.
  const hoje = new Date();
  if (ano === hoje.getFullYear()) meses = meses.filter((x) => x <= hoje.getMonth() + 1);
  const m = get("--meses");
  if (m) {
    const [a, b] = m.split("-").map(Number);
    meses = meses.filter((x) => x >= a && x <= (b ?? a));
  }
  const arquivos: Opcoes["arquivos"] = {};
  argv.forEach((a, i) => {
    if (a !== "--arquivo") return;
    const [c, p] = argv[i + 1].split("=");
    (arquivos[c as ConjuntoETL] ??= []).push(p);
  });
  return { ano, conjuntos, meses, arquivos, saida: get("--saida") ?? join(process.cwd(), "data", "agregados") };
}

async function baixar(urls: string[], destino: string): Promise<{ url: string; bytes: number } | null> {
  for (const url of urls) {
    try {
      const r = await fetch(url, { redirect: "follow", signal: AbortSignal.timeout(15 * 60_000) });
      const tipo = r.headers.get("content-type") ?? "";
      if (!r.ok || !r.body || tipo.includes("text/html")) {
        console.warn(`    ${r.status} ${url}`);
        continue;
      }
      await pipeline(Readable.fromWeb(r.body as never), createWriteStream(destino));
      return { url: r.url || url, bytes: statSync(destino).size };
    } catch (e) {
      console.warn(`    falhou ${url}: ${(e as Error).message}`);
    }
  }
  return null;
}

async function processarArquivo(p: Processador, caminho: string): Promise<void> {
  let reconhecido = false;
  const vistos: string[] = [];
  await paraCadaCSV(caminho, async (nome, fluxo) => {
    let usar = true;
    await lerCSV(
      fluxo,
      (cols) => {
        // Arquivos .zip podem ter vários CSVs (ex.: emendas). Processa apenas o reconhecido.
        if (!p.reconhece(cols)) {
          usar = false;
          vistos.push(`${basename(nome)}: ${cols.join(", ")}`);
          console.log(`    ignorado ${nome} (estrutura diferente)`);
          return;
        }
        p.configurar(cols);
        reconhecido = true;
        console.log(`    lendo ${nome}`);
      },
      (l) => usar && p.processar(l),
    );
  });
  if (!reconhecido) {
    // Força a mensagem de erro detalhada com as colunas encontradas.
    const esperado = Object.entries(p.obrigatorias).map(([k, a]) => `${k} (${a[0]})`).join(", ");
    throw new Error(
      `[${p.conjunto}] Nenhum CSV com a estrutura esperada em ${basename(caminho)}.\nColunas esperadas (normalizadas): ${esperado}\nColunas encontradas: ${vistos.join(" | ")}`,
    );
  }
}

export async function executarETL(o: Opcoes): Promise<ManifestoConjunto[]> {
  const mun = carregarIndiceMunicipios();
  const dirAno = join(o.saida, String(o.ano));
  mkdirSync(dirAno, { recursive: true });
  const tmp = join(tmpdir(), `bt-etl-${process.pid}`);
  mkdirSync(tmp, { recursive: true });
  const resultados: ManifestoConjunto[] = [];

  const falhas: string[] = [];
  for (const c of o.conjuntos) {
    try {
      resultados.push(...(await processarConjunto(c)));
    } catch (e) {
      const msg = `[${c}] ${(e as Error).message}`;
      console.error(`  ✗ ${msg}`);
      falhas.push(msg);
      resultados.push(manifesto(c, o.ano, FONTES[c], [], [], [`Falha no processamento: ${(e as Error).message.split("\n")[0]}`], 0));
    }
  }

  async function processarConjunto(c: ConjuntoETL): Promise<ManifestoConjunto[]> {
    const resultados: ManifestoConjunto[] = [];
    const fonte = FONTES[c];
    const p = criarProcessador(c, o.ano, mun);
    const arquivos: ArquivoProcessado[] = [];
    const avisos: string[] = [];
    const meses = new Set<number>();
    console.log(`\n▶ ${fonte.nome} — ${o.ano}`);

    const fila: { caminho: string; url: string | null; periodo: string; bytes: number }[] = [];
    if (o.arquivos[c]?.length) {
      for (const caminho of o.arquivos[c]!) fila.push({ caminho, url: null, periodo: "arquivo local", bytes: statSync(caminho).size });
    } else {
      for (const per of periodos(fonte, o.ano, o.meses)) {
        const destino = join(tmp, `${c}-${per}.zip`);
        console.log(`  baixando ${per}…`);
        const r = await baixar(urlsCandidatas(fonte, per), destino);
        if (!r) {
          avisos.push(`Período ${per} indisponível para download.`);
          continue;
        }
        fila.push({ caminho: destino, url: r.url, periodo: per, bytes: r.bytes });
      }
    }

    for (const f of fila) {
      const antes = { lidas: p.lidas, desc: { ...p.descartes } };
      await processarArquivo(p, f.caminho);
      const descNovos: Record<string, number> = {};
      let totDesc = 0;
      for (const [k, v] of Object.entries(p.descartes)) {
        const d = v - (antes.desc[k] ?? 0);
        if (d) {
          descNovos[k] = d;
          totDesc += d;
        }
      }
      arquivos.push({
        nome: basename(f.caminho),
        url: f.url,
        periodo: f.periodo,
        baixadoEm: new Date().toISOString(),
        bytes: f.bytes,
        linhasLidas: p.lidas - antes.lidas,
        linhasDescartadas: totDesc,
        motivosDescarte: descNovos,
      });
      if (/^\d{6}$/.test(f.periodo)) meses.add(Number(f.periodo.slice(4)));
    }

    if (!arquivos.length) {
      console.warn(`  ✗ nenhum arquivo processado para ${c}`);
      resultados.push(manifesto(c, o.ano, fonte, arquivos, [], [...avisos, "Nenhum arquivo processado."], 0));
      return resultados;
    }

    const naoId = Object.entries(p.locaisNaoIdentificados).sort((a, b) => b[1] - a[1]);
    if (naoId.length)
      avisos.push(
        `Linhas sem UF identificável classificadas como "Localização não identificada": ${naoId
          .slice(0, 8)
          .map(([k, v]) => `${k} (${v})`)
          .join(", ")}${naoId.length > 8 ? "…" : ""}.`,
      );
    if (p.municipiosSemCorrespondencia)
      avisos.push(`${p.municipiosSemCorrespondencia} linhas com nome de município sem correspondência na malha do IBGE.`);
    if ("favorecidosPFOmitidos" in p && (p as { favorecidosPFOmitidos: number }).favorecidosPFOmitidos)
      avisos.push(
        `${(p as { favorecidosPFOmitidos: number }).favorecidosPFOmitidos} linhas de favorecidos pessoa física não são listadas individualmente (privacidade); os valores permanecem nos totais.`,
      );

    let total = 0;
    for (const b of p.cubos()) {
      const cubo = b.construir();
      total += cubo.linhas.length;
      await writeFile(join(dirAno, `${cubo.conjunto}.json`), JSON.stringify(cubo));
      console.log(`  ✓ ${cubo.conjunto}: ${cubo.linhas.length} linhas agregadas`);
    }
    // Para conjuntos com arquivo local, deduz meses dos dados do cubo principal.
    if (!meses.size && fonte.periodicidade === "mensal") {
      const principal = p.cubos()[0].construir();
      const iMes = principal.dimensoes.indexOf("mes");
      for (const l of principal.linhas) meses.add(l[iMes]);
    }
    resultados.push(manifesto(c, o.ano, fonte, arquivos, [...meses].sort((a, b) => a - b), avisos, total));
    return resultados;
  }

  await rm(tmp, { recursive: true, force: true });
  const aviso = await verificarConsistencia(dirAno);
  if (aviso) {
    console.warn(`\n⚠ ${aviso}`);
    for (const r of resultados) if (r.conjunto === "execucao" || r.conjunto === "orcamento") r.avisos.push(aviso);
  }
  await atualizarManifesto(o.saida, resultados);
  if (falhas.length) throw new Error(`Falharam ${falhas.length} conjunto(s):\n${falhas.join("\n")}`);
  return resultados;
}

/**
 * Teste de consistência entre fontes: o empenhado somado dos arquivos mensais de
 * execução deve ficar próximo do "Orçamento Empenhado" do arquivo anual de orçamento
 * (extraídos em datas próximas). Uma diferença grande indica, por exemplo, arquivos
 * mensais acumulados (e não movimento do mês) ou meses faltando.
 */
export async function verificarConsistencia(dirAno: string, tolerancia = 0.05): Promise<string | null> {
  const ler = async (n: string) => (existsSync(join(dirAno, n)) ? JSON.parse(await readFile(join(dirAno, n), "utf8")) : null);
  const exe = await ler("execucao.json");
  const orc = await ler("orcamento.json");
  if (!exe || !orc) return null;
  const soma = (c: { dimensoes: string[]; medidas: string[]; linhas: number[][] }, m: string) => {
    const i = c.dimensoes.length + c.medidas.indexOf(m);
    return c.linhas.reduce((s, l) => s + Math.round(l[i] * 100), 0) / 100;
  };
  const e = soma(exe, "empenhado");
  const o = soma(orc, "empenhado");
  if (!o) return null;
  const dif = Math.abs(e - o) / Math.abs(o);
  if (dif <= tolerancia) return null;
  return `Consistência: empenhado da execução mensal (${e.toLocaleString("pt-BR")}) difere ${(dif * 100).toFixed(1)}% do empenhado no arquivo de orçamento (${o.toLocaleString("pt-BR")}). Verifique meses faltantes ou datas de extração diferentes.`;
}

function manifesto(
  c: ConjuntoETL,
  ano: number,
  fonte: (typeof FONTES)[ConjuntoETL],
  arquivos: ArquivoProcessado[],
  meses: number[],
  avisos: string[],
  linhas: number,
): ManifestoConjunto {
  return {
    conjunto: c,
    ano,
    origem: "oficial",
    fonte: { nome: fonte.nome, url: fonte.pagina, dicionario: fonte.dicionario },
    arquivos,
    mesesDisponiveis: meses,
    processadoEm: new Date().toISOString(),
    avisos,
    linhasAgregadas: linhas,
  };
}

async function atualizarManifesto(saida: string, novos: ManifestoConjunto[]): Promise<void> {
  const arq = join(saida, "manifesto.json");
  let m: Manifesto = { geradoEm: new Date().toISOString(), modo: "oficial", conjuntos: [] };
  if (existsSync(arq)) m = JSON.parse(await readFile(arq, "utf8"));
  for (const n of novos) {
    m.conjuntos = m.conjuntos.filter((x) => !(x.conjunto === n.conjunto && x.ano === n.ano));
    m.conjuntos.push(n);
  }
  m.geradoEm = new Date().toISOString();
  m.modo = "oficial";
  await writeFile(arq, JSON.stringify(m, null, 2));
}

if (process.argv[1]?.endsWith("index.ts")) {
  executarETL(lerArgs(process.argv.slice(2))).catch((e) => {
    console.error(`\nErro no ETL: ${(e as Error).message}`);
    process.exit(1);
  });
}
