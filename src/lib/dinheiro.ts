/**
 * Conversão e formatação de valores monetários.
 * O Portal da Transparência publica valores no formato brasileiro ("1.234.567,89"),
 * às vezes com sinal, espaços, "R$" ou como número JSON. Esta função aceita todos.
 */
export function parseValorBR(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v !== "string") return null;
  let s = v.trim().replace(/R\$\s?/i, "").replace(/\s/g, "");
  if (!s || s === "-" || s.toLowerCase() === "null") return null;
  let negativo = false;
  if (s.startsWith("(") && s.endsWith(")")) {
    negativo = true;
    s = s.slice(1, -1);
  }
  if (s.startsWith("-")) {
    negativo = !negativo;
    s = s.slice(1);
  }
  if (s.includes(",")) {
    // formato BR: pontos são milhar, vírgula é decimal
    s = s.replace(/\./g, "").replace(",", ".");
  } else if (/^\d{1,3}(\.\d{3})+$/.test(s)) {
    // "1.234.567" sem decimais — pontos de milhar
    s = s.replace(/\./g, "");
  }
  if (!/^\d+(\.\d+)?$/.test(s)) return null;
  const n = Number(s);
  return Number.isFinite(n) ? (negativo ? -n : n) : null;
}

const fmtCompleto = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2 });
const fmtNum = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1, minimumFractionDigits: 0 });
const fmtInt = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 });

export function formatarBRL(v: number | null | undefined): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return "—";
  return fmtCompleto.format(v);
}

/** "R$ 1,2 tri", "R$ 345,6 bi", "R$ 12,3 mi", "R$ 45,2 mil" */
export function formatarBRLCompacto(v: number | null | undefined): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return "—";
  const a = Math.abs(v);
  const sinal = v < 0 ? "−" : "";
  if (a >= 1e12) return `${sinal}R$ ${fmtNum.format(a / 1e12)} tri`;
  if (a >= 1e9) return `${sinal}R$ ${fmtNum.format(a / 1e9)} bi`;
  if (a >= 1e6) return `${sinal}R$ ${fmtNum.format(a / 1e6)} mi`;
  if (a >= 1e3) return `${sinal}R$ ${fmtNum.format(a / 1e3)} mil`;
  return `${sinal}R$ ${fmtNum.format(a)}`;
}

export function formatarInteiro(v: number | null | undefined): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return "—";
  return fmtInt.format(v);
}

export function formatarPercentual(v: number | null | undefined, casas = 1): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return "—";
  return `${new Intl.NumberFormat("pt-BR", { maximumFractionDigits: casas, minimumFractionDigits: casas }).format(v * 100)}%`;
}

/** Variação relativa; null quando a base é zero ou ausente (não comparável). */
export function variacao(atual: number | null | undefined, anterior: number | null | undefined): number | null {
  if (atual === null || atual === undefined || anterior === null || anterior === undefined) return null;
  if (anterior === 0) return null;
  return (atual - anterior) / Math.abs(anterior);
}

/** Soma em centavos inteiros para evitar erro acumulado de ponto flutuante. */
export function somar(valores: Iterable<number>): number {
  let c = 0;
  for (const v of valores) c += Math.round(v * 100);
  return c / 100;
}
