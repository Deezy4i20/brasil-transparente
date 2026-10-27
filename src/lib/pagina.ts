import "server-only";
import { anoPadrao } from "./dados/repositorio";
import { opcoesFiltro } from "./dados/analises";
import { lerFiltros, paraQuery } from "./filtros";

export type SearchParams = Promise<Record<string, string | string[] | undefined>>;

/** Lê filtros da URL e prepara o que toda página precisa. */
export async function contexto(sp: SearchParams) {
  const p = await sp;
  const f = lerFiltros(p, anoPadrao());
  return { f, p, query: paraQuery(f), opcoes: opcoesFiltro(f.ano) };
}

export function texto(p: Record<string, string | string[] | undefined>, k: string, max = 120): string | undefined {
  const v = p[k];
  const s = (Array.isArray(v) ? v[0] : v)?.trim();
  return s ? s.slice(0, max) : undefined;
}
