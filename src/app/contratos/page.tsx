import type { Metadata } from "next";
import { AlertTriangle, Info } from "lucide-react";
import { EstadoVazio, TituloSecao } from "@/components/ui";
import { alertasContrato, DIAS_VENCIMENTO, LIMIAR_VARIACAO_VALOR } from "@/lib/alertas";
import { formatarBRL, formatarBRLCompacto } from "@/lib/dinheiro";
import { contexto, texto, type SearchParams } from "@/lib/pagina";
import { ErroPortal, tokenConfigurado } from "@/lib/portal/cliente";
import { contratosPorOrgao, linksPortal } from "@/lib/portal/endpoints";
import { MODO_DEMONSTRACAO } from "@/lib/dados/repositorio";

export const metadata: Metadata = { title: "Contratos" };
export const dynamic = "force-dynamic";

const dataValida = (s?: string) => (s && /^\d{2}\/\d{2}\/\d{4}$/.test(s) ? s : undefined);

export default async function PaginaContratos({ searchParams }: { searchParams: SearchParams }) {
  const { f, p, opcoes } = await contexto(searchParams);
  const orgao = texto(p, "codigoOrgao", 10);
  const orgaoValido = orgao && /^\d{5}$/.test(orgao) ? orgao : undefined;
  const di = dataValida(texto(p, "de")) ?? `01/01/${f.ano}`;
  const df = dataValida(texto(p, "ate")) ?? `31/12/${f.ano}`;
  const pagina = Math.max(1, Math.min(500, Number(texto(p, "pagina")) || 1));

  let resultado: Awaited<ReturnType<typeof contratosPorOrgao>> | null = null;
  let erro: string | null = null;
  if (orgaoValido) {
    try {
      resultado = await contratosPorOrgao(orgaoValido, di, df, pagina);
    } catch (e) {
      const x = e as ErroPortal;
      erro = x.tipo === "sem_token"
        ? "A consulta ao vivo está desativada: o servidor ainda não tem o token da API do Portal da Transparência (PORTAL_TRANSPARENCIA_TOKEN)."
        : `Não foi possível consultar a API agora: ${x.message}`;
    }
  }
  const unidades = opcoes.unidades.filter((u) => /^\d{5}$/.test(u.cod));

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-[22px] font-semibold">Contratos do Poder Executivo federal</h1>
        <p className="max-w-3xl text-[13.5px] text-tinta-2">
          Consulta ao vivo na API do Portal da Transparência, por órgão e período de vigência. Os alertas são informativos, mostram a regra e os dados que os geraram, e <b>não indicam irregularidade</b>.
        </p>
      </div>
      <section className="cartao p-4">
        <form action="/contratos" className="grid gap-3 sm:grid-cols-[minmax(0,2fr)_1fr_1fr_auto] sm:items-end">
          <input type="hidden" name="ano" value={f.ano} />
          <label className="text-[12.5px]">
            <span className="mb-1 block font-semibold text-tinta-2">Órgão (código SIAFI)</span>
            {unidades.length ? (
              <select className="campo" name="codigoOrgao" defaultValue={orgaoValido ?? ""} required>
                <option value="" disabled>Escolha um órgão…</option>
                {unidades.map((u) => <option key={u.cod} value={u.cod}>{u.nome} ({u.cod})</option>)}
              </select>
            ) : (
              <input className="campo" name="codigoOrgao" defaultValue={orgaoValido} placeholder="ex.: 26246" pattern="\d{5}" required />
            )}
          </label>
          <label className="text-[12.5px]">
            <span className="mb-1 block font-semibold text-tinta-2">Vigência de</span>
            <input className="campo" name="de" defaultValue={di} pattern="\d{2}/\d{2}/\d{4}" />
          </label>
          <label className="text-[12.5px]">
            <span className="mb-1 block font-semibold text-tinta-2">até</span>
            <input className="campo" name="ate" defaultValue={df} pattern="\d{2}/\d{2}/\d{4}" />
          </label>
          <button className="botao-primario justify-center" type="submit">Consultar</button>
        </form>
        {MODO_DEMONSTRACAO && <p className="mt-2 text-[12px] text-tinta-3">A lista de órgãos vem dos dados de demonstração; use um código SIAFI real para consultar a API.</p>}
        {!tokenConfigurado() && (
          <p className="mt-3 flex items-start gap-2 rounded-md bg-plano p-3 text-[13px] text-tinta-2">
            <Info aria-hidden className="mt-0.5 h-4 w-4 shrink-0" />
            O servidor ainda não tem o token da API (cadastro gratuito em portaldatransparencia.gov.br/api-de-dados). Sem ele, esta consulta não retorna dados.
          </p>
        )}
      </section>

      {erro && <EstadoVazio titulo="Consulta indisponível">{erro}</EstadoVazio>}
      {resultado && (
        <section className="cartao p-4">
          <TituloSecao
            titulo={`${resultado.itens.length} contrato(s) nesta página`}
            sub={`Órgão ${orgaoValido} · vigência entre ${di} e ${df} · consultado em ${new Date(resultado.consultadoEm).toLocaleString("pt-BR")}${resultado.doCache ? " (cache)" : ""}`}
          />
          {resultado.invalidos > 0 && <p className="mb-2 text-[12.5px] text-serio">{resultado.invalidos} registro(s) vieram em formato inesperado e foram omitidos.</p>}
          <ul className="space-y-3">
            {resultado.itens.map((c) => {
              const al = alertasContrato(c);
              return (
                <li key={c.id} className="rounded-md border border-borda p-3">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <a className="link font-semibold" href={linksPortal.contrato(c.id)} target="_blank" rel="noreferrer">Contrato {c.numero}</a>
                    <span className="num text-right">
                      <span className="font-semibold" title={formatarBRL(c.valorFinalCompra)}>{formatarBRLCompacto(c.valorFinalCompra)}</span>
                      <span className="block text-[11.5px] text-tinta-3">inicial {formatarBRLCompacto(c.valorInicialCompra)}</span>
                    </span>
                  </div>
                  <p className="mt-1 text-[13.5px]">{c.objeto || "Objeto não informado"}</p>
                  <dl className="mt-1.5 grid gap-x-4 gap-y-0.5 text-[12.5px] text-tinta-2 sm:grid-cols-2">
                    <div><dt className="inline text-tinta-3">Contratado: </dt><dd className="inline">{c.fornecedor?.nome || "—"} {c.fornecedor?.cnpjFormatado}</dd></div>
                    <div><dt className="inline text-tinta-3">Contratante: </dt><dd className="inline">{c.unidadeGestora?.nome || "—"}</dd></div>
                    <div><dt className="inline text-tinta-3">Vigência: </dt><dd className="inline">{c.dataInicioVigencia || "?"} a {c.dataFimVigencia || "?"}</dd></div>
                    <div><dt className="inline text-tinta-3">Modalidade: </dt><dd className="inline">{c.modalidadeCompra || "—"} · {c.situacaoContrato || "—"}</dd></div>
                  </dl>
                  {al.map((a) => (
                    <details key={a.id} className={`mt-2 rounded-md border p-2 text-[12.5px] ${a.nivel === "atencao" ? "border-[#ec835a]/50 bg-[#fdf1ec]" : "border-borda bg-plano"}`}>
                      <summary className="flex cursor-pointer items-center gap-1.5 font-semibold">
                        <AlertTriangle aria-hidden className="h-3.5 w-3.5" /> {a.titulo} <span className="font-normal text-tinta-3">(alerta informativo — ver regra)</span>
                      </summary>
                      <p className="mt-1"><b>Regra:</b> {a.regra}</p>
                      <p><b>Dados:</b> {a.dados}</p>
                      <p><b>Contexto:</b> {a.explicacao}</p>
                    </details>
                  ))}
                </li>
              );
            })}
          </ul>
          <p className="mt-3 text-[12px] text-tinta-3">
            Fonte: API do Portal da Transparência, endpoint /contratos. Regras de alerta: vigência terminando em até {DIAS_VENCIMENTO} dias; diferença entre valor final e inicial acima de {LIMIAR_VARIACAO_VALOR * 100}%.
          </p>
        </section>
      )}
    </div>
  );
}
