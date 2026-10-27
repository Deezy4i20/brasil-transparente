import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Proveniencia } from "@/components/Proveniencia";
import { EstagiosExecucao } from "@/components/graficos/EstagiosExecucao";
import { ListaBarras, TituloSecao } from "@/components/ui";
import { detalheAcao } from "@/lib/dados/analises";
import { formatarBRLCompacto } from "@/lib/dinheiro";
import { paraQuery } from "@/lib/filtros";
import { contexto, type SearchParams } from "@/lib/pagina";

export const metadata: Metadata = { title: "Ação orçamentária" };
export const dynamic = "force-dynamic";

export default async function PaginaAcao({ params, searchParams }: { params: Promise<{ cod: string }>; searchParams: SearchParams }) {
  const cod = decodeURIComponent((await params).cod);
  if (!/^[\w-]{1,12}$/.test(cod)) notFound();
  const { f } = await contexto(searchParams);
  const d = detalheAcao(f, cod);
  if (!d) notFound();
  const ident = d.ufs.filter((u) => u.cod !== "NI");
  const ni = d.ufs.find((u) => u.cod === "NI");
  return (
    <div className="space-y-5">
      <div>
        <p className="rotulo">Ação orçamentária {d.acao.cod} · {f.ano}</p>
        <h1 className="text-[22px] font-semibold">{d.acao.nome}</h1>
        <p className="mt-1 max-w-3xl text-[13px] text-tinta-3">Uma ação orçamentária não é uma obra ou projeto individual: pode financiar muitas iniciativas em lugares diferentes. Projetos só são exibidos quando há vínculo comprovável nos dados oficiais.</p>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <section className="cartao p-4">
          <TituloSecao titulo="Execução" />
          <EstagiosExecucao v={d.total} />
          <h3 className="rotulo mb-1 mt-4">Vínculos oficiais</h3>
          <ul className="space-y-1 text-[13px]">
            {d.vinculos.map((v) => (
              <li key={`${v.orgao.cod}-${v.programa.cod}`}>
                <Link className="link" href={`/orgaos/${v.orgao.cod}${paraQuery(f)}`}>{v.orgao.nome}</Link> · Programa {v.programa.cod} {v.programa.nome} · {v.funcao.nome}
              </li>
            ))}
          </ul>
        </section>
        <section className="cartao p-4">
          <TituloSecao titulo="Valor pago por UF indicada no plano de trabalho" />
          <ListaBarras itens={ident.slice(0, 12).map((u) => ({ cod: u.cod, nome: u.nome, valor: u.pago }))} formatar={formatarBRLCompacto} hrefDe={(c) => `/estado/${c}${paraQuery(f)}`} vazio="Nenhum pagamento com UF indicada." />
          {ni && <p className="mt-2 text-[12.5px] text-tinta-3">Sem localização identificada (abrangência nacional ou não informada): {formatarBRLCompacto(ni.pago)}</p>}
        </section>
      </div>
      <Proveniencia p={d.proveniencia} />
    </div>
  );
}
