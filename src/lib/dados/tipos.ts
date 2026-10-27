/**
 * Formato dos conjuntos pré-agregados produzidos pelo ETL (scripts/etl) e
 * lidos pela aplicação. Também é o formato dos dados de demonstração.
 *
 * Um "cubo" é uma tabela agregada, codificada em colunas com dicionários:
 * cada linha = [índices das dimensões..., valores das medidas...].
 * Os índices apontam para `dicionarios[dimensao]`, que preserva o código
 * oficial e o nome publicados pela fonte.
 */

export type Origem =
  | "oficial" // valor publicado pela fonte, apenas somado/filtrado
  | "calculado" // derivado pela plataforma a partir de dados oficiais (ex.: saldo, per capita)
  | "estimativa_fonte" // estimativa publicada pela própria fonte
  | "indisponivel" // dado não disponível
  | "demonstracao"; // dado fictício para desenvolvimento — NUNCA exibido como oficial

export interface ItemDicionario {
  cod: string;
  nome: string;
  /** Campos extras opcionais (ex.: linguagem cidadã de uma ação, UF de um município). */
  extra?: Record<string, string>;
}

export type NomeConjunto =
  | "orcamento"
  | "execucao"
  | "execucao_municipios"
  | "transferencias"
  | "transferencias_municipios"
  | "transferencias_favorecidos"
  | "emendas";

export interface Cubo {
  versao: 1;
  conjunto: NomeConjunto;
  ano: number;
  /** Dimensões, na ordem em que aparecem em cada linha. "mes" usa o próprio número (1–12), sem dicionário. */
  dimensoes: string[];
  medidas: string[];
  dicionarios: Record<string, ItemDicionario[]>;
  linhas: number[][];
}

export interface ArquivoProcessado {
  nome: string;
  url: string | null;
  periodo: string;
  baixadoEm: string;
  bytes: number;
  linhasLidas: number;
  linhasDescartadas: number;
  motivosDescarte: Record<string, number>;
}

export interface ManifestoConjunto {
  conjunto: NomeConjunto;
  ano: number;
  origem: "oficial" | "demonstracao";
  fonte: { nome: string; url: string; dicionario?: string };
  arquivos: ArquivoProcessado[];
  /** Meses com dados (para conjuntos mensais). */
  mesesDisponiveis: number[];
  processadoEm: string;
  avisos: string[];
  linhasAgregadas: number;
}

export interface Manifesto {
  geradoEm: string;
  modo: "oficial" | "demonstracao";
  conjuntos: ManifestoConjunto[];
}

/** Metadados de proveniência que acompanham todo número exibido na interface. */
export interface Proveniencia {
  origem: Origem;
  fonte: string;
  url?: string;
  periodo: string;
  atualizadoEm?: string;
  metodologia: string;
  filtrosAplicados: string[];
  filtrosNaoAplicaveis: string[];
  limitacoes: string[];
}

export interface ValorRastreavel {
  valor: number | null;
  proveniencia: Proveniencia;
}
