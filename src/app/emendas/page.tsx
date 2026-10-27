import type { Metadata } from "next";
import Link from "next/link";
import { BarraFiltros } from "@/components/BarraFiltros";
import { Proveniencia } from "@/components/Proveniencia";
import { SemDados } from "@/components/SemDados";
import { ListaBarras, TituloSecao } from "@/components/ui";
import { listaEmendas } from "@/lib/dados/analises";
import { formatarBRL, formatarBRLCompacto } from "@/lib/dinheiro";
import { paraQuery } from "@/lib/filtros";
import { contexto, texto, type SearchParams } from "@/lib/pagina";
import { linksPortal } from "@/lib/portal/endpoints";

export const metadata: Metadata = { title: "Emendas parlamentares" };
export const dynamic = "force-dynamic";

export default async function PaginaEmendas({ searchParams }: { searchParams: SearchParams }) {
  const { f, p, opcoes } = await contexto(searchParams);
  const q = texto(p, "q", 80);
  const ordenar = texto(p, "ordenar") === "empenhado" ? "empenhado" : "pago";
  const pagina = Math.max(1, Math.min(10_000, Number(texto(p, "pagina")) || 1));
  const r = listaEmendas(f, { q, ordenar, pagina, porPagina: 25 });
  if (!r) return <SemDados ano={f.ano} />;
  const link = (o: Record<string, string | number | null>) => `/emendas${paraQuery(f, { q, ordenar: ordenar === "pago" ? null : ordenar, ...o })}`;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-[22px] font-semibold">Emendas parlamentares · {f.ano}</h1>
        <p className="max-w-3xl text-[13.5px] text-tinta-2">
          Emendas do ano {f.ano}, com autor, destino informado e execução. <b>Autoria</b>, <b>indicação de destino</b>, <b>execução</b> (empenho, liquidação, pagamento) e <b>recebimento</b> pelo beneficiário são etapas distintas.
        </p>
      </div>
      <BarraFiltros opcoes={opcoes} campos={["regiao", "uf", "funcao", "programa"]} />
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
        <section className="cartao p-4">
          <form className="mb-3 flex flex-wrap items-end gap-2" action="/emendas">
            {Object.entries({ ano: f.ano, uf: f.uf, regiao: f.regiao, funcao: f.funcao, programa: f.programa }).map(([k, v]) => v && <input key={k} type="hidden" name={k} value={v} />)}
            <label className="min-w-[240px] flex-1 text-[12.5px]">
              <span className="mb-1 block font-semibold text-tinta-2">Buscar por autor, código, número ou município</span>
              <input className="campo" name="q" defaultValue={q} maxLength={80} />
            </label>
            <label className="text-[12.5px]">
              <span className="mb-1 block font-semibold text-tinta-2">Ordenar por</span>
              <select className="campo" name="ordenar" defaultValue={ordenar}>
                <option value="pago">Valor pago</option>
                <option value="empenhado">Valor empenhado</option>
              </select>
            </label>
            <button className="botao-primario" type="submit">Aplicar</button>
          </form>
          <p className="mb-2 text-[12.5px] text-tinta-3">
            {r.total.toLocaleString("pt-BR")} emenda(s) · empenhado {formatarBRLCompacto(r.somas.empenhado)} · liquidado {formatarBRLCompacto(r.somas.liquidado)} · pago {formatarBRLCompacto(r.somas.pago)}
          </p>
          <div className="overflow-x-auto rounded-md border border-borda">
            <table className="tabela min-w-[760px]">
              <caption className="sr-only">Emendas parlamentares</caption>
              <thead>
                <tr><th>Emenda</th><th>Autor</th><th>Destino</th><th>Área</th><th className="valor">Empenhado</th><th className="valor">Pago</th></tr>
              </thead>
              <tbody>
                {r.itens.map((e) => (
                  <tr key={`${e.codigo}-${e.municipio}-${e.funcao}`}>
                    <td>
                      <span className="font-medium">{e.numero}</span>
                      <span className="block text-[11.5px] text-tinta-3">{e.codigo} · {e.tipo}</span>
                    </td>
                    <td>{e.autor}</td>
                    <td>{e.municipio}{e.uf && e.uf !== "NI" ? ` (${e.uf})` : ""}<span className="block text-[11.5px] text-tinta-3">{e.localidade}</span></td>
                    <td>{e.funcao}</td>
                    <td className="valor" title={formatarBRL(e.empenhado)}>{formatarBRLCompacto(e.empenhado)}</td>
                    <td className="valor" title={formatarBRL(e.pago)}>{formatarBRLCompacto(e.pago)}</td>
                  </tr>
                ))}
                {!r.itens.length && <tr><td colSpan={6} className="py-6 text-center text-tinta-3">Nenhuma emenda encontrada.</td></tr>}
              </tbody>
            </table>
          </div>
          <nav aria-label="Paginação" className="mt-2 flex items-center justify-end gap-2 text-[12.5px]">
            {r.pagina > 1 && <Link className="botao" href={link({ pagina: r.pagina - 1 })}>Anterior</Link>}
            <span className="num text-tinta-2">{r.pagina} de {r.paginas}</span>
            {r.pagina < r.paginas && <Link className="botao" href={link({ pagina: r.pagina + 1 })}>Próxima</Link>}
          </nav>
          <p className="mt-2 text-[12.5px] text-tinta-3">
            Para conferir uma emenda e seus documentos, pesquise o código no{" "}
            <a className="link" href={linksPortal.emendasConsulta(f.ano)} target="_blank" rel="noreferrer">Portal da Transparência</a>.
          </p>
          <div className="mt-3"><Proveniencia p={r.proveniencia} /></div>
        </section>
        <aside className="cartao h-fit p-4">
          <TituloSecao titulo="Autores com maior valor pago" sub="Considera os filtros ativos" />
          <ListaBarras itens={r.porAutor.map((a) => ({ cod: a.cod, nome: a.nome, valor: a.pago, sub: `empenhado ${formatarBRLCompacto(a.empenhado)}` }))} formatar={formatarBRLCompacto} hrefDe={(c) => link({ q: r.porAutor.find((a) => a.cod === c)?.nome ?? null, pagina: null })} />
        </aside>
      </div>
    </div>
  );
}
