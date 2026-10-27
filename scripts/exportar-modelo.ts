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
        return [g("emenda").cod, g("emenda").nome, di("autor", g("autor")), ufIdx(g("uf").cod), g("municipio").nome, di("funcao", g("funcao")), v("empenhado"), v("pago")];
      })
    : [];
  for (const c of ["transferencias_municipios", "execucao_municipios"]) {
    const cb = ler(ano, c);
    for (const it of cb?.dicionarios.municipio ?? []) if (!it.cod.startsWith("NI")) nomesMun[it.cod] = it.nome;
  }
  const fav = ler(ano, "transferencias_favorecidos");
  porAno[ano] = {
    meses: manifesto.conjuntos.find((c) => c.ano === ano && c.conjunto === "execucao")?.mesesDisponiveis ?? [],
    orc: reagrupar(ler(ano, "orcamento"), ["orgaoSuperior", "funcao", "programa"], ["atualizado", "empenhado"]),
    exe: reagrupar(ler(ano, "execucao"), ["mes", "uf", "orgaoSuperior", "funcao", "programa"], ["empenhado", "liquidado", "pago"]),
    tra: reagrupar(ler(ano, "transferencias"), ["mes", "uf", "funcao", "tipo"], ["valor"]),
    traMun: reagrupar(ler(ano, "transferencias_municipios"), ["uf", "municipio", "funcao"], ["valor"]),
    exeMun: reagrupar(ler(ano, "execucao_municipios"), ["uf", "municipio", "funcao"], ["pago"]),
    emendas,
    favorecidos: fav
      ? fav.linhas.map((l) => [ufIdx(fav.dicionarios.uf[l[0]].cod), fav.dicionarios.favorecido[l[1]].nome, fav.dicionarios.tipoFavorecido[l[2]].nome, r2(l[3])])
      : [],
  };
}

const geo = join(process.cwd(), "data", "geo");
const munTopo: Record<string, unknown> = {};
for (const u of UFS) {
  const p = join(geo, "municipios", `${u.cod}.topo.json`);
  if (existsSync(p)) munTopo[u.cod] = JSON.parse(readFileSync(p, "utf8"));
}

const dados = {
  modo: oficial ? "oficial" : "demonstracao",
  conjuntos: manifesto.conjuntos
    .sort((a, b) => b.ano - a.ano || a.conjunto.localeCompare(b.conjunto))
    .map((c) => ({
      ano: c.ano,
      nome: c.fonte.nome,
      url: c.fonte.url,
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
console.log(`Modelo gerado: prototipo/brasil-transparente-modelo.html (${(json.length / 1e6).toFixed(1)} MB de dados)`);
