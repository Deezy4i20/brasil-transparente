"use client";
import { SlidersHorizontal, X } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { REGIOES, UFS } from "@/lib/referencia/ufs";

type Opcao = { cod: string; nome: string };
interface Props {
  opcoes: { orgaos: Opcao[]; funcoes: Opcao[]; programas: Opcao[]; grupos: Opcao[] };
  /** Filtros que esta página usa (os demais ficam ocultos). */
  campos?: ("regiao" | "uf" | "orgao" | "funcao" | "programa" | "grupo")[];
}

const ROTULOS: Record<string, string> = {
  regiao: "Região",
  uf: "Estado",
  orgao: "Órgão",
  funcao: "Área",
  programa: "Programa",
  grupo: "Natureza da despesa",
  mi: "Mês inicial",
  mf: "Mês final",
};
const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

export function BarraFiltros({ opcoes, campos = ["regiao", "uf", "orgao", "funcao", "programa", "grupo"] }: Props) {
  const r = useRouter();
  const path = usePathname();
  const sp = useSearchParams();
  const [aberto, setAberto] = useState(false);

  const listas: Record<string, Opcao[]> = {
    regiao: REGIOES.map((x) => ({ cod: x, nome: x })),
    uf: UFS.map((u) => ({ cod: u.sigla, nome: u.nome })).sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")),
    orgao: opcoes.orgaos,
    funcao: opcoes.funcoes,
    programa: opcoes.programas,
    grupo: opcoes.grupos,
  };

  function aplicar(mudancas: Record<string, string | null>) {
    const q = new URLSearchParams(sp.toString());
    for (const [k, v] of Object.entries(mudancas)) {
      if (v) q.set(k, v);
      else q.delete(k);
    }
    q.delete("pagina");
    r.push(`${path}${q.toString() ? `?${q}` : ""}`, { scroll: false });
  }

  const ativos = (["regiao", "uf", "orgao", "funcao", "programa", "grupo", "mi", "mf"] as const)
    .map((k) => {
      const v = sp.get(k);
      if (!v) return null;
      let nome = v;
      if (k === "mi" || k === "mf") nome = MESES[Number(v) - 1] ?? v;
      else nome = listas[k]?.find((o) => o.cod === v)?.nome ?? v;
      return { k, v, nome };
    })
    .filter(Boolean) as { k: string; v: string; nome: string }[];

  return (
    <section aria-label="Filtros" className="cartao px-3 py-2.5">
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className="botao" aria-expanded={aberto} aria-controls="painel-filtros" onClick={() => setAberto((a) => !a)}>
          <SlidersHorizontal aria-hidden className="h-4 w-4" /> Filtros
        </button>
        {ativos.length === 0 && <span className="text-[13px] text-tinta-3">Nenhum filtro ativo.</span>}
        {ativos.map((a) => (
          <span key={a.k} className="inline-flex items-center gap-1 rounded-full border border-marinho/25 bg-marinho-claro py-0.5 pl-2.5 pr-1 text-[12.5px] text-marinho">
            <span className="text-marinho/70">{ROTULOS[a.k]}:</span>
            <span className="max-w-[220px] truncate font-medium" title={a.nome}>{a.nome}</span>
            <button
              type="button"
              aria-label={`Remover filtro ${ROTULOS[a.k]}`}
              onClick={() => aplicar({ [a.k]: null, ...(a.k === "regiao" ? {} : {}) })}
              className="grid h-5 w-5 place-items-center rounded-full hover:bg-marinho/10"
            >
              <X aria-hidden className="h-3.5 w-3.5" />
            </button>
          </span>
        ))}
        {ativos.length > 0 && (
          <button
            type="button"
            className="text-[12.5px] text-tinta-2 underline underline-offset-2"
            onClick={() => aplicar({ regiao: null, uf: null, orgao: null, funcao: null, programa: null, grupo: null, mi: null, mf: null })}
          >
            Limpar todos
          </button>
        )}
      </div>
      {aberto && (
        <div id="painel-filtros" className="mt-3 grid gap-3 border-t border-borda pt-3 sm:grid-cols-2 lg:grid-cols-3">
          {campos.map((c) => (
            <label key={c} className="text-[12.5px]">
              <span className="mb-1 block font-semibold text-tinta-2">{ROTULOS[c]}</span>
              <select
                className="campo"
                value={sp.get(c) ?? ""}
                onChange={(e) => aplicar(c === "regiao" ? { regiao: e.target.value || null, uf: null } : c === "uf" ? { uf: e.target.value || null, regiao: null } : { [c]: e.target.value || null })}
              >
                <option value="">Todos</option>
                {listas[c].map((o) => (
                  <option key={o.cod} value={o.cod}>
                    {c === "programa" || c === "grupo" ? `${o.cod} — ${o.nome}` : o.nome}
                  </option>
                ))}
              </select>
            </label>
          ))}
          <p className="text-[12px] text-tinta-3 sm:col-span-2 lg:col-span-3">
            Os filtros valem para todos os módulos. Quando uma fonte não tem a informação (ex.: o orçamento não é dividido por estado), o painel avisa que o filtro não se aplica àquele número.
          </p>
        </div>
      )}
    </section>
  );
}
