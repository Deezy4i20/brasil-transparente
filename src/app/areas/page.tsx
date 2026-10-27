import type { Metadata } from "next";
import Link from "next/link";
import { BarraFiltros } from "@/components/BarraFiltros";
import { Proveniencia } from "@/components/Proveniencia";
import { SemDados } from "@/components/SemDados";
import { TabelaOrdenavel } from "@/components/TabelaOrdenavel";
import { TituloSecao } from "@/components/ui";
import { porArea } from "@/lib/dados/analises";
import { cubo } from "@/lib/dados/repositorio";
import { CATEGORIAS_CIDADAS, categoriaDaFuncao } from "@/lib/referencia/categorias";
import { formatarBRLCompacto } from "@/lib/dinheiro";
import { descreverPeriodo, paraQuery } from "@/lib/filtros";
import { contexto, type SearchParams } from "@/lib/pagina";

export const metadata: Metadata = { title: "Com o que se gasta" };
export const dynamic = "force-dynamic";

export default async function PaginaAreas({ searchParams }: { searchParams: SearchParams }) {
  const { f, opcoes } = await contexto(searchParams);
  if (!cubo("execucao", f.ano) && !cubo("orcamento", f.ano)) return <SemDados ano={f.ano} />;
  const r = porArea(f);
  // Agrupa funções oficiais em categorias cidadãs SOMENTE por correspondência documentada de códigos.
  const cats = CATEGORIAS_CIDADAS.map((c) => {
    const fs = r.itens.filter((i) => c.funcoes.includes(i.cod));
    return { ...c, pago: fs.reduce((s, i) => s + i.pago, 0), atualizado: fs.some((i) => i.atualizado !== null) ? fs.reduce((s, i) => s + (i.atualizado ?? 0), 0) : null, presentes: fs };
  }).filter((c) => c.presentes.length);
  const semCategoria = r.itens.filter((i) => !categoriaDaFuncao(i.cod));
  const max = Math.max(...cats.map((c) => c.pago), 1);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-[22px] font-semibold">Com o que se gasta · {descreverPeriodo(f)}</h1>
        <p className="max-w-3xl text-[13.5px] text-tinta-2">
          Gastos por área de atuação, com base na classificação funcional oficial. As categorias abaixo agrupam funções oficiais por código; a correspondência está documentada e as funções originais continuam visíveis.
        </p>
      </div>
      <BarraFiltros opcoes={opcoes} />
      <section className="cartao p-4">
        <TituloSecao titulo="Categorias" sub="Valor pago no período. Clique para filtrar todo o painel pela função oficial." ajuda="funcao" />
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {cats.map((c) => (
            <div key={c.id} className="rounded-md border border-borda p-3">
              <div className="flex items-baseline justify-between gap-2">
                <h3 className="font-semibold">{c.nome}</h3>
                <span className="num font-semibold">{formatarBRLCompacto(c.pago)}</span>
              </div>
              <div className="mt-1.5 h-[6px] rounded-full bg-plano" aria-hidden>
                <div className="h-[6px] rounded-full bg-azul-450" style={{ width: `${(c.pago / max) * 100}%` }} />
              </div>
              <p className="mt-1.5 text-[12px] text-tinta-3">
                Funções oficiais:{" "}
                {c.presentes.map((p, i) => (
                  <span key={p.cod}>
                    {i > 0 && ", "}
                    <Link className="link" href={`/areas${paraQuery(f, { funcao: p.cod })}`}>{p.cod} {p.nome}</Link>
                  </span>
                ))}
              </p>
              {c.nota && <p className="mt-1 text-[12px] text-serio">{c.nota}</p>}
            </div>
          ))}
        </div>
        {semCategoria.length > 0 && (
          <p className="mt-3 text-[12.5px] text-tinta-3">
            Outras funções oficiais sem categoria correspondente: {semCategoria.map((s) => `${s.cod} ${s.nome}`).join("; ")}.
          </p>
        )}
      </section>
      <section className="cartao p-4">
        <TituloSecao titulo="Funções oficiais (classificação original)" />
        <TabelaOrdenavel
          rotulo="Funções de governo"
          colunas={[
            { chave: "nome", titulo: "Função", link: "href" },
            { chave: "cod", titulo: "Código" },
            { chave: "atualizado", titulo: "Orç. atualizado", tipo: "moeda" },
            { chave: "empenhado", titulo: "Empenhado", tipo: "moeda" },
            { chave: "liquidado", titulo: "Liquidado", tipo: "moeda" },
            { chave: "pago", titulo: "Pago", tipo: "moeda" },
          ]}
          linhas={r.itens.map((i) => ({ ...i, href: `/orgaos${paraQuery(f, { funcao: i.cod })}` }))}
          ordemInicial="pago"
          porPagina={30}
        />
        <div className="mt-3"><Proveniencia p={r.proveniencia} /></div>
      </section>
    </div>
  );
}
