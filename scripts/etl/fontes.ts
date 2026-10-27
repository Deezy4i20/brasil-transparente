import type { ConjuntoETL } from "./processadores";

/**
 * Catálogo dos arquivos de dados abertos usados pelo ETL.
 * Página de downloads: https://portaldatransparencia.gov.br/download-de-dados
 */
export interface FonteArquivo {
  nome: string;
  slug: string;
  periodicidade: "anual" | "mensal" | "unico";
  pagina: string;
  dicionario: string;
  /** Nome do arquivo .zip gerado pelo Portal (parte após o período). */
  sufixoZip: string;
}

export const FONTES: Record<ConjuntoETL, FonteArquivo> = {
  orcamento: {
    nome: "Orçamento da Despesa — Portal da Transparência (CGU)",
    slug: "orcamento-despesa",
    periodicidade: "anual",
    pagina: "https://portaldatransparencia.gov.br/download-de-dados/orcamento-despesa",
    dicionario: "https://www.portaldatransparencia.gov.br/pagina-interna/603417-dicionario-de-dados-orcamento-da-despesa",
    sufixoZip: "OrcamentoDespesa",
  },
  execucao: {
    nome: "Execução da Despesa — Portal da Transparência (CGU)",
    slug: "despesas-execucao",
    periodicidade: "mensal",
    pagina: "https://portaldatransparencia.gov.br/download-de-dados/despesas-execucao",
    dicionario: "https://portaldatransparencia.gov.br/pagina-interna/603453-dicionario-de-dados-execucao-da-despesa",
    sufixoZip: "Despesas",
  },
  transferencias: {
    nome: "Recursos Transferidos — Portal da Transparência (CGU)",
    slug: "transferencias",
    periodicidade: "mensal",
    pagina: "https://portaldatransparencia.gov.br/download-de-dados/transferencias",
    dicionario: "https://www.portaldatransparencia.gov.br/pagina-interna/603420-dicionario-de-dados-recursos-transferidos",
    sufixoZip: "Transferencias",
  },
  emendas: {
    nome: "Emendas Parlamentares — Portal da Transparência (CGU)",
    slug: "emendas-parlamentares",
    periodicidade: "unico",
    pagina: "https://portaldatransparencia.gov.br/download-de-dados/emendas-parlamentares",
    dicionario: "https://portaldatransparencia.gov.br/pagina-interna/603482-dicionario-de-dados-emendas-parlamentares",
    sufixoZip: "EmendasParlamentares",
  },
};

/**
 * URLs candidatas para baixar um período. A primeira é a rota pública do Portal
 * (redireciona para o servidor de arquivos); a segunda é o endereço direto do
 * servidor de arquivos da CGU. Ambas são tentadas em ordem.
 */
export function urlsCandidatas(f: FonteArquivo, periodo: string): string[] {
  const base = `https://portaldatransparencia.gov.br/download-de-dados/${f.slug}/${periodo}`;
  const nomeZip = f.periodicidade === "unico" ? `${f.sufixoZip}.zip` : `${periodo}_${f.sufixoZip}.zip`;
  const direto = `https://dadosabertos-download.cgu.gov.br/PortalDaTransparencia/saida/${f.slug}/${nomeZip}`;
  return [base, direto];
}

export function periodos(f: FonteArquivo, ano: number, meses: number[]): string[] {
  if (f.periodicidade === "anual") return [String(ano)];
  if (f.periodicidade === "unico") return ["UNICO"];
  return meses.map((m) => `${ano}${String(m).padStart(2, "0")}`);
}
