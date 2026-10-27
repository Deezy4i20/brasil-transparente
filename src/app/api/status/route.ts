import { NextResponse } from "next/server";
import { manifesto, MODO_DEMONSTRACAO, anosDisponiveis } from "@/lib/dados/repositorio";
import { statusConexao, tokenConfigurado } from "@/lib/portal/cliente";

export const dynamic = "force-dynamic";

/** Estado das fontes: agregados carregados, modo, e conectividade da API (sem expor o token). */
export async function GET() {
  const m = manifesto();
  return NextResponse.json({
    modo: MODO_DEMONSTRACAO ? "demonstracao" : "oficial",
    anos: anosDisponiveis(),
    agregadosGeradosEm: m?.geradoEm ?? null,
    conjuntos: m?.conjuntos.map((c) => ({ conjunto: c.conjunto, ano: c.ano, meses: c.mesesDisponiveis, processadoEm: c.processadoEm, avisos: c.avisos.length })) ?? [],
    api: { tokenConfigurado: tokenConfigurado(), ...(await statusConexao()) },
  });
}
