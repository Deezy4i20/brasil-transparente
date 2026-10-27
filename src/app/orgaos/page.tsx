import type { Metadata } from "next";
import { BarraFiltros } from "@/components/BarraFiltros";
import { Proveniencia } from "@/components/Proveniencia";
import { SemDados } from "@/components/SemDados";
import { TabelaOrdenavel } from "@/components/TabelaOrdenavel";
import { TituloSecao } from "@/components/ui";
import { rankingOrgaos } from "@/lib/dados/analises";
import { cubo } from "@/lib/dados/repositorio";
import { descreverPeriodo } from "@/lib/filtros";
import { contexto, type SearchParams } from "@/lib/pagina";

export const metadata: Metadata = { title: "Quem gasta" };
export const dynamic = "force-dynamic";

export default async function PaginaOrgaos({ searchParams }: { searchParams: SearchParams }) {
  const { f, query, opcoes } = await contexto(searchParams);
  if (!cubo("execucao", f.ano) && !cubo("orcamento", f.ano)) return <SemDados ano={f.ano} />;
  const r = rankingOrgaos(f);
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-[22px] font-semibold">Quem gasta · {descreverPeriodo(f)}</h1>
        <p className="max-w-3xl text-[13.5px] text-tinta-2">
          Órgãos superiores (ministérios e equivalentes) do Poder Executivo federal, com o orçamento autorizado e as etapas da execução. Clique em um órgão para ver suas unidades, programas, ações e a natureza da despesa.
        </p>
      </div>
      <BarraFiltros opcoes={opcoes} />
      <section className="cartao p-4">
        <TituloSecao titulo="Órgãos superiores" ajuda="orgao-superior" sub="% executado = pago ÷ orçamento atualizado (calculado pela plataforma)." />
        <TabelaOrdenavel
          rotulo="Órgãos superiores e execução da despesa"
          colunas={[
            { chave: "nome", titulo: "Órgão", link: "href" },
            { chave: "atualizado", titulo: "Orçamento atualizado", tipo: "moeda" },
            { chave: "empenhado", titulo: "Empenhado", tipo: "moeda" },
            { chave: "liquidado", titulo: "Liquidado", tipo: "moeda" },
            { chave: "pago", titulo: "Pago", tipo: "moeda" },
            { chave: "executado", titulo: "% executado", tipo: "percentual" },
          ]}
          linhas={r.itens.map((o) => ({ ...o, href: `/orgaos/${o.cod}${query}`, executado: o.atualizado ? o.pago / o.atualizado : null }))}
          ordemInicial="pago"
          porPagina={20}
        />
        <div className="mt-3"><Proveniencia p={r.proveniencia} /></div>
      </section>
    </div>
  );
}
