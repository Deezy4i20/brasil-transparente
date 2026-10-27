/**
 * Alertas informativos para contratos. Cada alerta traz a regra que o gerou,
 * os dados usados e uma explicação. Alertas NÃO indicam irregularidade.
 */
export interface Alerta {
  id: string;
  nivel: "informativo" | "atencao";
  titulo: string;
  regra: string;
  dados: string;
  explicacao: string;
}

export const LIMIAR_VARIACAO_VALOR = 0.25;
export const DIAS_VENCIMENTO = 90;

/** Converte "DD/MM/AAAA" ou "AAAA-MM-DD" em Date (UTC). */
export function lerData(s: string | null | undefined): Date | null {
  if (!s) return null;
  let m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (m) return new Date(Date.UTC(+m[3], +m[2] - 1, +m[1]));
  m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  return null;
}

export function alertasContrato(
  c: { valorInicialCompra: number | null; valorFinalCompra: number | null; dataFimVigencia: string; dataInicioVigencia?: string },
  hoje: Date = new Date(),
): Alerta[] {
  const out: Alerta[] = [];
  const fim = lerData(c.dataFimVigencia);
  if (fim) {
    const dias = Math.ceil((fim.getTime() - hoje.getTime()) / 86_400_000);
    if (dias >= 0 && dias <= DIAS_VENCIMENTO)
      out.push({
        id: "vencimento",
        nivel: "informativo",
        titulo: `Vigência termina em ${dias} dia(s)`,
        regra: `Fim da vigência nos próximos ${DIAS_VENCIMENTO} dias.`,
        dados: `Fim da vigência: ${c.dataFimVigencia}.`,
        explicacao: "Contratos próximos do fim podem ser prorrogados, encerrados ou substituídos. É apenas um lembrete de acompanhamento.",
      });
  }
  const ini = c.valorInicialCompra;
  const fin = c.valorFinalCompra;
  if (ini && ini > 0 && fin !== null) {
    const v = fin / ini - 1;
    if (Math.abs(v) > LIMIAR_VARIACAO_VALOR)
      out.push({
        id: "variacao-valor",
        nivel: "atencao",
        titulo: `Valor atual ${v > 0 ? "acima" : "abaixo"} do inicial em ${(Math.abs(v) * 100).toFixed(0)}%`,
        regra: `|valor final ÷ valor inicial − 1| > ${LIMIAR_VARIACAO_VALOR * 100}%.`,
        dados: `Valor inicial: ${ini.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}; valor final: ${fin.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}.`,
        explicacao:
          "Diferenças grandes costumam vir de prorrogações de prazo (que somam novos períodos ao valor), reajustes ou aditivos de escopo. A Lei 14.133/2021 (art. 125) limita acréscimos de objeto a 25% em regra, mas prorrogações não entram nesse limite. Confira os termos aditivos no Portal.",
      });
  }
  return out;
}
