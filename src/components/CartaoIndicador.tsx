import Link from "next/link";
import type { Indicador } from "@/lib/dados/analises";
import { formatarBRL, formatarBRLCompacto, formatarInteiro } from "@/lib/dinheiro";
import { Proveniencia } from "./Proveniencia";
import { Ajuda, Variacao } from "./ui";

export function CartaoIndicador({ ind, query }: { ind: Indicador; query: string }) {
  const v = ind.atual.valor;
  const indisp = ind.atual.proveniencia.origem === "indisponivel";
  const principal = v === null ? "—" : ind.tipo === "moeda" ? formatarBRLCompacto(v) : formatarInteiro(v);
  return (
    <article className="cartao flex flex-col gap-1.5 p-4" aria-labelledby={`ind-${ind.id}`}>
      <h3 id={`ind-${ind.id}`} className="rotulo flex items-center gap-1.5">
        {ind.titulo} {ind.glossario && <Ajuda id={ind.glossario} />}
      </h3>
      <p className="num text-[26px] font-semibold leading-tight tracking-tight text-tinta" title={v !== null && ind.tipo === "moeda" ? formatarBRL(v) : undefined}>
        {principal}
      </p>
      {indisp ? (
        <p className="text-[12.5px] leading-snug text-tinta-3">{ind.atual.proveniencia.metodologia}</p>
      ) : (
        <>
          <Variacao v={ind.variacao} />
          <p className="text-[12.5px] leading-snug text-tinta-2">{ind.explicacao}</p>
          <p className="text-[12px] text-tinta-3">Período: {ind.atual.proveniencia.periodo}</p>
        </>
      )}
      <div className="mt-auto flex flex-wrap items-center justify-between gap-2 pt-1">
        {!indisp && <Proveniencia p={ind.atual.proveniencia} compacto />}
        {ind.detalhe && (
          <Link href={`${ind.detalhe}${query}`} className="link text-[12.5px]">
            Detalhar
          </Link>
        )}
      </div>
    </article>
  );
}
