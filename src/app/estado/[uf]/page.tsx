import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { PainelEstado } from "@/components/PainelEstado";
import { BarraFiltros } from "@/components/BarraFiltros";
import { SemDados } from "@/components/SemDados";
import { cubo } from "@/lib/dados/repositorio";
import { descreverPeriodo, paraQuery } from "@/lib/filtros";
import { contexto, type SearchParams } from "@/lib/pagina";
import { resolverUF } from "@/lib/referencia/ufs";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ uf: string }> }): Promise<Metadata> {
  const u = resolverUF((await params).uf);
  return { title: u ? u.nome : "Estado" };
}

export default async function PaginaEstado({ params, searchParams }: { params: Promise<{ uf: string }>; searchParams: SearchParams }) {
  const u = resolverUF((await params).uf);
  if (!u || u.sigla !== (await params).uf.toUpperCase()) notFound();
  const { f, opcoes } = await contexto(searchParams);
  const ff = { ...f, uf: u.sigla, regiao: undefined };
  const tem = cubo("execucao", f.ano) || cubo("transferencias", f.ano);
  return (
    <div className="space-y-4">
      <nav aria-label="Trilha" className="text-[12.5px] text-tinta-3">
        <Link className="link" href={`/mapa${paraQuery({ ...f, uf: undefined })}`}>Brasil</Link> › {u.regiao} › <span className="text-tinta">{u.nome}</span>
      </nav>
      <h1 className="sr-only">{u.nome} · {descreverPeriodo(f)}</h1>
      <BarraFiltros opcoes={opcoes} campos={["orgao", "funcao", "programa", "grupo"]} />
      {tem ? (
        <div className="cartao mx-auto max-w-4xl p-5">
          <PainelEstado f={ff} sigla={u.sigla} completo />
        </div>
      ) : (
        <SemDados ano={f.ano} />
      )}
    </div>
  );
}
