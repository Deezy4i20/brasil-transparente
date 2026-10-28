/**
 * Gera o "modelo inicial" navegável (uma única página HTML) a partir dos cubos
 * em data/demo (ou data/agregados com --oficial). Usado para revisar a interface
 * sem servidor. Saída: prototipo/brasil-transparente-modelo.html
 *
 *   npm run demo && npx tsx scripts/exportar-modelo.ts
 */
import { readFileSync, writeFileSync, existsSync, readdirSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import type { Cubo, Manifesto } from "../src/lib/dados/tipos";
import { UFS } from "../src/lib/referencia/ufs";

const oficial = process.argv.includes("--oficial");
const DIR = join(process.cwd(), "data", oficial ? "agregados" : "demo");
const OUT = join(process.cwd(), "prototipo");

const ler = (ano: number, c: string): Cubo | null => {
  const p = join(DIR, String(ano), `${c}.json`);
  return existsSync(p) ? JSON.parse(readFileSync(p, "utf8")) : null;
};
const anos = readdirSync(DIR).filter((n) => /^\d{4}$/.test(n)).map(Number).sort();
const manifesto: Manifesto = JSON.parse(readFileSync(join(DIR, "manifesto.json"), "utf8"));

// Dicionários globais (código → índice) compartilhados entre anos
const dic: Record<string, { cod: string; nome: string }[]> = { orgao: [], funcao: [], programa: [], tipo: [], autor: [] };
const idx: Record<string, Map<string, number>> = {};
const di = (d: string, it: { cod: string; nome: string }) => {
  const m = (idx[d] ??= new Map());
  let i = m.get(it.cod);
  if (i === undefined) {
    i = dic[d].length;
    m.set(it.cod, i);
    dic[d].push({ cod: it.cod, nome: it.nome });
  }
  return i;
};
const UFI = new Map(UFS.map((u, i) => [u.sigla, i]));
const ufIdx = (s: string) => UFI.get(s) ?? -1; // -1 = não identificada
const r2 = (v: number) => Math.round(v * 100) / 100;

/** Reagrupa um cubo por um subconjunto de dimensões, mapeando para índices globais. */
function reagrupar(c: Cubo | null, dims: string[], medidas: string[]): number[][] {
  if (!c) return [];
  const pos = dims.map((d) => c.dimensoes.indexOf(d));
  const mpos = medidas.map((m) => c.dimensoes.length + c.medidas.indexOf(m));
  const acc = new Map<string, number[]>();
  for (const l of c.linhas) {
    const chave = dims.map((d, k) => {
      const v = l[pos[k]];
      if (d === "mes") return v;
      const it = c.dicionarios[d][v];
      if (d === "uf") return ufIdx(it.cod);
      if (d === "orgaoSuperior") return di("orgao", it);
      if (d === "municipio") return it.cod.startsWith("NI") ? -1 : Number(it.cod);
      return di(d === "tipoFavorecido" ? "tipo" : d, it);
    });
    const k = chave.join("|");
    let a = acc.get(k);
    if (!a) acc.set(k, (a = [...chave, ...medidas.map(() => 0)]));
    mpos.forEach((p, j) => (a![dims.length + j] += l[p]));
  }
  return [...acc.values()].map((a) => a.map((v, i) => (i < dims.length ? v : r2(v))));
}

const porAno: Record<number, unknown> = {};
const nomesMun: Record<string, string> = {};
for (const ano of anos) {
  const em = ler(ano, "emendas");
  const emendas = em
    ? em.linhas.map((l) => {
        const g = (d: string) => em.dicionarios[d][l[em.dimensoes.indexOf(d)]];
        const v = (m: string) => r2(l[em.dimensoes.length + em.medidas.indexOf(m)]);
        const mu = g("municipio");
        return [g("emenda").cod, g("emenda").nome, di("autor", g("autor")), ufIdx(g("uf").cod), mu.nome, di("funcao", g("funcao")), v("empenhado"), v("pago"), /^\d{7}$/.test(mu.cod) ? Number(mu.cod) : -1];
      })
    : [];
  for (const c of ["transferencias_municipios", "execucao_municipios"]) {
    const cb = ler(ano, c);
    for (const it of cb?.dicionarios.municipio ?? []) if (!it.cod.startsWith("NI")) nomesMun[it.cod] = it.nome;
  }
  const fav = ler(ano, "transferencias_favorecidos");
  const mc = (c: string) => manifesto.conjuntos.find((x) => x.ano === ano && x.conjunto === c);
  const ok = (c: string) => Boolean(ler(ano, c) && (mc(c)?.arquivos.length ?? 0) > 0);
  porAno[ano] = {
    disp: { orc: ok("orcamento"), exe: ok("execucao"), tra: ok("transferencias"), emendas: ok("emendas"), fav: ok("transferencias_favorecidos") || ok("transferencias") },
    meses: mc("execucao")?.mesesDisponiveis ?? [],
    mesesTra: mc("transferencias")?.mesesDisponiveis ?? [],
    orc: reagrupar(ler(ano, "orcamento"), ["orgaoSuperior", "funcao", "programa"], ["atualizado", "empenhado"]),
    exe: reagrupar(ler(ano, "execucao"), ["mes", "uf", "orgaoSuperior", "funcao", "programa"], ["empenhado", "liquidado", "pago"]),
    tra: reagrupar(ler(ano, "transferencias"), ["mes", "uf", "funcao", "tipo"], ["valor"]),
    traMun: reagrupar(ler(ano, "transferencias_municipios"), ["uf", "municipio", "funcao"], ["valor"]),
    // Mês a mês por cidade (sem área), para o gráfico "subiu ou caiu" da cidade.
    traMunMes: reagrupar(ler(ano, "transferencias_municipios"), ["uf", "municipio", "mes"], ["valor"]),
    exeMun: reagrupar(ler(ano, "execucao_municipios"), ["uf", "municipio", "funcao"], ["pago"]),
    emendas,
    // Só os 40 maiores favorecidos por UF (a lista completa fica no software).
    favorecidos: fav
      ? Object.values(
          fav.linhas
            .map((l) => [ufIdx(fav.dicionarios.uf[l[0]].cod), fav.dicionarios.favorecido[l[1]].nome, fav.dicionarios.tipoFavorecido[l[2]].nome, r2(l[3])] as [number, string, string, number])
            .reduce<Record<number, [number, string, string, number][]>>((acc, r) => ((acc[r[0]] ??= []).push(r), acc), {}),
        ).flatMap((lista) => lista.sort((x, y) => y[3] - x[3]).slice(0, 40))
      : [],
  };
}

const geo = join(process.cwd(), "data", "geo");
const munTopo: Record<string, unknown> = {};
for (const u of UFS) {
  const p = join(geo, "municipios", `${u.cod}.topo.json`);
  if (existsSync(p)) munTopo[u.cod] = JSON.parse(readFileSync(p, "utf8"));
}

// Convênios (projetos): resumo por município embutido; listas por UF ficam em arquivos separados.
const dirConv = join(DIR, "convenios");
const convResumo = existsSync(join(dirConv, "resumo.json")) ? JSON.parse(readFileSync(join(dirConv, "resumo.json"), "utf8")) : null;

// Contratos e licitações: resumo embutido (sem a lista por município), listas por UF em arquivos separados.
const dirContr = join(DIR, "contratos"), dirLic = join(DIR, "licitacoes");
const contratosLido = existsSync(join(dirContr, "resumo.json")) ? JSON.parse(readFileSync(join(dirContr, "resumo.json"), "utf8")) : null;
// Só publica coletas completas (todos os órgãos federais). Coletas de teste (--orgaos) ficam fora do site.
const orgaosNoManifesto = Number(manifesto.conjuntos.find((c) => c.conjunto === "contratos")?.avisos.join(" ").match(/Consultados (\d+) órgãos/)?.[1] ?? 0);
const contratosResumo = contratosLido && (contratosLido.parcial === false || (contratosLido.parcial === undefined && orgaosNoManifesto >= 100)) ? contratosLido : null;
if (contratosLido && !contratosResumo) console.log("Contratos: coleta parcial ou de teste — não publicada no site.");
function copiarPasta(origem: string, destino: string) {
  if (!existsSync(origem)) return;
  mkdirSync(destino, { recursive: true });
  for (const f of readdirSync(origem)) if (f.endsWith(".json")) writeFileSync(join(destino, f), readFileSync(join(origem, f)));
}

/** Ligações emenda → convênio só dos convênios que aparecem no site, sem autor "Sem informação". */
function emendasConvReduzido(): string {
  const arq = join(dirConv, "emendas.json");
  if (!existsSync(arq)) return JSON.stringify({ porConvenio: {} });
  const todos = JSON.parse(readFileSync(arq, "utf8")).porConvenio as Record<string, string[][]>;
  const usados = new Set<string>();
  for (const f of readdirSync(dirConv)) if (/^[A-Z]{2}\.json$/.test(f)) for (const c of JSON.parse(readFileSync(join(dirConv, f), "utf8")).itens) usados.add(String(c[0]));
  const out: Record<string, string[][]> = {};
  for (const [k, v] of Object.entries(todos)) { if (!usados.has(k)) continue; const l = v.filter((e) => e[1] && !/sem informa/i.test(e[1])); if (l.length) out[k] = l; }
  return JSON.stringify({ porConvenio: out });
}

const dados = {
  convResumo,
  contratosResumo,
  modo: oficial ? "oficial" : "demonstracao",
  conjuntos: manifesto.conjuntos
    .sort((a, b) => b.ano - a.ano || a.conjunto.localeCompare(b.conjunto))
    .map((c) => ({
      ano: c.ano,
      conjunto: c.conjunto,
      nome: c.fonte.nome,
      url: c.fonte.url,
      dicionario: c.fonte.dicionario || null,
      arquivos: c.arquivos.map((a) => ({ nome: a.nome, url: a.url, periodo: a.periodo, baixadoEm: a.baixadoEm, lidas: a.linhasLidas, descartadas: a.linhasDescartadas })),
      meses: c.mesesDisponiveis,
      lidas: c.arquivos.reduce((s, a) => s + a.linhasLidas, 0),
      descartadas: c.arquivos.reduce((s, a) => s + a.linhasDescartadas, 0),
      em: c.processadoEm,
      avisos: c.avisos,
    })),
  geradoEm: manifesto.geradoEm,
  anos,
  ufs: UFS,
  dic,
  porAno,
  nomesMun,
  topoUfs: JSON.parse(readFileSync(join(geo, "ufs.topo.json"), "utf8")),
  munTopo,
};

const modelo = readFileSync(join(OUT, "modelo.template.html"), "utf8");
mkdirSync(OUT, { recursive: true });
const json = JSON.stringify(dados).replace(/</g, "\\u003c");
writeFileSync(join(OUT, "brasil-transparente-modelo.html"), modelo.replace("/*__DADOS__*/null", json));
if (existsSync(dirConv)) {
  mkdirSync(join(OUT, "dados", "convenios"), { recursive: true });
  for (const f of readdirSync(dirConv)) if (f !== "emendas.json") writeFileSync(join(OUT, "dados", "convenios", f), readFileSync(join(dirConv, f)));
  writeFileSync(join(OUT, "dados", "convenios", "emendas.json"), emendasConvReduzido());
}
if (contratosResumo) {
  copiarPasta(dirContr, join(OUT, "dados", "contratos"));
  copiarPasta(dirLic, join(OUT, "dados", "licitacoes"));
}
console.log(`Modelo gerado: prototipo/brasil-transparente-modelo.html (${(json.length / 1e6).toFixed(1)} MB de dados)`);

// --site: gera também a página completa (com <head>) para publicar no GitHub Pages.
if (process.argv.includes("--site")) {
  const SITE = join(process.cwd(), "site");
  mkdirSync(SITE, { recursive: true });
  const descricao = "Gastos públicos federais do Brasil com dados oficiais do Portal da Transparência: orçamento, execução, transferências e emendas por estado e município.";
  const pagina = `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="description" content="${descricao}">
<meta property="og:title" content="Brasil Transparente">
<meta property="og:description" content="${descricao}">
<meta name="theme-color" content="#0b1220">
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Crect width='24' height='24' rx='5' fill='%230b1220'/%3E%3Cpath d='M4 20h16M7 17v-6M10.5 17v-6M14 17v-6M17 17v-6M12 4l7 4H5z' stroke='white' stroke-width='1.6' fill='none'/%3E%3C/svg%3E">
<style>:root{padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}[hidden]{display:none!important}img{max-width:100%}</style>
</head>
<body>
${readFileSync(join(OUT, "brasil-transparente-modelo.html"), "utf8")}
</body>
</html>
`;
  writeFileSync(join(SITE, "index.html"), pagina);
  if (existsSync(dirConv)) {
    mkdirSync(join(SITE, "dados", "convenios"), { recursive: true });
    for (const f of readdirSync(dirConv)) if (f !== "emendas.json") writeFileSync(join(SITE, "dados", "convenios", f), readFileSync(join(dirConv, f)));
    writeFileSync(join(SITE, "dados", "convenios", "emendas.json"), emendasConvReduzido());
  }
  if (contratosResumo) {
    copiarPasta(dirContr, join(SITE, "dados", "contratos"));
    copiarPasta(dirLic, join(SITE, "dados", "licitacoes"));
  }
  writeFileSync(join(SITE, ".nojekyll"), "");
  console.log("Site gerado: site/index.html");
}
