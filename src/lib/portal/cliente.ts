import "server-only";
/**
 * Cliente da API do Portal da Transparência (somente servidor).
 *  - Token lido de PORTAL_TRANSPARENCIA_TOKEN (nunca enviado ao navegador nem registrado em log).
 *  - Respeita o limite oficial de requisições (LimitadorJanela).
 *  - Cache em memória com TTL, para não repetir chamadas idênticas.
 *  - Novas tentativas com espera exponencial em 429/5xx/timeouts.
 *  - Valida a resposta com zod; registros inválidos são contados e descartados, não quebram a página.
 */
import type { z } from "zod";
import { LimitadorJanela } from "./limitador";

export const BASE_API = "https://api.portaldatransparencia.gov.br/api-de-dados";

export class ErroPortal extends Error {
  constructor(
    message: string,
    readonly tipo: "sem_token" | "http" | "rede" | "validacao",
    readonly status?: number,
  ) {
    super(message);
  }
}

const limitador = new LimitadorJanela(Number(process.env.PORTAL_MARGEM_LIMITE ?? 0.8));
const cache = new Map<string, { expira: number; dados: unknown }>();
const MAX_CACHE = 500;
const TTL_PADRAO = Number(process.env.PORTAL_CACHE_TTL_SEGUNDOS ?? 3600) * 1000;

export function tokenConfigurado(): boolean {
  return Boolean(process.env.PORTAL_TRANSPARENCIA_TOKEN?.trim());
}

function montarUrl(caminho: string, params: Record<string, string | number | undefined>): string {
  const u = new URL(`${BASE_API}/${caminho.replace(/^\//, "")}`);
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== "") u.searchParams.set(k, String(v));
  return u.toString();
}

/** Log técnico sem dados sensíveis: só caminho, status e duração (sem token, sem parâmetros de pessoa). */
function log(msg: string) {
  if (process.env.NODE_ENV !== "test") console.info(`[portal] ${msg}`);
}

export interface Resultado<T> {
  itens: T[];
  invalidos: number;
  url: string;
  doCache: boolean;
  consultadoEm: string;
}

export async function consultar<T extends z.ZodTypeAny>(
  caminho: string,
  params: Record<string, string | number | undefined>,
  esquema: T,
  opts: { ttl?: number; tentativas?: number; sinal?: AbortSignal } = {},
): Promise<Resultado<z.infer<T>>> {
  const token = process.env.PORTAL_TRANSPARENCIA_TOKEN?.trim();
  if (!token) throw new ErroPortal("Token da API do Portal da Transparência não configurado no servidor.", "sem_token");
  const url = montarUrl(caminho, params);
  const ttl = opts.ttl ?? TTL_PADRAO;
  const c = cache.get(url);
  if (c && c.expira > Date.now()) return { ...(c.dados as Resultado<z.infer<T>>), doCache: true };

  const tentativas = opts.tentativas ?? 3;
  let ultimoErro: ErroPortal | null = null;
  for (let t = 0; t < tentativas; t++) {
    await limitador.aguardar();
    const ini = Date.now();
    try {
      const r = await fetch(url, {
        headers: { "chave-api-dados": token, Accept: "application/json" },
        signal: opts.sinal ?? AbortSignal.timeout(20_000),
        cache: "no-store",
      });
      log(`${caminho} → ${r.status} (${Date.now() - ini}ms)`);
      if (r.status === 429 || r.status >= 500) {
        ultimoErro = new ErroPortal(`A API respondeu ${r.status}.`, "http", r.status);
        await new Promise((s) => setTimeout(s, 500 * 2 ** t));
        continue;
      }
      if (!r.ok) {
        const corpo = (await r.text()).slice(0, 300);
        throw new ErroPortal(
          r.status === 401 || r.status === 403
            ? "Token recusado pela API do Portal (verifique PORTAL_TRANSPARENCIA_TOKEN)."
            : `A API respondeu ${r.status}: ${corpo}`,
          "http",
          r.status,
        );
      }
      const json = (await r.json()) as unknown;
      const brutos = Array.isArray(json) ? json : [json];
      const itens: z.infer<T>[] = [];
      let invalidos = 0;
      for (const b of brutos) {
        const p = esquema.safeParse(b);
        if (p.success) itens.push(p.data);
        else invalidos++;
      }
      if (invalidos) log(`${caminho}: ${invalidos} registro(s) fora do formato esperado`);
      const res: Resultado<z.infer<T>> = { itens, invalidos, url, doCache: false, consultadoEm: new Date().toISOString() };
      if (cache.size >= MAX_CACHE) cache.delete(cache.keys().next().value!);
      cache.set(url, { expira: Date.now() + ttl, dados: res });
      return res;
    } catch (e) {
      if (e instanceof ErroPortal) throw e;
      ultimoErro = new ErroPortal(`Falha de rede ao consultar a API: ${(e as Error).message}`, "rede");
      await new Promise((s) => setTimeout(s, 500 * 2 ** t));
    }
  }
  throw ultimoErro ?? new ErroPortal("Falha desconhecida.", "rede");
}

/**
 * Pagina um endpoint até `maxPaginas` ou até vir uma página vazia.
 * A API usa o parâmetro `pagina` (1..n); páginas têm tamanho fixo definido pelo Portal.
 */
export async function consultarPaginas<T extends z.ZodTypeAny>(
  caminho: string,
  params: Record<string, string | number | undefined>,
  esquema: T,
  maxPaginas = 5,
): Promise<Resultado<z.infer<T>> & { paginas: number; completo: boolean }> {
  const itens: z.infer<T>[] = [];
  let invalidos = 0;
  let pag = 1;
  let ultimo: Resultado<z.infer<T>> | null = null;
  for (; pag <= maxPaginas; pag++) {
    ultimo = await consultar(caminho, { ...params, pagina: pag }, esquema);
    if (!ultimo.itens.length && !ultimo.invalidos) break;
    itens.push(...ultimo.itens);
    invalidos += ultimo.invalidos;
  }
  const completo = pag <= maxPaginas;
  return { itens, invalidos, url: ultimo?.url ?? montarUrl(caminho, params), doCache: false, consultadoEm: new Date().toISOString(), paginas: pag - 1, completo };
}

/** Verificação de conectividade (usada no indicador do cabeçalho). Resultado em cache por 10 min. */
let ultimoStatus: { em: number; ok: boolean; mensagem: string } | null = null;
export async function statusConexao(): Promise<{ ok: boolean; mensagem: string; verificadoEm: string | null }> {
  if (!tokenConfigurado()) return { ok: false, mensagem: "Token não configurado: consultas ao vivo desativadas.", verificadoEm: null };
  if (ultimoStatus && Date.now() - ultimoStatus.em < 10 * 60_000)
    return { ok: ultimoStatus.ok, mensagem: ultimoStatus.mensagem, verificadoEm: new Date(ultimoStatus.em).toISOString() };
  try {
    const { OrgaoSiafi } = await import("./esquemas");
    await consultar("orgaos-siafi", { pagina: 1 }, OrgaoSiafi, { ttl: 10 * 60_000, tentativas: 1 });
    ultimoStatus = { em: Date.now(), ok: true, mensagem: "API do Portal respondendo." };
  } catch (e) {
    ultimoStatus = { em: Date.now(), ok: false, mensagem: (e as Error).message };
  }
  return { ok: ultimoStatus.ok, mensagem: ultimoStatus.mensagem, verificadoEm: new Date(ultimoStatus.em).toISOString() };
}
