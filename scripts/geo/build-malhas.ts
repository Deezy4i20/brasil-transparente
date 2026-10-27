/**
 * Gera as malhas territoriais simplificadas (TopoJSON) usadas pelo mapa.
 *
 * Ordem de preferência das fontes:
 *  1. API de malhas do IBGE (oficial): servicodados.ibge.gov.br/api/v3/malhas
 *  2. Espelhos públicos derivados das malhas do IBGE (usados quando a API do IBGE
 *     não está acessível no ambiente de build). A origem efetivamente usada fica
 *     registrada em data/geo/manifest.json e aparece na página "Fontes".
 *
 * Saída:
 *  data/geo/ufs.topo.json                (27 UFs, propriedade `cod` = código IBGE da UF)
 *  data/geo/municipios/<codUF>.topo.json (municípios, propriedade `cod` = código IBGE de 7 dígitos)
 *
 * Uso: npm run malhas            (todas)
 *      npm run malhas -- --so-ufs
 */
import { mkdir, writeFile, rm } from "node:fs/promises";
import { writeFileSync, readFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { execFileSync } from "node:child_process";
import { UFS } from "../../src/lib/referencia/ufs";

const OUT = join(process.cwd(), "data", "geo");
const IBGE = "https://servicodados.ibge.gov.br/api/v3/malhas";
const ESPELHO_UFS = "https://raw.githubusercontent.com/fititnt/gis-dataset-brasil/master/uf/geojson/uf.json";
const ESPELHO_MUN = (cod: number) =>
  `https://raw.githubusercontent.com/tbrugz/geodata-br/master/geojson/geojs-${cod}-mun.json`;

type FC = { type: "FeatureCollection"; features: { type: "Feature"; properties: Record<string, unknown>; geometry: unknown }[] };

async function baixar(url: string): Promise<{ texto: string } | null> {
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(60_000) });
    if (!r.ok) return null;
    const buf = Buffer.from(await r.arrayBuffer());
    // Alguns espelhos estão em latin1; tenta UTF-8 e cai para latin1 se houver caracteres inválidos.
    const utf8 = buf.toString("utf8");
    return { texto: utf8.includes("�") ? buf.toString("latin1") : utf8 };
  } catch {
    return null;
  }
}

function simplificar(fc: FC, nomeCamada: string, pct: string): string {
  const dir = join(tmpdir(), `bt-malhas-${process.pid}`);
  mkdirSync(dir, { recursive: true });
  const ent = join(dir, `${nomeCamada}.json`);
  const sai = join(dir, `${nomeCamada}.topo.json`);
  writeFileSync(ent, JSON.stringify(fc));
  execFileSync(
    join(process.cwd(), "node_modules", ".bin", "mapshaper"),
    [ent, "-simplify", pct, "keep-shapes", "-clean", "-o", "format=topojson", "quantization=1e5", sai],
    { stdio: "pipe" },
  );
  return readFileSync(sai, "utf8");
}

async function malhaUfs(): Promise<{ fc: FC; origem: string }> {
  const oficial = await baixar(`${IBGE}/paises/BR?formato=application/vnd.geo%2Bjson&intrarregiao=UF&qualidade=intermediaria`);
  if (oficial) {
    const fc = JSON.parse(oficial.texto) as FC;
    for (const f of fc.features) f.properties = { cod: Number(f.properties.codarea) };
    return { fc, origem: "IBGE — API de malhas v3 (oficial)" };
  }
  const esp = await baixar(ESPELHO_UFS);
  if (!esp) throw new Error("Nenhuma fonte de malha de UFs acessível.");
  const fc = JSON.parse(esp.texto) as FC;
  for (const f of fc.features) f.properties = { cod: Number(f.properties.GEOCODIGO) };
  return { fc, origem: `Espelho derivado das malhas do IBGE (${ESPELHO_UFS})` };
}

async function malhaMunicipios(codUf: number): Promise<{ fc: FC; origem: string } | null> {
  const oficial = await baixar(`${IBGE}/estados/${codUf}?formato=application/vnd.geo%2Bjson&intrarregiao=municipio&qualidade=intermediaria`);
  if (oficial) {
    const fc = JSON.parse(oficial.texto) as FC;
    for (const f of fc.features) f.properties = { cod: Number(f.properties.codarea) };
    return { fc, origem: "IBGE — API de malhas v3 (oficial)" };
  }
  const esp = await baixar(ESPELHO_MUN(codUf));
  if (!esp) return null;
  const fc = JSON.parse(esp.texto) as FC;
  for (const f of fc.features) f.properties = { cod: Number(f.properties.id), nome: f.properties.name };
  return { fc, origem: `Espelho derivado das malhas do IBGE (${ESPELHO_MUN(codUf)})` };
}

async function main() {
  const soUfs = process.argv.includes("--so-ufs");
  await mkdir(join(OUT, "municipios"), { recursive: true });
  const manifest: Record<string, string> = {};

  const ufs = await malhaUfs();
  await writeFile(join(OUT, "ufs.topo.json"), simplificar(ufs.fc, "ufs", "4%"));
  manifest.ufs = ufs.origem;
  console.log(`UFs: ${ufs.fc.features.length} feições — ${ufs.origem}`);

  if (!soUfs) {
    for (const uf of UFS) {
      const m = await malhaMunicipios(uf.cod);
      if (!m) {
        console.warn(`  ${uf.sigla}: malha municipal indisponível`);
        continue;
      }
      await writeFile(join(OUT, "municipios", `${uf.cod}.topo.json`), simplificar(m.fc, `mun${uf.cod}`, "6%"));
      manifest[`municipios_${uf.sigla}`] = m.origem;
      console.log(`  ${uf.sigla}: ${m.fc.features.length} municípios`);
    }
  }
  await writeFile(
    join(OUT, "manifest.json"),
    JSON.stringify({ geradoEm: new Date().toISOString(), origens: manifest }, null, 2),
  );
  await rm(join(tmpdir(), `bt-malhas-${process.pid}`), { recursive: true, force: true });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
