import { formatarBRL, formatarBRLCompacto, formatarPercentual } from "@/lib/dinheiro";
import { Ajuda } from "../ui";

/**
 * Compara orçamento → empenhado → liquidado → pago como etapas do MESMO gasto
 * (rampa ordinal azul, do mais claro ao mais escuro). Nunca soma as etapas.
 */
const ETAPAS = [
  { k: "atualizado", t: "Orçamento atualizado", cor: "#86b6ef", g: "orcamento-autorizado" },
  { k: "empenhado", t: "Empenhado", cor: "#5598e7", g: "empenho" },
  { k: "liquidado", t: "Liquidado", cor: "#256abf", g: "liquidacao" },
  { k: "pago", t: "Pago", cor: "#104281", g: "pagamento" },
] as const;

export function EstagiosExecucao({ v }: { v: Partial<Record<"atualizado" | "empenhado" | "liquidado" | "pago", number | null>> }) {
  const base = v.atualizado ?? v.empenhado ?? 0;
  const max = Math.max(...ETAPAS.map((e) => v[e.k] ?? 0), 1);
  return (
    <div className="space-y-2.5">
      {ETAPAS.map((e) => {
        const val = v[e.k];
        return (
          <div key={e.k}>
            <div className="flex items-baseline justify-between gap-2 text-[13px]">
              <span className="flex items-center gap-1.5 text-tinta-2">
                {e.t} <Ajuda id={e.g} />
              </span>
              <span className="num font-semibold" title={val == null ? undefined : formatarBRL(val)}>
                {val == null ? "não disponível" : formatarBRLCompacto(val)}
                {val != null && base > 0 && e.k !== "atualizado" && v.atualizado != null && (
                  <span className="ml-1.5 font-normal text-tinta-3">{formatarPercentual(val / base)} do orçamento</span>
                )}
              </span>
            </div>
            <div className="mt-1 h-2.5 rounded-full bg-plano" aria-hidden>
              {val != null && <div className="h-2.5 rounded-full" style={{ width: `${Math.max(0.5, (val / max) * 100)}%`, background: e.cor }} />}
            </div>
          </div>
        );
      })}
      <p className="text-[12px] text-tinta-3">São etapas do mesmo gasto: cada barra está contida na anterior. Não some os valores.</p>
    </div>
  );
}
