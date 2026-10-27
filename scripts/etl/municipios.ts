import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { normalizarTexto, UFS } from "../../src/lib/referencia/ufs";

/**
 * Índice de municípios (UF + nome normalizado → código IBGE), construído a partir
 * das malhas municipais em data/geo/municipios. Usado para localizar no mapa os
 * registros que trazem apenas o nome do município (execução da despesa,
 * transferências). A correspondência por nome é registrada como tal.
 */
export interface IndiceMunicipios {
  porNome: Map<string, { cod: string; nome: string }>;
  porCodigo: Map<string, { nome: string; uf: string }>;
}

export function carregarIndiceMunicipios(dirGeo = join(process.cwd(), "data", "geo", "municipios")): IndiceMunicipios {
  const porNome = new Map<string, { cod: string; nome: string }>();
  const porCodigo = new Map<string, { nome: string; uf: string }>();
  if (!existsSync(dirGeo)) return { porNome, porCodigo };
  for (const arq of readdirSync(dirGeo)) {
    const codUf = Number(arq.split(".")[0]);
    const uf = UFS.find((u) => u.cod === codUf);
    if (!uf) continue;
    const topo = JSON.parse(readFileSync(join(dirGeo, arq), "utf8"));
    const obj = Object.values(topo.objects)[0] as { geometries: { properties: { cod: number; nome?: string } }[] };
    for (const g of obj.geometries) {
      const cod = String(g.properties.cod);
      const nome = g.properties.nome ?? cod;
      porCodigo.set(cod, { nome, uf: uf.sigla });
      porNome.set(`${uf.sigla}|${normalizarTexto(nome)}`, { cod, nome });
    }
  }
  return { porNome, porCodigo };
}

/** Ajustes conhecidos de grafia entre bases (apóstrofos, hífens, "D'Oeste" etc.). */
function variantes(nome: string): string[] {
  const n = normalizarTexto(nome);
  const v = new Set([n]);
  v.add(n.replace(/ D /g, " D").replace(/ D$/, ""));
  v.add(n.replace(/ DO /g, " D ").replace(/ DA /g, " D "));
  v.add(n.replace(/\bSTA\b/g, "SANTA").replace(/\bSTO\b/g, "SANTO").replace(/\bS\b/g, "SAO"));
  return [...v];
}

export function localizarMunicipio(
  idx: IndiceMunicipios,
  uf: string,
  nome: string,
): { cod: string; nome: string; correspondencia: "nome" | "sem_correspondencia" } {
  for (const v of variantes(nome)) {
    const m = idx.porNome.get(`${uf}|${v}`);
    if (m) return { ...m, correspondencia: "nome" };
  }
  return { cod: `NI:${uf}:${normalizarTexto(nome)}`, nome, correspondencia: "sem_correspondencia" };
}
