"use client";
import Link from "next/link";
import { ArrowDown, ArrowUp, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { formatarBRL, formatarBRLCompacto, formatarPercentual } from "@/lib/dinheiro";

export interface Coluna {
  chave: string;
  titulo: string;
  tipo?: "texto" | "moeda" | "percentual";
  /** chave da linha que contém o href (para colunas de texto com link) */
  link?: string;
}

/** Tabela com busca, ordenação e paginação no cliente (para listas já agregadas no servidor). */
export function TabelaOrdenavel({
  colunas,
  linhas,
  ordemInicial,
  porPagina = 15,
  rotulo,
}: {
  colunas: Coluna[];
  linhas: Record<string, string | number | null>[];
  ordemInicial?: string;
  porPagina?: number;
  rotulo: string;
}) {
  const [q, setQ] = useState("");
  const [ordem, setOrdem] = useState<{ k: string; desc: boolean }>({ k: ordemInicial ?? colunas[colunas.length - 1].chave, desc: true });
  const [pag, setPag] = useState(1);

  const filtradas = useMemo(() => {
    const n = q.trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
    const l = n
      ? linhas.filter((r) => colunas.some((c) => (c.tipo ?? "texto") === "texto" && String(r[c.chave] ?? "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").includes(n)))
      : linhas;
    return [...l].sort((a, b) => {
      const x = a[ordem.k];
      const y = b[ordem.k];
      const r = typeof x === "number" || typeof y === "number" ? ((x as number) ?? -Infinity) - ((y as number) ?? -Infinity) : String(x ?? "").localeCompare(String(y ?? ""), "pt-BR");
      return ordem.desc ? -r : r;
    });
  }, [q, linhas, colunas, ordem]);
  const paginas = Math.max(1, Math.ceil(filtradas.length / porPagina));
  const atual = Math.min(pag, paginas);
  const visiveis = filtradas.slice((atual - 1) * porPagina, atual * porPagina);

  const fmt = (c: Coluna, v: string | number | null) =>
    v === null || v === undefined ? <span className="text-tinta-3">não disponível</span> : c.tipo === "moeda" ? <span title={formatarBRL(v as number)}>{formatarBRLCompacto(v as number)}</span> : c.tipo === "percentual" ? formatarPercentual(v as number) : v;

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <label className="relative w-full max-w-xs">
          <span className="sr-only">Buscar em {rotulo}</span>
          <Search aria-hidden className="pointer-events-none absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-tinta-3" />
          <input className="campo pl-8" placeholder="Buscar na tabela…" value={q} onChange={(e) => { setQ(e.target.value); setPag(1); }} />
        </label>
        <span className="text-[12.5px] text-tinta-3">{filtradas.length} registro(s)</span>
      </div>
      <div className="overflow-x-auto rounded-md border border-borda">
        <table className={`tabela ${colunas.length > 3 ? "min-w-[640px]" : ""}`}>
          <caption className="sr-only">{rotulo}</caption>
          <thead className="bg-plano/60">
            <tr>
              {colunas.map((c) => {
                const ativa = ordem.k === c.chave;
                return (
                  <th key={c.chave} className={c.tipo && c.tipo !== "texto" ? "valor" : ""} aria-sort={ativa ? (ordem.desc ? "descending" : "ascending") : "none"}>
                    <button type="button" className="inline-flex items-center gap-1 uppercase" onClick={() => setOrdem({ k: c.chave, desc: ativa ? !ordem.desc : c.tipo !== "texto" && c.tipo !== undefined })}>
                      {c.titulo}
                      {ativa && (ordem.desc ? <ArrowDown aria-hidden className="h-3 w-3" /> : <ArrowUp aria-hidden className="h-3 w-3" />)}
                    </button>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {visiveis.map((r, i) => (
              <tr key={i} className="hover:bg-plano/60">
                {colunas.map((c) => (
                  <td key={c.chave} className={c.tipo && c.tipo !== "texto" ? "valor" : ""}>
                    {c.link && r[c.link] ? <Link className="link" href={String(r[c.link])}>{fmt(c, r[c.chave])}</Link> : fmt(c, r[c.chave])}
                  </td>
                ))}
              </tr>
            ))}
            {!visiveis.length && (
              <tr>
                <td colSpan={colunas.length} className="py-6 text-center text-tinta-3">Nenhum registro encontrado.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {paginas > 1 && (
        <nav aria-label="Paginação" className="mt-2 flex items-center justify-end gap-2 text-[12.5px]">
          <button type="button" className="botao" disabled={atual === 1} onClick={() => setPag(atual - 1)}>Anterior</button>
          <span className="num text-tinta-2">{atual} de {paginas}</span>
          <button type="button" className="botao" disabled={atual === paginas} onClick={() => setPag(atual + 1)}>Próxima</button>
        </nav>
      )}
    </div>
  );
}
