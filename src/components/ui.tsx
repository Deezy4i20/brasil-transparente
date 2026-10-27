import Link from "next/link";
import { ArrowDownRight, ArrowUpRight, CircleHelp, Database } from "lucide-react";
import { termo } from "@/lib/glossario";
import { formatarPercentual } from "@/lib/dinheiro";

/** Ícone de ajuda com definição do glossário (hover/foco) e link para o verbete. */
export function Ajuda({ id }: { id: string }) {
  const t = termo(id);
  if (!t) return null;
  return (
    <span className="group relative inline-flex align-middle">
      <Link href={`/glossario#${t.id}`} aria-label={`O que é ${t.termo}? ${t.curto}`} className="text-tinta-3 hover:text-marinho">
        <CircleHelp aria-hidden className="h-3.5 w-3.5" />
      </Link>
      <span
        role="tooltip"
        className="pointer-events-none absolute left-1/2 top-5 z-30 hidden w-64 -translate-x-1/2 rounded-md bg-tinta px-3 py-2 text-[12.5px] font-normal normal-case leading-snug tracking-normal text-white shadow-lg group-focus-within:block group-hover:block"
      >
        <b>{t.termo}.</b> {t.curto}
      </span>
    </span>
  );
}

/** Variação em relação ao período anterior. Cor neutra: aumento de gasto não é “bom” nem “ruim”. */
export function Variacao({ v, rotulo = "vs. mesmo período do ano anterior" }: { v: number | null; rotulo?: string }) {
  if (v === null) return <span className="text-[12px] text-tinta-3">sem base comparável</span>;
  const sobe = v >= 0;
  const Icone = sobe ? ArrowUpRight : ArrowDownRight;
  return (
    <span className="inline-flex items-center gap-1 text-[12px] text-tinta-2" title={rotulo}>
      <Icone aria-hidden className="h-3.5 w-3.5" />
      <span className="num font-semibold">{sobe ? "+" : "−"}{formatarPercentual(Math.abs(v))}</span>
      <span className="text-tinta-3">{rotulo}</span>
    </span>
  );
}

export function EstadoVazio({ titulo, children }: { titulo: string; children?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-start gap-2 rounded-cartao border border-dashed border-borda bg-superficie p-5 text-sm text-tinta-2">
      <div className="flex items-center gap-2 font-semibold text-tinta">
        <Database aria-hidden className="h-4 w-4 text-tinta-3" />
        {titulo}
      </div>
      {children}
    </div>
  );
}

export function TituloSecao({ titulo, sub, ajuda, acao }: { titulo: string; sub?: React.ReactNode; ajuda?: string; acao?: React.ReactNode }) {
  return (
    <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
      <div>
        <h2 className="flex items-center gap-1.5 text-[17px] font-semibold text-tinta">
          {titulo} {ajuda && <Ajuda id={ajuda} />}
        </h2>
        {sub && <p className="text-[13px] text-tinta-3">{sub}</p>}
      </div>
      {acao}
    </div>
  );
}

/** Lista de barras horizontais (ranking). Barras finas, rótulos em tinta, valor alinhado. */
export function ListaBarras({
  itens,
  formatar,
  hrefDe,
  rodape,
  vazio = "Sem registros para os filtros selecionados.",
}: {
  itens: { cod: string; nome: string; valor: number; sub?: string }[];
  formatar: (v: number) => string;
  hrefDe?: (cod: string) => string | undefined;
  rodape?: React.ReactNode;
  vazio?: string;
}) {
  if (!itens.length) return <p className="text-sm text-tinta-3">{vazio}</p>;
  const max = Math.max(...itens.map((i) => Math.abs(i.valor)), 1);
  return (
    <div>
      <ol className="space-y-2.5">
        {itens.map((it, n) => {
          const href = hrefDe?.(it.cod);
          const nome = (
            <span className="line-clamp-2" title={it.nome}>
              {it.nome}
            </span>
          );
          return (
            <li key={`${it.cod}-${n}`} className="text-[13.5px]">
              <div className="flex items-baseline justify-between gap-3">
                <span className="flex min-w-0 gap-2">
                  <span className="num w-5 shrink-0 text-right text-tinta-3">{n + 1}</span>
                  {href ? <Link href={href} className="min-w-0 hover:underline">{nome}</Link> : <span className="min-w-0">{nome}</span>}
                </span>
                <span className="num shrink-0 font-semibold">{formatar(it.valor)}</span>
              </div>
              {it.sub && <div className="ml-7 text-[12px] text-tinta-3">{it.sub}</div>}
              <div className="ml-7 mt-1 h-[6px] rounded-full bg-plano" aria-hidden>
                <div className="h-[6px] rounded-full bg-azul-450" style={{ width: `${Math.max(1, (Math.abs(it.valor) / max) * 100)}%` }} />
              </div>
            </li>
          );
        })}
      </ol>
      {rodape && <div className="mt-3 text-[12.5px] text-tinta-3">{rodape}</div>}
    </div>
  );
}
