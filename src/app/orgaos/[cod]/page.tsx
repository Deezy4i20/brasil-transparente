import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BarraFiltros } from "@/components/BarraFiltros";
import { Proveniencia } from "@/components/Proveniencia";
import { TabelaOrdenavel } from "@/components/TabelaOrdenavel";
import { EstagiosExecucao } from "@/components/graficos/EstagiosExecucao";
import { GraficoBarras } from "@/components/graficos/GraficoBarras";
import { TituloSecao } from "@/components/ui";
import { detalheOrgao } from "@/lib/dados/analises";
import { descreverPeriodo, paraQuery } from "@/lib/filtros";
import { contexto, type SearchParams } from "@/lib/pagina";
import { linksPortal } from "@/lib/portal/endpoints";

export const metadata: Metadata = { title: "Órgão" };
export const dynamic = "force-dynamic";

const COLS = (rot: string, link = false) => [
  { chave: "nome", titulo: rot, ...(link ? { link: "href" } : {}) },
  { chave: "cod", titulo: "Código" },
  { chave: "atualizado", titulo: "Orç. atualizado", tipo: "moeda" as const },
  { chave: "empenhado", titulo: "Empenhado", tipo: "moeda" as const },
  { chave: "liquidado", titulo: "Liquidado", tipo: "moeda" as const },
  { chave: "pago", titulo: "Pago", tipo: "moeda" as const },
];

export default async function PaginaOrgao({ params, searchParams }: { params: Promise<{ cod: string }>; searchParams: SearchParams }) {
  const { cod } = await params;
  if (!/^[\w-]{1,12}$/.test(cod)) notFound();
  const { f, opcoes } = await contexto(searchParams);
  const d = detalheOrgao(f, cod);
  if (!d) notFound();
  return (
    <div className="space-y-5">
      <nav aria-label="Trilha" className="text-[12.5px] text-tinta-3">
        <Link className="link" href={`/orgaos${paraQuery(f)}`}>Quem gasta</Link> › <span className="text-tinta">{d.nome}</span>
      </nav>
      <div>
        <h1 className="text-[22px] font-semibold">{d.nome}</h1>
        <p className="text-[13px] text-tinta-3">
          Órgão superior · código SIAFI {d.cod} · {descreverPeriodo(f)} ·{" "}
          <a className="link" href={linksPortal.orgao(d.cod)} target="_blank" rel="noreferrer">ver no Portal da Transparência</a>
        </p>
      </div>
      <BarraFiltros opcoes={opcoes} campos={["regiao", "uf", "funcao", "programa", "grupo"]} />
      <div className="grid gap-4 lg:grid-cols-2">
        <section className="cartao p-4">
          <TituloSecao titulo="Do orçamento ao pagamento" />
          <EstagiosExecucao v={d.total} />
        </section>
        <section className="cartao p-4">
          <TituloSecao titulo={`Pagamentos por mês — ${f.ano}`} />
          <GraficoBarras dados={d.mensal.map((m) => ({ rotulo: m.rotulo, valor: m.pago }))} rotulo="Pago" descricao={`Valor pago por mês pelo órgão ${d.nome}`} />
          {d.anual.length > 1 && (
            <div className="mt-3">
              <TituloSecao titulo="Pagamentos por ano" />
              <GraficoBarras dados={d.anual.map((a) => ({ rotulo: String(a.ano), valor: a.pago }))} rotulo="Pago" descricao="Valor pago por ano" altura={150} />
            </div>
          )}
        </section>
      </div>
      {(
        [
          ["Unidades (órgãos subordinados)", d.orgaos, "Órgão / entidade"],
          ["Programas", d.programas, "Programa"],
          ["Ações orçamentárias", d.acoes, "Ação"],
          ["Áreas de atuação (função)", d.funcoes, "Função"],
          ["Natureza da despesa (grupo)", d.grupos, "Grupo"],
        ] as const
      ).map(([t, linhas, rot]) => (
        <section key={t} className="cartao p-4">
          <TituloSecao titulo={t} sub={t.startsWith("Ações") ? "Uma ação orçamentária não é uma obra individual: pode financiar muitas iniciativas." : undefined} />
          <TabelaOrdenavel
            rotulo={t}
            colunas={COLS(rot, t.startsWith("Ações"))}
            linhas={linhas.map((l) => ({ ...l, href: `/busca/acao/${encodeURIComponent(l.cod)}${paraQuery(f)}` }))}
            ordemInicial="pago"
            porPagina={10}
          />
        </section>
      ))}
      <Proveniencia p={d.proveniencia} />
    </div>
  );
}
