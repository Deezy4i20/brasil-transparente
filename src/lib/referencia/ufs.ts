/**
 * Tabela de referência das 27 unidades da federação.
 * - `cod`: código IBGE da UF.
 * - `populacao`: Censo Demográfico 2022 (IBGE), população residente recenseada.
 *   Total Brasil: 203.080.756.
 */
export type Regiao = "Norte" | "Nordeste" | "Centro-Oeste" | "Sudeste" | "Sul";

export interface UF {
  cod: number;
  sigla: string;
  nome: string;
  regiao: Regiao;
  populacao: number;
}

export const FONTE_POPULACAO = {
  nome: "IBGE — Censo Demográfico 2022, população residente",
  url: "https://censo2022.ibge.gov.br/panorama/",
  referencia: "2022",
};

export const UFS: UF[] = [
  { cod: 11, sigla: "RO", nome: "Rondônia", regiao: "Norte", populacao: 1_581_196 },
  { cod: 12, sigla: "AC", nome: "Acre", regiao: "Norte", populacao: 830_018 },
  { cod: 13, sigla: "AM", nome: "Amazonas", regiao: "Norte", populacao: 3_941_613 },
  { cod: 14, sigla: "RR", nome: "Roraima", regiao: "Norte", populacao: 636_707 },
  { cod: 15, sigla: "PA", nome: "Pará", regiao: "Norte", populacao: 8_120_131 },
  { cod: 16, sigla: "AP", nome: "Amapá", regiao: "Norte", populacao: 733_759 },
  { cod: 17, sigla: "TO", nome: "Tocantins", regiao: "Norte", populacao: 1_511_460 },
  { cod: 21, sigla: "MA", nome: "Maranhão", regiao: "Nordeste", populacao: 6_776_699 },
  { cod: 22, sigla: "PI", nome: "Piauí", regiao: "Nordeste", populacao: 3_271_199 },
  { cod: 23, sigla: "CE", nome: "Ceará", regiao: "Nordeste", populacao: 8_794_957 },
  { cod: 24, sigla: "RN", nome: "Rio Grande do Norte", regiao: "Nordeste", populacao: 3_302_729 },
  { cod: 25, sigla: "PB", nome: "Paraíba", regiao: "Nordeste", populacao: 3_974_687 },
  { cod: 26, sigla: "PE", nome: "Pernambuco", regiao: "Nordeste", populacao: 9_058_931 },
  { cod: 27, sigla: "AL", nome: "Alagoas", regiao: "Nordeste", populacao: 3_127_683 },
  { cod: 28, sigla: "SE", nome: "Sergipe", regiao: "Nordeste", populacao: 2_210_004 },
  { cod: 29, sigla: "BA", nome: "Bahia", regiao: "Nordeste", populacao: 14_141_626 },
  { cod: 31, sigla: "MG", nome: "Minas Gerais", regiao: "Sudeste", populacao: 20_539_989 },
  { cod: 32, sigla: "ES", nome: "Espírito Santo", regiao: "Sudeste", populacao: 3_833_712 },
  { cod: 33, sigla: "RJ", nome: "Rio de Janeiro", regiao: "Sudeste", populacao: 16_055_174 },
  { cod: 35, sigla: "SP", nome: "São Paulo", regiao: "Sudeste", populacao: 44_411_238 },
  { cod: 41, sigla: "PR", nome: "Paraná", regiao: "Sul", populacao: 11_444_380 },
  { cod: 42, sigla: "SC", nome: "Santa Catarina", regiao: "Sul", populacao: 7_610_361 },
  { cod: 43, sigla: "RS", nome: "Rio Grande do Sul", regiao: "Sul", populacao: 10_882_965 },
  { cod: 50, sigla: "MS", nome: "Mato Grosso do Sul", regiao: "Centro-Oeste", populacao: 2_757_013 },
  { cod: 51, sigla: "MT", nome: "Mato Grosso", regiao: "Centro-Oeste", populacao: 3_658_649 },
  { cod: 52, sigla: "GO", nome: "Goiás", regiao: "Centro-Oeste", populacao: 7_056_495 },
  { cod: 53, sigla: "DF", nome: "Distrito Federal", regiao: "Centro-Oeste", populacao: 2_817_381 },
];

export const REGIOES: Regiao[] = ["Norte", "Nordeste", "Centro-Oeste", "Sudeste", "Sul"];

const porSigla = new Map(UFS.map((u) => [u.sigla, u]));
const porCod = new Map(UFS.map((u) => [u.cod, u]));
const porNome = new Map(UFS.map((u) => [normalizarTexto(u.nome), u]));

export function normalizarTexto(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Resolve uma UF a partir de sigla, nome ou código IBGE. Retorna undefined se não for uma UF válida. */
export function resolverUF(v: string | number | null | undefined): UF | undefined {
  if (v === null || v === undefined) return undefined;
  if (typeof v === "number") return porCod.get(v);
  const t = v.trim();
  if (!t) return undefined;
  if (/^\d{2}$/.test(t)) return porCod.get(Number(t));
  return porSigla.get(t.toUpperCase()) ?? porNome.get(normalizarTexto(t));
}

export const POPULACAO_BRASIL = UFS.reduce((s, u) => s + u.populacao, 0);
