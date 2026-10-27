import "server-only";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import type { Cubo, Manifesto, ManifestoConjunto, NomeConjunto } from "./tipos";

/**
 * Acesso aos conjuntos pré-agregados em disco.
 *  - Modo oficial (padrão): data/agregados (gerado por `npm run etl`)
 *  - Modo demonstração: data/demo (gerado por `npm run demo`), ativado com
 *    DADOS_DEMONSTRACAO=true. Nesse modo a interface exibe aviso permanente.
 * Os cubos ficam em memória e são recarregados quando o arquivo muda.
 */
export const MODO_DEMONSTRACAO = process.env.DADOS_DEMONSTRACAO === "true";

function diretorio(): string {
  if (MODO_DEMONSTRACAO) return join(process.cwd(), "data", "demo");
  return process.env.DADOS_DIR || join(process.cwd(), "data", "agregados");
}

const cache = new Map<string, { mtime: number; valor: unknown }>();

function lerJSON<T>(arq: string): T | null {
  if (!existsSync(arq)) return null;
  const mtime = statSync(arq).mtimeMs;
  const c = cache.get(arq);
  if (c && c.mtime === mtime) return c.valor as T;
  const valor = JSON.parse(readFileSync(arq, "utf8")) as T;
  cache.set(arq, { mtime, valor });
  return valor;
}

export function manifesto(): Manifesto | null {
  return lerJSON<Manifesto>(join(diretorio(), "manifesto.json"));
}

export function cubo(conjunto: NomeConjunto, ano: number): Cubo | null {
  return lerJSON<Cubo>(join(diretorio(), String(ano), `${conjunto}.json`));
}

export function infoConjunto(conjunto: string, ano: number): ManifestoConjunto | undefined {
  return manifesto()?.conjuntos.find((c) => c.ano === ano && c.conjunto === conjunto);
}

export function anosDisponiveis(): number[] {
  const d = diretorio();
  if (!existsSync(d)) return [];
  return readdirSync(d)
    .filter((n) => /^\d{4}$/.test(n))
    .map(Number)
    .sort((a, b) => b - a);
}

/** Ano padrão: o mais recente com dados; senão o ano corrente. */
export function anoPadrao(): number {
  return anosDisponiveis()[0] ?? new Date().getFullYear();
}

export function temDados(): boolean {
  return anosDisponiveis().length > 0;
}
