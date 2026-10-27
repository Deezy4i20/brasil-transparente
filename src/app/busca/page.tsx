import type { Metadata } from "next";
import Link from "next/link";
import { EstadoVazio } from "@/components/ui";
import { buscar } from "@/lib/dados/analises";
import { contexto, texto, type SearchParams } from "@/lib/pagina";

export const metadata: Metadata = { title: "Busca" };
export const dynamic = "force-dynamic";

export default async function PaginaBusca({ searchParams }: { searchParams: SearchParams }) {
  const { f, p } = await contexto(searchParams);
  const q = texto(p, "q", 120) ?? "";
  const r = q.length >= 2 ? buscar(q, f.ano, 8) : {};
  const grupos = Object.entries(r);
  return (
    <div className="space-y-4">
      <h1 className="text-[22px] font-semibold">Resultados para “{q}” <span className="text-[15px] font-normal text-tinta-3">· {f.ano}</span></h1>
      {q.length < 2 && <EstadoVazio titulo="Digite pelo menos 2 caracteres na busca." />}
      {q.length >= 2 && !grupos.length && (
        <EstadoVazio titulo="Nada encontrado">
          A busca cobre estados, órgãos, áreas, programas, ações, municípios, emendas (autor ou código) e favorecidos dos dados carregados para {f.ano}. Contratos e licitações são consultados ao vivo no módulo <Link className="link" href="/contratos">Contratos</Link>.
        </EstadoVazio>
      )}
      <div className="grid gap-4 md:grid-cols-2">
        {grupos.map(([tipo, itens]) => (
          <section key={tipo} className="cartao p-4">
            <h2 className="rotulo mb-2">{tipo}</h2>
            <ul className="divide-y divide-borda">
              {itens.map((i) => (
                <li key={i.href} className="py-2">
                  <Link className="link font-medium" href={i.href}>{i.titulo}</Link>
                  {i.subtitulo && <span className="block text-[12px] text-tinta-3">{i.subtitulo}</span>}
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
