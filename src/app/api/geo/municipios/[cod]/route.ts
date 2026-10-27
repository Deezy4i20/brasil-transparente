import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { NextResponse } from "next/server";
import { UFS } from "@/lib/referencia/ufs";

/** Malha municipal simplificada (TopoJSON) de uma UF, pelo código IBGE da UF. */
export async function GET(_: Request, { params }: { params: Promise<{ cod: string }> }) {
  const { cod } = await params;
  if (!UFS.some((u) => String(u.cod) === cod)) return NextResponse.json({ erro: "UF inválida." }, { status: 400 });
  try {
    const txt = await readFile(join(process.cwd(), "data", "geo", "municipios", `${cod}.topo.json`), "utf8");
    return new NextResponse(txt, { headers: { "Content-Type": "application/json", "Cache-Control": "public, max-age=86400" } });
  } catch {
    return NextResponse.json({ erro: "Malha não encontrada. Execute npm run malhas." }, { status: 404 });
  }
}
