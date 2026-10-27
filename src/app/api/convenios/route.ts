import { NextResponse, type NextRequest } from "next/server";
import { convenios, linksPortal } from "@/lib/portal/endpoints";
import { ErroPortal } from "@/lib/portal/cliente";
import { resolverUF } from "@/lib/referencia/ufs";

export const dynamic = "force-dynamic";

/** Convênios por UF via API do Portal (token fica no servidor). */
export async function GET(req: NextRequest) {
  const uf = resolverUF(req.nextUrl.searchParams.get("uf") ?? "");
  const ano = Number(req.nextUrl.searchParams.get("ano"));
  if (!uf || !Number.isInteger(ano) || ano < 2000 || ano > 2100) return NextResponse.json({ erro: "Parâmetros inválidos." }, { status: 400 });
  try {
    const r = await convenios({ uf: uf.sigla, dataInicial: `01/01/${ano}`, dataFinal: `31/12/${ano}` });
    const itens = r.itens
      .sort((a, b) => (b.valor ?? 0) - (a.valor ?? 0))
      .slice(0, 10)
      .map((c) => ({
        id: c.id,
        numero: c.numero,
        objeto: c.objeto,
        situacao: c.situacao,
        convenente: c.convenente?.nome ?? "—",
        municipio: c.municipioConvenente?.nomeIBGE ?? "—",
        valor: c.valor,
        valorLiberado: c.valorLiberado,
        vigencia: `${c.dataInicioVigencia || "?"} a ${c.dataFinalVigencia || "?"}`,
        link: linksPortal.convenio(c.id),
      }));
    return NextResponse.json({ itens, consultadoEm: r.consultadoEm, fonte: "API Portal da Transparência — /convenios", invalidos: r.invalidos });
  } catch (e) {
    const err = e as ErroPortal;
    const msg = err.tipo === "sem_token"
      ? "Consulta ao vivo desativada: o servidor ainda não tem o token da API do Portal da Transparência (variável PORTAL_TRANSPARENCIA_TOKEN)."
      : `Não foi possível consultar a API do Portal agora: ${err.message}`;
    return NextResponse.json({ erro: msg }, { status: err.tipo === "sem_token" ? 503 : 502 });
  }
}
