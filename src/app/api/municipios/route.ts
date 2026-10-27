import { NextResponse, type NextRequest } from "next/server";
import { municipios } from "@/lib/dados/analises";
import { anoPadrao } from "@/lib/dados/repositorio";
import { lerFiltros } from "@/lib/filtros";
import { resolverUF } from "@/lib/referencia/ufs";

export const dynamic = "force-dynamic";

/** Valores por município de uma UF, para a métrica e filtros informados. */
export function GET(req: NextRequest) {
  const p = Object.fromEntries(req.nextUrl.searchParams);
  const uf = resolverUF(p.uf ?? "");
  if (!uf) return NextResponse.json({ erro: "Parâmetro uf inválido." }, { status: 400 });
  const f = lerFiltros(p, anoPadrao());
  const r = municipios(f, uf.sigla);
  return NextResponse.json(r, { headers: { "Cache-Control": "private, max-age=300" } });
}
