"use client";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { METRICAS, type Metrica, type Modo } from "@/lib/filtros";

function Segmentado<T extends string>({ rotulo, valor, opcoes, aoMudar }: { rotulo: string; valor: T; opcoes: { v: T; t: string; dica?: string }[]; aoMudar: (v: T) => void }) {
  return (
    <div role="radiogroup" aria-label={rotulo} className="inline-flex flex-wrap rounded-md border border-borda bg-plano p-0.5">
      {opcoes.map((o) => (
        <button
          key={o.v}
          type="button"
          role="radio"
          aria-checked={valor === o.v}
          title={o.dica}
          onClick={() => aoMudar(o.v)}
          className={`rounded-[5px] px-2.5 py-1 text-[12.5px] ${valor === o.v ? "bg-superficie font-semibold text-tinta shadow-sm" : "text-tinta-2 hover:text-tinta"}`}
        >
          {o.t}
        </button>
      ))}
    </div>
  );
}

export function ControlesMapa({ metrica, modo }: { metrica: Metrica; modo: Modo }) {
  const r = useRouter();
  const path = usePathname();
  const sp = useSearchParams();
  const set = (k: string, v: string, padrao: string) => {
    const q = new URLSearchParams(sp.toString());
    if (v === padrao) q.delete(k);
    else q.set(k, v);
    r.push(`${path}${q.toString() ? `?${q}` : ""}`, { scroll: false });
  };
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Segmentado
        rotulo="O que o mapa mostra"
        valor={metrica}
        opcoes={(Object.keys(METRICAS) as Metrica[]).map((k) => ({ v: k, t: METRICAS[k].curto, dica: METRICAS[k].descricao }))}
        aoMudar={(v) => set("metrica", v, "transferencias")}
      />
      <Segmentado
        rotulo="Escala"
        valor={modo}
        opcoes={[
          { v: "absoluto", t: "Total" },
          { v: "per_capita", t: "Por habitante", dica: "Valor dividido pela população do Censo 2022 (IBGE)" },
        ]}
        aoMudar={(v) => set("modo", v, "absoluto")}
      />
    </div>
  );
}
