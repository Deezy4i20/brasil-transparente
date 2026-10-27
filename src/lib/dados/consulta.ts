/**
 * Motor de consulta sobre cubos pré-agregados. Funções puras (testáveis).
 *
 * Regras:
 *  - Um filtro só é aplicado se o cubo tiver a dimensão correspondente;
 *    caso contrário é devolvido em `filtrosNaoAplicaveis` para a interface avisar.
 *  - Nunca soma medidas diferentes entre si; cada medida é somada separadamente.
 */
import type { Cubo, ItemDicionario } from "./tipos";

export interface ParametrosConsulta {
  /** dimensão → códigos aceitos */
  filtros?: Record<string, string[] | undefined>;
  /** intervalo de meses inclusivo, aplicado apenas a cubos com dimensão "mes" */
  meses?: [number, number];
  /** dimensões pelas quais agrupar ("mes" permitido) */
  agrupar?: string[];
}

export interface Grupo {
  chave: Record<string, ItemDicionario | number>;
  valores: Record<string, number>;
}

export interface ResultadoConsulta {
  grupos: Grupo[];
  total: Record<string, number>;
  linhasConsideradas: number;
  filtrosAplicados: string[];
  filtrosNaoAplicaveis: string[];
}

export function consultar(cubo: Cubo, p: ParametrosConsulta = {}): ResultadoConsulta {
  const dimIdx = new Map(cubo.dimensoes.map((d, i) => [d, i]));
  const nDim = cubo.dimensoes.length;
  const aplicados: string[] = [];
  const naoAplicaveis: string[] = [];

  // Converte filtros (códigos) em conjuntos de índices do dicionário.
  const condicoes: { i: number; aceitos: Set<number> }[] = [];
  for (const [dim, cods] of Object.entries(p.filtros ?? {})) {
    if (!cods || !cods.length) continue;
    const i = dimIdx.get(dim);
    if (i === undefined) {
      naoAplicaveis.push(dim);
      continue;
    }
    aplicados.push(dim);
    const dict = cubo.dicionarios[dim] ?? [];
    const alvo = new Set(cods);
    const aceitos = new Set<number>();
    dict.forEach((it, k) => alvo.has(it.cod) && aceitos.add(k));
    condicoes.push({ i, aceitos });
  }
  let iMes = dimIdx.get("mes");
  if (p.meses) {
    if (iMes === undefined) naoAplicaveis.push("mes");
    else aplicados.push("mes");
  } else iMes = undefined;

  const agrupar = p.agrupar ?? [];
  for (const g of agrupar) if (!dimIdx.has(g)) throw new Error(`Dimensão inexistente no cubo ${cubo.conjunto}: ${g}`);
  const gIdx = agrupar.map((g) => dimIdx.get(g)!);

  const acum = new Map<string, number[]>();
  const tot = new Array(cubo.medidas.length).fill(0);
  let consideradas = 0;

  for (const l of cubo.linhas) {
    let ok = true;
    for (const c of condicoes) if (!c.aceitos.has(l[c.i])) { ok = false; break; }
    if (!ok) continue;
    if (iMes !== undefined && p.meses && (l[iMes] < p.meses[0] || l[iMes] > p.meses[1])) continue;
    consideradas++;
    const k = gIdx.map((i) => l[i]).join("|");
    let a = acum.get(k);
    if (!a) acum.set(k, (a = new Array(cubo.medidas.length).fill(0)));
    for (let j = 0; j < cubo.medidas.length; j++) {
      const c = Math.round(l[nDim + j] * 100);
      a[j] += c;
      tot[j] += c;
    }
  }

  const grupos: Grupo[] = [];
  for (const [k, a] of acum) {
    const partes = k === "" ? [] : k.split("|").map(Number);
    const chave: Grupo["chave"] = {};
    agrupar.forEach((g, n) => {
      chave[g] = g === "mes" ? partes[n] : cubo.dicionarios[g][partes[n]];
    });
    grupos.push({ chave, valores: Object.fromEntries(cubo.medidas.map((m, j) => [m, a[j] / 100])) });
  }
  return {
    grupos,
    total: Object.fromEntries(cubo.medidas.map((m, j) => [m, tot[j] / 100])),
    linhasConsideradas: consideradas,
    filtrosAplicados: aplicados,
    filtrosNaoAplicaveis: naoAplicaveis,
  };
}

/** Ordena grupos por uma medida (desc) e devolve os N primeiros + o agregado "Demais". */
export function topN(grupos: Grupo[], medida: string, n: number): { top: Grupo[]; demais: number; quantidadeDemais: number } {
  const ord = [...grupos].sort((a, b) => b.valores[medida] - a.valores[medida]);
  const top = ord.slice(0, n);
  const resto = ord.slice(n);
  return {
    top,
    demais: Math.round(resto.reduce((s, g) => s + g.valores[medida] * 100, 0)) / 100,
    quantidadeDemais: resto.length,
  };
}

export function item(g: Grupo, dim: string): ItemDicionario {
  return g.chave[dim] as ItemDicionario;
}
