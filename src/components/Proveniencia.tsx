import { Info } from "lucide-react";
import type { Origem, Proveniencia as P } from "@/lib/dados/tipos";

const ROTULO_ORIGEM: Record<Origem, { texto: string; classe: string; dica: string }> = {
  oficial: { texto: "Dado oficial", classe: "border-marinho/30 bg-marinho-claro text-marinho", dica: "Valor publicado pela fonte oficial, apenas somado e filtrado." },
  calculado: { texto: "Calculado", classe: "border-azul-450/30 bg-[#eef5fd] text-azul-600", dica: "Derivado pela plataforma a partir de dados oficiais. A fórmula está na metodologia." },
  estimativa_fonte: { texto: "Estimativa da fonte", classe: "border-borda bg-plano text-tinta-2", dica: "Estimativa publicada pela própria fonte." },
  indisponivel: { texto: "Não disponível", classe: "border-borda bg-plano text-tinta-3", dica: "O dado não está disponível nesta versão ou neste recorte." },
  demonstracao: { texto: "Demonstração", classe: "border-[#fab219] bg-[#fff6e0] text-[#7a5200]", dica: "Valor FICTÍCIO usado apenas para desenvolvimento." },
};

export function SeloOrigem({ origem }: { origem: Origem }) {
  const r = ROTULO_ORIGEM[origem];
  return (
    <span title={r.dica} className={`inline-flex items-center rounded-full border px-2 py-[1px] text-[11px] font-semibold ${r.classe}`}>
      {r.texto}
    </span>
  );
}

function data(iso?: string) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" });
}

/** Bloco expansível “Fonte e metodologia” — presente em todo indicador, gráfico e tabela. */
export function Proveniencia({ p, compacto = false }: { p: P; compacto?: boolean }) {
  return (
    <details className="group text-[12.5px] text-tinta-2">
      <summary className="flex cursor-pointer list-none items-center gap-1.5 text-tinta-3 hover:text-tinta [&::-webkit-details-marker]:hidden">
        <Info aria-hidden className="h-3.5 w-3.5" />
        <span className="underline decoration-dotted underline-offset-2">{compacto ? "Fonte" : "Fonte e metodologia"}</span>
        <SeloOrigem origem={p.origem} />
      </summary>
      <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 rounded-md border border-borda bg-plano p-3">
        <dt className="font-semibold">Fonte</dt>
        <dd>{p.url ? <a className="link" href={p.url} target="_blank" rel="noreferrer">{p.fonte}</a> : p.fonte}</dd>
        <dt className="font-semibold">Período</dt>
        <dd>{p.periodo}</dd>
        <dt className="font-semibold">Atualizado</dt>
        <dd>{data(p.atualizadoEm)}</dd>
        <dt className="font-semibold">Cálculo</dt>
        <dd>{p.metodologia}</dd>
        {p.filtrosAplicados.length > 0 && (
          <>
            <dt className="font-semibold">Filtros</dt>
            <dd>{p.filtrosAplicados.join(", ")}</dd>
          </>
        )}
        {p.filtrosNaoAplicaveis.length > 0 && (
          <>
            <dt className="font-semibold text-serio">Não aplicável</dt>
            <dd>{p.filtrosNaoAplicaveis.join(", ")} — esta fonte não tem essa informação; o filtro foi ignorado aqui.</dd>
          </>
        )}
        {p.limitacoes.length > 0 && (
          <>
            <dt className="font-semibold">Limitações</dt>
            <dd>
              <ul className="list-disc space-y-0.5 pl-4">
                {p.limitacoes.map((l) => (
                  <li key={l}>{l}</li>
                ))}
              </ul>
            </dd>
          </>
        )}
      </dl>
    </details>
  );
}
