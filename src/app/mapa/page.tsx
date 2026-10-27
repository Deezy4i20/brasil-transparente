import type { Metadata } from "next";
import { BarraFiltros } from "@/components/BarraFiltros";
import { MapaBrasil } from "@/components/mapa/MapaBrasil";
import { ControlesMapa } from "@/components/mapa/ControlesMapa";
import { Proveniencia } from "@/components/Proveniencia";
import { SemDados } from "@/components/SemDados";
import { TabelaOrdenavel } from "@/components/TabelaOrdenavel";
import { EstadoVazio, TituloSecao } from "@/components/ui";
import { municipios, territorio } from "@/lib/dados/analises";
import { formatarBRL, formatarBRLCompacto } from "@/lib/dinheiro";
import { descreverPeriodo, METRICAS, paraQuery } from "@/lib/filtros";
import { contexto, texto, type SearchParams } from "@/lib/pagina";
import { REGIOES, UFS } from "@/lib/referencia/ufs";

export const metadata: Metadata = { title: "Para onde vai o dinheiro" };
export const dynamic = "force-dynamic";

export default async function PaginaMapa({ searchParams }: { searchParams: SearchParams }) {
  const { f, p, opcoes } = await contexto(searchParams);
  const terr = territorio(f);
  const met = METRICAS[f.metrica];
  const mun = f.uf ? municipios(f, f.uf) : null;
  const ufSel = UFS.find((u) => u.sigla === f.uf);
  const regioes = REGIOES.map((r) => {
    const us = terr.ufs.filter((u) => u.regiao === r);
    const valor = us.reduce((s, u) => s + u.valor, 0);
    const pop = us.reduce((s, u) => s + u.populacao, 0);
    return { regiao: r, valor, perCapita: valor / pop, ufs: us.length };
  });
  const totalReg = regioes.reduce((s, r) => s + r.valor, 0);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-[22px] font-semibold">Para onde vai o dinheiro · {descreverPeriodo(f)}</h1>
        <p className="max-w-3xl text-[13.5px] text-tinta-2">
          Três leituras territoriais diferentes, mostradas separadamente: o <b>destino das transferências</b>, a <b>localidade indicada no plano de trabalho</b> da despesa e o <b>destino das emendas</b>. Gastar mais em um lugar não significa, por si só, maior benefício: população, responsabilidades e custos variam.
        </p>
      </div>
      <BarraFiltros opcoes={opcoes} />
      {!terr.disponivel && !terr.ufs.length ? (
        <SemDados ano={f.ano} />
      ) : (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(320px,1fr)]">
          <section className="cartao p-4">
            <TituloSecao
              titulo={ufSel ? `${met.rotulo} — ${ufSel.nome}, por município` : `${met.rotulo} por estado`}
              sub={ufSel ? "Clique de novo no estado (ou em ↺) para voltar ao Brasil." : "Clique em um estado para ver seus municípios."}
              acao={<ControlesMapa metrica={f.metrica} modo={f.modo} />}
            />
            <MapaBrasil
              dados={terr.ufs}
              modo={f.modo}
              selecionada={f.uf}
              regiaoDestaque={f.regiao}
              detalharMunicipios
              rotuloMetrica={met.curto}
              naoIdentificado={terr.naoIdentificado}
              consultaMunicipios={f.uf ? paraQuery(f) : undefined}
              municipioDestaque={texto(p, "mun", 20)}
            />
            <div className="mt-2">
              <Proveniencia p={mun?.proveniencia ?? terr.proveniencia} />
            </div>
          </section>
          <section className="cartao p-4">
            {ufSel && mun ? (
              <>
                <TituloSecao titulo={`Municípios de ${ufSel.nome}`} sub={`${met.rotulo} · ${mun.itens.filter((i) => i.identificado).length} municípios com registro`} />
                {mun.itens.length ? (
                  <TabelaOrdenavel
                    rotulo={`Municípios de ${ufSel.nome}`}
                    colunas={[
                      { chave: "nome", titulo: "Município" },
                      { chave: "valor", titulo: "Valor", tipo: "moeda" },
                    ]}
                    linhas={mun.itens.map((i) => ({ nome: i.identificado || i.nome === "Município não identificado" ? i.nome : `${i.nome} (nome sem correspondência no IBGE)`, valor: i.valor }))}
                    ordemInicial="valor"
                    porPagina={12}
                  />
                ) : (
                  <EstadoVazio titulo="Sem registros municipais para os filtros" />
                )}
              </>
            ) : (
              <>
                <TituloSecao titulo="Comparação por região" sub={f.modo === "per_capita" ? "Valor por habitante" : "Valor total e participação"} />
                <table className="tabela">
                  <thead>
                    <tr><th>Região</th><th className="valor">Total</th><th className="valor">Por hab.</th><th className="valor">Part.</th></tr>
                  </thead>
                  <tbody>
                    {regioes.map((r) => (
                      <tr key={r.regiao}>
                        <td>{r.regiao}</td>
                        <td className="valor">{formatarBRLCompacto(r.valor)}</td>
                        <td className="valor">{formatarBRL(r.perCapita)}</td>
                        <td className="valor">{totalReg ? `${((r.valor / totalReg) * 100).toFixed(1).replace(".", ",")}%` : "—"}</td>
                      </tr>
                    ))}
                    <tr>
                      <td className="text-tinta-3">Não identificada</td>
                      <td className="valor text-tinta-3">{formatarBRLCompacto(terr.naoIdentificado)}</td>
                      <td className="valor text-tinta-3">—</td>
                      <td className="valor text-tinta-3">fora da base</td>
                    </tr>
                  </tbody>
                </table>
                <p className="mt-2 text-[12px] text-tinta-3">Participação calculada sobre o total com UF identificada.</p>
                <div className="mt-5">
                  <TituloSecao titulo="Todos os estados" />
                  <TabelaOrdenavel
                    rotulo="Estados"
                    colunas={[
                      { chave: "nome", titulo: "Estado", link: "href" },
                      { chave: "valor", titulo: "Total", tipo: "moeda" },
                      { chave: "perCapita", titulo: "Por hab.", tipo: "moeda" },
                    ]}
                    linhas={terr.ufs.map((u) => ({ nome: u.nome, valor: u.valor, perCapita: u.perCapita, href: `/mapa${paraQuery(f, { uf: u.sigla })}` }))}
                    ordemInicial={f.modo === "per_capita" ? "perCapita" : "valor"}
                    porPagina={10}
                  />
                </div>
              </>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
