/**
 * Regras metodológicas verificadas na auditoria de out/2026. Funções puras, usadas pelo
 * exportador do site (scripts/exportar-modelo.ts) e cobertas por tests/auditoria.test.ts.
 */

/**
 * Natureza da despesa em relação à dívida pública, a partir da ação orçamentária e do
 * grupo de natureza de despesa (GND) publicados no arquivo de Execução da Despesa.
 *   1 = refinanciamento (rolagem): ações "Refinanciamento da Dívida Pública…" — pagamento de
 *       títulos que vencem com dinheiro de títulos novos. Não é prestação de serviço público.
 *   2 = demais despesas com a dívida: GND 2 (juros e encargos) e GND 6 (amortização) fora do refinanciamento.
 *   0 = demais despesas (pessoal, benefícios, custeio, investimentos, transferências…).
 * Nada é excluído do total: a classificação só permite mostrar as partes separadas.
 */
export function naturezaDivida(nomeAcao: string, codGrupo: string): 0 | 1 | 2 {
  const n = nomeAcao.normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase();
  if (/REFINANCIAMENTO DA DIVIDA/.test(n)) return 1;
  if (codGrupo === "2" || codGrupo === "6") return 2;
  return 0;
}

/**
 * Um arquivo mensal só está completo se foi baixado depois que o mês terminou.
 * Ex.: o arquivo de outubro/2026 baixado em 27/10/2026 traz só parte do mês.
 * `baixadoEm` é ISO (UTC); a virada do mês é considerada no horário de Brasília (UTC−3).
 */
export function mesCompleto(periodoAAAAMM: string, baixadoEm: string): boolean {
  const ano = Number(periodoAAAAMM.slice(0, 4)), mes = Number(periodoAAAAMM.slice(4, 6));
  if (!ano || !mes) return true;
  const fimDoMesBrasilia = Date.UTC(ano, mes, 1, 3, 0, 0); // 00:00 do dia 1º do mês seguinte em Brasília
  return new Date(baixadoEm).getTime() >= fimDoMesBrasilia;
}

/** Meses incompletos de um conjunto mensal, pela data de download de cada arquivo. */
export function mesesParciais(arquivos: { periodo: string; baixadoEm: string }[]): number[] {
  return arquivos.filter((a) => /^\d{6}$/.test(a.periodo) && !mesCompleto(a.periodo, a.baixadoEm)).map((a) => Number(a.periodo.slice(4))).sort((a, b) => a - b);
}

/**
 * Variação percentual segura: null quando a base é zero, ausente ou não finita
 * (nunca devolve NaN nem Infinity).
 */
export function variacao(atual: number | null | undefined, anterior: number | null | undefined): number | null {
  if (atual == null || anterior == null || !Number.isFinite(atual) || !Number.isFinite(anterior) || anterior === 0) return null;
  return (atual - anterior) / Math.abs(anterior);
}
