/**
 * Filtros globais compartilhados entre módulos, serializados na URL
 * (assim cada visão é compartilhável e o botão "voltar" funciona).
 */
import { REGIOES, UFS, type Regiao } from "./referencia/ufs";

export type Metrica = "transferencias" | "execucao" | "emendas";
export type Modo = "absoluto" | "per_capita";

export interface Filtros {
  ano: number;
  meses: [number, number];
  regiao?: Regiao;
  uf?: string;
  funcao?: string;
  orgao?: string; // órgão superior (código SIAFI)
  programa?: string;
  grupo?: string; // grupo de natureza da despesa
  metrica: Metrica;
  modo: Modo;
}

export const METRICAS: Record<Metrica, { rotulo: string; curto: string; descricao: string; medida: string; conjunto: string }> = {
  transferencias: {
    rotulo: "Transferências recebidas",
    curto: "Transferências",
    descricao:
      "Recursos federais transferidos a estados, municípios, entidades e cidadãos, pela UF do favorecido (destino da transferência).",
    medida: "valor",
    conjunto: "transferencias",
  },
  execucao: {
    rotulo: "Despesa paga com localidade indicada",
    curto: "Despesa localizada",
    descricao:
      "Valor pago de despesas cujo plano de trabalho indica UF de execução. Despesas de abrangência nacional ficam como “localização não identificada”, não são atribuídas à sede do órgão.",
    medida: "pago",
    conjunto: "execucao",
  },
  emendas: {
    rotulo: "Emendas parlamentares pagas",
    curto: "Emendas",
    descricao: "Valor pago de emendas parlamentares, pela UF de destino informada na emenda.",
    medida: "pago",
    conjunto: "emendas",
  },
};

export const ROTULO_FILTRO: Record<string, string> = {
  ano: "Ano",
  mes: "Período (meses)",
  regiao: "Região",
  uf: "Estado",
  funcao: "Área de atuação",
  orgao: "Órgão",
  orgaoSuperior: "Órgão",
  programa: "Programa",
  grupo: "Natureza da despesa",
};

const MESES_ABREV = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
export const mesAbrev = (m: number) => MESES_ABREV[m - 1] ?? String(m);

type Params = Record<string, string | string[] | undefined>;
const s = (p: Params, k: string) => {
  const v = p[k];
  return (Array.isArray(v) ? v[0] : v)?.trim() || undefined;
};
const codigoSeguro = (v: string | undefined) => (v && /^[\w.\-]{1,20}$/.test(v) ? v : undefined);

export function lerFiltros(p: Params, anoPadrao: number): Filtros {
  const anoN = Number(s(p, "ano"));
  const ano = Number.isInteger(anoN) && anoN >= 2014 && anoN <= 2100 ? anoN : anoPadrao;
  let mi = Number(s(p, "mi") ?? 1);
  let mf = Number(s(p, "mf") ?? 12);
  if (!(mi >= 1 && mi <= 12)) mi = 1;
  if (!(mf >= 1 && mf <= 12)) mf = 12;
  if (mi > mf) [mi, mf] = [mf, mi];
  const regiao = REGIOES.find((r) => r === s(p, "regiao"));
  const ufS = s(p, "uf")?.toUpperCase();
  const uf = UFS.some((u) => u.sigla === ufS) ? ufS : undefined;
  const metricaS = s(p, "metrica") as Metrica | undefined;
  const metrica: Metrica = metricaS && metricaS in METRICAS ? metricaS : "transferencias";
  const modo: Modo = s(p, "modo") === "per_capita" ? "per_capita" : "absoluto";
  return {
    ano,
    meses: [mi, mf],
    regiao,
    uf,
    funcao: codigoSeguro(s(p, "funcao")),
    orgao: codigoSeguro(s(p, "orgao")),
    programa: codigoSeguro(s(p, "programa")),
    grupo: codigoSeguro(s(p, "grupo")),
    metrica,
    modo,
  };
}

export function paraQuery(f: Partial<Filtros>, sobrescrever: Record<string, string | number | undefined | null> = {}): string {
  const q = new URLSearchParams();
  const base: Record<string, string | number | undefined> = {
    ano: f.ano,
    mi: f.meses && f.meses[0] !== 1 ? f.meses[0] : undefined,
    mf: f.meses && f.meses[1] !== 12 ? f.meses[1] : undefined,
    regiao: f.regiao,
    uf: f.uf,
    funcao: f.funcao,
    orgao: f.orgao,
    programa: f.programa,
    grupo: f.grupo,
    metrica: f.metrica && f.metrica !== "transferencias" ? f.metrica : undefined,
    modo: f.modo && f.modo !== "absoluto" ? f.modo : undefined,
  };
  for (const [k, v] of Object.entries({ ...base, ...sobrescrever })) if (v !== undefined && v !== null && v !== "") q.set(k, String(v));
  const t = q.toString();
  return t ? `?${t}` : "";
}

/** Converte filtros globais em filtros por dimensão de cubo. */
export function filtrosDeCubo(f: Filtros): Record<string, string[] | undefined> {
  let ufs: string[] | undefined;
  if (f.uf) ufs = [f.uf];
  else if (f.regiao) ufs = UFS.filter((u) => u.regiao === f.regiao).map((u) => u.sigla);
  return {
    uf: ufs,
    funcao: f.funcao ? [f.funcao] : undefined,
    orgaoSuperior: f.orgao ? [f.orgao] : undefined,
    programa: f.programa ? [f.programa] : undefined,
    grupo: f.grupo ? [f.grupo] : undefined,
  };
}

export function descreverPeriodo(f: Filtros): string {
  if (f.meses[0] === 1 && f.meses[1] === 12) return `${f.ano}`;
  if (f.meses[0] === f.meses[1]) return `${mesAbrev(f.meses[0])}/${f.ano}`;
  return `${mesAbrev(f.meses[0])}–${mesAbrev(f.meses[1])}/${f.ano}`;
}
