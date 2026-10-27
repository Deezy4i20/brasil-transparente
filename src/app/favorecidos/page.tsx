import type { Metadata } from "next";
import { BarraFiltros } from "@/components/BarraFiltros";
import { Proveniencia } from "@/components/Proveniencia";
import { SemDados } from "@/components/SemDados";
import { TituloSecao } from "@/components/ui";
import { rankingFavorecidos } from "@/lib/dados/analises";
import { formatarBRL, formatarBRLCompacto } from "@/lib/dinheiro";
import { contexto, texto, type SearchParams } from "@/lib/pagina";
import { linksPortal } from "@/lib/portal/endpoints";

export const metadata: Metadata = { title: "Empresas e favorecidos" };
export const dynamic = "force-dynamic";

const cnpj = (c: string) => (/^\d{14}$/.test(c) ? c.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5") : c);

export default async function PaginaFavorecidos({ searchParams }: { searchParams: SearchParams }) {
  const { f, p, opcoes } = await contexto(searchParams);
  const q = texto(p, "q", 80);
  const r = rankingFavorecidos(f, 50, q);
  if (!r) return <SemDados ano={f.ano} />;
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-[22px] font-semibold">Empresas, entidades e entes favorecidos · {f.ano}</h1>
        <p className="max-w-3xl text-[13.5px] text-tinta-2">
          Quem recebeu transferências federais no ano. Pessoas físicas não são listadas individualmente. <b>Receber recursos públicos não é indício de irregularidade.</b> Pagamentos diretos a fornecedores (contratos) entram nesta página quando o arquivo de despesas por favorecido for integrado.
        </p>
      </div>
      <BarraFiltros opcoes={opcoes} campos={["regiao", "uf"]} />
      <section className="cartao p-4">
        <form className="mb-3 flex flex-wrap items-end gap-2" action="/favorecidos">
          <input type="hidden" name="ano" value={f.ano} />
          {f.uf && <input type="hidden" name="uf" value={f.uf} />}
          <label className="min-w-[240px] flex-1 text-[12.5px]">
            <span className="mb-1 block font-semibold text-tinta-2">Nome ou CNPJ</span>
            <input className="campo" name="q" defaultValue={q} maxLength={80} />
          </label>
          <button className="botao-primario" type="submit">Buscar</button>
        </form>
        <TituloSecao titulo={q ? `Resultados para “${q}”` : "Maiores favorecidos"} sub={`${r.total.toLocaleString("pt-BR")} favorecido(s) encontrados · mostrando até 50`} />
        <div className="overflow-x-auto rounded-md border border-borda">
          <table className="tabela min-w-[640px]">
            <thead><tr><th>#</th><th>Favorecido</th><th>Identificador</th><th>Tipo</th><th className="valor">Recebido</th></tr></thead>
            <tbody>
              {r.itens.map((i, n) => (
                <tr key={i.cod}>
                  <td className="num text-tinta-3">{n + 1}</td>
                  <td>{i.nome}</td>
                  <td className="num">{/^\d{14}$/.test(i.cod) ? <a className="link" href={linksPortal.favorecido(i.cod)} target="_blank" rel="noreferrer">{cnpj(i.cod)}</a> : i.cod}</td>
                  <td>{i.tipo}</td>
                  <td className="valor" title={formatarBRL(i.valor)}>{formatarBRLCompacto(i.valor)}</td>
                </tr>
              ))}
              {!r.itens.length && <tr><td colSpan={5} className="py-6 text-center text-tinta-3">Nenhum favorecido encontrado.</td></tr>}
            </tbody>
          </table>
        </div>
        <div className="mt-3"><Proveniencia p={r.proveniencia} /></div>
      </section>
    </div>
  );
}
