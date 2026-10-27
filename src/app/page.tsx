import Link from "next/link";
import { BarraFiltros } from "@/components/BarraFiltros";
import { CartaoIndicador } from "@/components/CartaoIndicador";
import { MapaBrasil } from "@/components/mapa/MapaBrasil";
import { ControlesMapa } from "@/components/mapa/ControlesMapa";
import { PainelEstado } from "@/components/PainelEstado";
import { Proveniencia } from "@/components/Proveniencia";
import { SemDados } from "@/components/SemDados";
import { EstagiosExecucao } from "@/components/graficos/EstagiosExecucao";
import { EstadoVazio, ListaBarras, TituloSecao } from "@/components/ui";
import { indicadores, listaEmendas, porArea, rankingFavorecidos, rankingOrgaos, rankingProgramas, territorio } from "@/lib/dados/analises";
import { cubo } from "@/lib/dados/repositorio";
import { formatarBRL, formatarBRLCompacto } from "@/lib/dinheiro";
import { descreverPeriodo, METRICAS, paraQuery } from "@/lib/filtros";
import { contexto, type SearchParams } from "@/lib/pagina";

export const dynamic = "force-dynamic";

export default async function Painel({ searchParams }: { searchParams: SearchParams }) {
  const { f, query, opcoes } = await contexto(searchParams);
  const temAno = Boolean(cubo("execucao", f.ano) || cubo("orcamento", f.ano) || cubo("transferencias", f.ano));
  const q = (o: Record<string, string | null | undefined> = {}) => paraQuery(f, o);

  if (!temAno)
    return (
      <div className="space-y-4">
        <h1 className="text-[22px] font-semibold">Painel dos gastos federais</h1>
        <SemDados ano={f.ano} />
      </div>
    );

  const inds = indicadores(f);
  const terr = territorio(f);
  const met = METRICAS[f.metrica];
  const orgaos = rankingOrgaos(f);
  const areas = porArea(f);
  const programas = rankingProgramas(f, 8);
  const favorecidos = rankingFavorecidos(f, 8);
  const emendas = listaEmendas(f, { porPagina: 6 });
  const estagio = Object.fromEntries(inds.filter((i) => ["orcamento", "empenhado", "liquidado", "pago"].includes(i.id)).map((i) => [i.id === "orcamento" ? "atualizado" : i.id, i.atual.valor]));
  const fmt = formatarBRLCompacto;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-semibold leading-tight">Painel dos gastos federais · {descreverPeriodo(f)}</h1>
          <p className="text-[13.5px] text-tinta-2">Quanto o governo federal pode gastar, quanto comprometeu e quanto pagou — e para onde foi o dinheiro.</p>
        </div>
      </div>
      <BarraFiltros opcoes={opcoes} />

      <section aria-label="Indicadores principais" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {inds.map((i) => (
          <CartaoIndicador key={i.id} ind={i} query={query} />
        ))}
      </section>

      <section className="grid gap-4 lg:grid-cols-[minmax(0,1.75fr)_minmax(320px,1fr)]">
        <div className="cartao p-4">
          <TituloSecao
            titulo={`Para onde vai o dinheiro — ${met.rotulo.toLowerCase()}`}
            sub={met.descricao}
            acao={<ControlesMapa metrica={f.metrica} modo={f.modo} />}
          />
          {terr.disponivel ? (
            <>
              <MapaBrasil dados={terr.ufs} modo={f.modo} selecionada={f.uf} regiaoDestaque={f.regiao} rotuloMetrica={met.curto} naoIdentificado={terr.naoIdentificado} />
              <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                <Proveniencia p={terr.proveniencia} />
                <Link href={`/mapa${query}`} className="link text-[13px]">Explorar municípios e comparar →</Link>
              </div>
            </>
          ) : (
            <EstadoVazio titulo="Sem dados territoriais para esta métrica no período">{terr.proveniencia.metodologia}</EstadoVazio>
          )}
        </div>

        <aside className="cartao p-4" aria-label={f.uf ? "Painel do estado selecionado" : "Resumo nacional"}>
          {f.uf ? (
            <PainelEstado f={f} sigla={f.uf} />
          ) : (
            <div className="space-y-5">
              <div>
                <TituloSecao titulo="Do orçamento ao pagamento" sub={`Governo federal · ${descreverPeriodo(f)}`} ajuda="empenho" />
                <EstagiosExecucao v={estagio} />
              </div>
              <div className="border-t border-borda pt-4">
                <TituloSecao titulo={`Estados — ${met.curto.toLowerCase()}`} sub={f.modo === "per_capita" ? "Por habitante (Censo 2022)" : "Valor total"} />
                <ListaBarras
                  itens={[...terr.ufs]
                    .sort((a, b) => a.posicao - b.posicao)
                    .slice(0, 8)
                    .map((u) => ({ cod: u.sigla, nome: u.nome, valor: f.modo === "per_capita" ? u.perCapita : u.valor }))}
                  formatar={f.modo === "per_capita" ? (v) => `${formatarBRL(v)}/hab.` : fmt}
                  hrefDe={(c) => `/${q({ uf: c })}`}
                  rodape="Clique em um estado no mapa ou na lista para ver o detalhamento."
                />
              </div>
            </div>
          )}
        </aside>
      </section>

      <section aria-labelledby="t-rankings">
        <h2 id="t-rankings" className="mb-3 text-[18px] font-semibold">Rankings nacionais</h2>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <div className="cartao p-4">
            <TituloSecao titulo="Órgãos que mais pagaram" ajuda="orgao-superior" acao={<Link className="link text-[12.5px]" href={`/orgaos${query}`}>Ver todos</Link>} />
            <ListaBarras itens={orgaos.itens.slice(0, 8).map((o) => ({ cod: o.cod, nome: o.nome, valor: o.pago }))} formatar={fmt} hrefDe={(c) => `/orgaos/${c}${query}`} />
            <div className="mt-3"><Proveniencia p={orgaos.proveniencia} compacto /></div>
          </div>
          <div className="cartao p-4">
            <TituloSecao titulo="Áreas com maior volume pago" ajuda="funcao" acao={<Link className="link text-[12.5px]" href={`/areas${query}`}>Ver todas</Link>} />
            <ListaBarras itens={areas.itens.slice(0, 8).map((o) => ({ cod: o.cod, nome: o.nome, valor: o.pago }))} formatar={fmt} hrefDe={(c) => `/areas${q({ funcao: c })}`} />
            <div className="mt-3"><Proveniencia p={areas.proveniencia} compacto /></div>
          </div>
          <div className="cartao p-4">
            <TituloSecao titulo="Programas com maior orçamento" ajuda="programa" />
            {programas ? (
              <>
                <ListaBarras itens={programas.itens.map((x) => ({ ...x, sub: `Programa ${x.cod}` }))} formatar={fmt} hrefDe={(c) => `/${q({ programa: c })}`} />
                <div className="mt-3"><Proveniencia p={programas.proveniencia} compacto /></div>
              </>
            ) : (
              <p className="text-sm text-tinta-3">Orçamento não disponível para este recorte (não é regionalizado por estado).</p>
            )}
          </div>
          <div className="cartao p-4">
            <TituloSecao titulo="Favorecidos de transferências" acao={<Link className="link text-[12.5px]" href={`/favorecidos${query}`}>Pesquisar</Link>} />
            {favorecidos ? (
              <>
                <ListaBarras itens={favorecidos.itens.map((x) => ({ cod: x.cod, nome: x.nome, valor: x.valor, sub: x.tipo }))} formatar={fmt} />
                <div className="mt-3"><Proveniencia p={favorecidos.proveniencia} compacto /></div>
              </>
            ) : (
              <p className="text-sm text-tinta-3">Não disponível.</p>
            )}
          </div>
          <div className="cartao p-4">
            <TituloSecao titulo="Emendas com maior valor pago" ajuda="emenda-parlamentar" acao={<Link className="link text-[12.5px]" href={`/emendas${query}`}>Ver todas</Link>} />
            {emendas ? (
              <>
                <ListaBarras
                  itens={emendas.itens.map((e) => ({ cod: e.codigo, nome: `Emenda ${e.numero} — ${e.autor}`, valor: e.pago, sub: `${e.municipio} (${e.uf}) · ${e.funcao}` }))}
                  formatar={fmt}
                  hrefDe={(c) => `/emendas${q({ q: c })}`}
                />
                <div className="mt-3"><Proveniencia p={emendas.proveniencia} compacto /></div>
              </>
            ) : (
              <p className="text-sm text-tinta-3">Não disponível.</p>
            )}
          </div>
          <div className="cartao p-4">
            <TituloSecao titulo="Contratos com maiores valores" ajuda="contrato" />
            <EstadoVazio titulo="Ainda não integrado em lote">
              <p>O ranking nacional de contratos depende do arquivo “Contratos” dos dados abertos, que entra na próxima etapa do ETL.</p>
              <Link className="link" href={`/contratos${query}`}>Consultar contratos por órgão (API ao vivo) →</Link>
            </EstadoVazio>
          </div>
        </div>
      </section>
    </div>
  );
}
