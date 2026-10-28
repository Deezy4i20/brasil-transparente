/**
 * Processadores dos arquivos de dados abertos do Portal da Transparência.
 * Cada processador:
 *  - declara as colunas que usa, pelos nomes do dicionário de dados oficial;
 *  - valida o cabeçalho (falha com a lista de colunas encontradas se faltar alguma);
 *  - converte cada linha em contribuições para um ou mais cubos;
 *  - conta linhas descartadas por motivo (nada é descartado em silêncio).
 */
import type { ItemDicionario, NomeConjunto } from "../../src/lib/dados/tipos";
import { parseValorBR } from "../../src/lib/dinheiro";
import { resolverUF } from "../../src/lib/referencia/ufs";
import { ConstrutorCubo } from "./cubo";
import { extrairAno, extrairMes, type Linha } from "./csv";
import { localizarMunicipio, type IndiceMunicipios } from "./municipios";

type MapaColunas = Record<string, string[]>; // chave lógica → nomes normalizados aceitos

export const UF_NI: ItemDicionario = { cod: "NI", nome: "Localização não identificada" };

export abstract class Processador {
  abstract readonly conjunto: "orcamento" | "execucao" | "transferencias" | "emendas";
  abstract readonly obrigatorias: MapaColunas;
  readonly opcionais: MapaColunas = {};
  protected col: Record<string, string> = {};
  descartes: Record<string, number> = {};
  lidas = 0;
  /** Valores originais de localidade que não puderam ser associados a uma UF, com contagem. */
  locaisNaoIdentificados: Record<string, number> = {};
  municipiosSemCorrespondencia = 0;

  constructor(
    readonly ano: number,
    protected readonly municipios: IndiceMunicipios,
  ) {}

  /** Retorna true se este arquivo (pelo cabeçalho) é o que o processador espera. */
  reconhece(colunas: string[]): boolean {
    const s = new Set(colunas);
    return Object.values(this.obrigatorias).every((alts) => alts.some((a) => s.has(a)));
  }

  configurar(colunas: string[]): void {
    const s = new Set(colunas);
    const faltando: string[] = [];
    this.col = {};
    for (const [k, alts] of Object.entries(this.obrigatorias)) {
      const achou = alts.find((a) => s.has(a));
      if (achou) this.col[k] = achou;
      else faltando.push(`${k} (${alts.join(" | ")})`);
    }
    for (const [k, alts] of Object.entries(this.opcionais)) {
      const achou = alts.find((a) => s.has(a));
      if (achou) this.col[k] = achou;
    }
    if (faltando.length)
      throw new Error(
        `[${this.conjunto}] Colunas obrigatórias ausentes: ${faltando.join(", ")}.\nColunas encontradas: ${colunas.join(", ")}`,
      );
  }

  protected v(l: Linha, k: string): string {
    const c = this.col[k];
    return c ? (l[c] ?? "").trim() : "";
  }

  protected item(l: Linha, cod: string, nome: string): ItemDicionario {
    const c = this.v(l, cod);
    const n = this.v(l, nome);
    return { cod: c || "SEM_CODIGO", nome: n || c || "Não informado" };
  }

  protected valor(l: Linha, k: string): number | null {
    return parseValorBR(this.v(l, k));
  }

  protected descartar(motivo: string): void {
    this.descartes[motivo] = (this.descartes[motivo] ?? 0) + 1;
  }

  protected uf(valor: string): ItemDicionario {
    const u = resolverUF(valor);
    if (u) return { cod: u.sigla, nome: u.nome };
    const chave = valor || "(vazio)";
    this.locaisNaoIdentificados[chave] = (this.locaisNaoIdentificados[chave] ?? 0) + 1;
    return UF_NI;
  }

  protected municipio(uf: ItemDicionario, nome: string): ItemDicionario {
    if (uf.cod === "NI" || !nome) return { cod: `NI:${uf.cod}`, nome: "Município não identificado", extra: { uf: uf.cod } };
    const m = localizarMunicipio(this.municipios, uf.cod, nome);
    if (m.correspondencia === "sem_correspondencia") this.municipiosSemCorrespondencia++;
    return { cod: m.cod, nome: m.nome, extra: { uf: uf.cod, correspondencia: m.correspondencia } };
  }

  abstract processar(l: Linha): void;
  abstract cubos(): ConstrutorCubo[];
}

/* ---------------------------------------------------------------- Orçamento da despesa (anual) */
export class ProcessadorOrcamento extends Processador {
  readonly conjunto = "orcamento" as const;
  readonly obrigatorias = {
    exercicio: ["exercicio"],
    codOS: ["codigoorgaosuperior"],
    nomeOS: ["nomeorgaosuperior"],
    codOrgao: ["codigoorgaosubordinado"],
    nomeOrgao: ["nomeorgaosubordinado"],
    codFuncao: ["codigofuncao"],
    nomeFuncao: ["nomefuncao"],
    codPrograma: ["codigoprogramaorcamentario", "codigoprograma"],
    nomePrograma: ["nomeprogramaorcamentario", "nomeprograma"],
    codAcao: ["codigoacao"],
    nomeAcao: ["nomeacao"],
    codGrupo: ["codigogrupodedespesa", "codigogrupodespesa"],
    nomeGrupo: ["nomegrupodedespesa", "nomegrupodespesa", "grupodedespesa"],
    inicial: ["orcamentoinicial"],
    atualizado: ["orcamentoatualizado"],
    empenhado: ["orcamentoempenhado"],
    realizado: ["orcamentorealizado"],
  };
  private cubo = new ConstrutorCubo("orcamento", this.ano,
    ["orgaoSuperior", "orgao", "funcao", "programa", "acao", "grupo"],
    ["inicial", "atualizado", "empenhado", "realizado"]);

  processar(l: Linha): void {
    this.lidas++;
    if (extrairAno(this.v(l, "exercicio")) !== this.ano) return this.descartar("exercício diferente do solicitado");
    const vals = ["inicial", "atualizado", "empenhado", "realizado"].map((k) => this.valor(l, k));
    if (vals.some((v) => v === null)) return this.descartar("valor monetário inválido");
    this.cubo.adicionar(
      {
        orgaoSuperior: this.item(l, "codOS", "nomeOS"),
        orgao: this.item(l, "codOrgao", "nomeOrgao"),
        funcao: this.item(l, "codFuncao", "nomeFuncao"),
        programa: this.item(l, "codPrograma", "nomePrograma"),
        acao: this.item(l, "codAcao", "nomeAcao"),
        grupo: this.item(l, "codGrupo", "nomeGrupo"),
      },
      vals as number[],
    );
  }
  cubos() {
    return [this.cubo];
  }
}

/* ---------------------------------------------------------------- Execução da despesa (mensal) */
export class ProcessadorExecucao extends Processador {
  readonly conjunto = "execucao" as const;
  readonly obrigatorias = {
    anoMes: ["anoemesdolancamento", "anomesdolancamento", "anomes"],
    codOS: ["codigoorgaosuperior"],
    nomeOS: ["nomeorgaosuperior"],
    codOrgao: ["codigoorgaosubordinado"],
    nomeOrgao: ["nomeorgaosubordinado"],
    codFuncao: ["codigofuncao"],
    nomeFuncao: ["nomefuncao"],
    codPrograma: ["codigoprogramaorcamentario"],
    nomePrograma: ["nomeprogramaorcamentario"],
    codAcao: ["codigoacao"],
    nomeAcao: ["nomeacao"],
    codGrupo: ["codigogrupodedespesa"],
    nomeGrupo: ["nomegrupodedespesa"],
    uf: ["uf"],
    municipio: ["municipio"],
    empenhado: ["valorempenhado"],
    liquidado: ["valorliquidado"],
    pago: ["valorpago"],
    rapInscrito: ["valorrestosapagarinscritos"],
    rapCancelado: ["valorrestosapagarcancelado", "valorrestosapagarcancelados"],
    rapPago: ["valorrestosapagarpagos"],
  };
  private cubo = new ConstrutorCubo("execucao", this.ano,
    ["mes", "orgaoSuperior", "orgao", "funcao", "programa", "acao", "grupo", "uf"],
    ["empenhado", "liquidado", "pago", "rapInscrito", "rapCancelado", "rapPago"]);
  private cuboMun = new ConstrutorCubo("execucao_municipios", this.ano,
    ["mes", "uf", "municipio", "funcao"], ["empenhado", "liquidado", "pago"]);

  processar(l: Linha): void {
    this.lidas++;
    const am = this.v(l, "anoMes");
    if (extrairAno(am) !== this.ano) return this.descartar("ano diferente do solicitado");
    const mes = extrairMes(am);
    if (!mes) return this.descartar("mês inválido");
    const vals = ["empenhado", "liquidado", "pago", "rapInscrito", "rapCancelado", "rapPago"].map((k) => this.valor(l, k) ?? 0);
    const uf = this.uf(this.v(l, "uf"));
    const funcao = this.item(l, "codFuncao", "nomeFuncao");
    this.cubo.adicionar(
      {
        mes,
        orgaoSuperior: this.item(l, "codOS", "nomeOS"),
        orgao: this.item(l, "codOrgao", "nomeOrgao"),
        funcao,
        programa: this.item(l, "codPrograma", "nomePrograma"),
        acao: this.item(l, "codAcao", "nomeAcao"),
        grupo: this.item(l, "codGrupo", "nomeGrupo"),
        uf,
      },
      vals,
    );
    const nomeMun = this.v(l, "municipio");
    if (uf.cod !== "NI" && nomeMun) {
      this.cuboMun.adicionar({ mes, uf, municipio: this.municipio(uf, nomeMun), funcao }, vals.slice(0, 3));
    }
  }
  cubos() {
    return [this.cubo, this.cuboMun];
  }
}

/* ---------------------------------------------------------------- Recursos transferidos (mensal) */
const TIPOS_PESSOA_FISICA = /pessoa\s*f[ií]sica|cidad[aã]o/i;

export class ProcessadorTransferencias extends Processador {
  readonly conjunto = "transferencias" as const;
  readonly obrigatorias = {
    anoMes: ["anomes"],
    tipo: ["tipotransferencia"],
    tipoFav: ["tipofavorecido"],
    uf: ["uf"],
    codMunSiafi: ["codigomunicipiosiafi"],
    nomeMun: ["nomemunicipio"],
    codOrgao: ["codigoorgaosiafi", "codigoorgao"],
    nomeOrgao: ["nomeorgao"],
    codFuncao: ["codigofuncao"],
    nomeFuncao: ["nomefuncao"],
    codPrograma: ["codigoprograma"],
    nomePrograma: ["nomeprograma"],
    codAcao: ["codigoacao", "acao"], // o arquivo real usa "AÇÃO" para o código
    nomeAcao: ["nomeacao"],
    codFav: ["codigofavorecido"],
    nomeFav: ["nomefavorecido"],
    valor: ["valortransferido"],
  };
  readonly opcionais = { linguagemCidada: ["linguagemcidada"] };
  private cubo = new ConstrutorCubo("transferencias", this.ano,
    ["mes", "tipo", "orgao", "funcao", "programa", "acao", "uf"], ["valor"]);
  private cuboMun = new ConstrutorCubo("transferencias_municipios", this.ano,
    ["mes", "uf", "municipio", "funcao", "tipo"], ["valor"]);
  private cuboFav = new ConstrutorCubo("transferencias_favorecidos", this.ano,
    ["uf", "favorecido", "tipoFavorecido"], ["valor"]);
  favorecidosPFOmitidos = 0;

  processar(l: Linha): void {
    this.lidas++;
    const am = this.v(l, "anoMes");
    if (extrairAno(am) !== this.ano) return this.descartar("ano diferente do solicitado");
    const mes = extrairMes(am);
    if (!mes) return this.descartar("mês inválido");
    const valor = this.valor(l, "valor");
    if (valor === null) return this.descartar("valor monetário inválido");
    const uf = this.uf(this.v(l, "uf"));
    const tipo = { cod: this.v(l, "tipo") || "Não informado", nome: this.v(l, "tipo") || "Não informado" };
    const funcao = this.item(l, "codFuncao", "nomeFuncao");
    const acao = this.item(l, "codAcao", "nomeAcao");
    const lc = this.v(l, "linguagemCidada");
    if (lc) acao.extra = { linguagemCidada: lc };
    this.cubo.adicionar(
      { mes, tipo, orgao: this.item(l, "codOrgao", "nomeOrgao"), funcao, programa: this.item(l, "codPrograma", "nomePrograma"), acao, uf },
      [valor],
    );
    const nomeMun = this.v(l, "nomeMun");
    const mun = this.municipio(uf, nomeMun);
    const siafi = this.v(l, "codMunSiafi");
    if (siafi) mun.extra = { ...mun.extra, siafi };
    this.cuboMun.adicionar({ mes, uf, municipio: mun, funcao, tipo }, [valor]);

    // Favorecidos: pessoas físicas não são listadas individualmente (privacidade);
    // seus valores permanecem nos totais acima.
    const tipoFav = this.v(l, "tipoFav");
    if (TIPOS_PESSOA_FISICA.test(tipoFav)) {
      this.favorecidosPFOmitidos++;
      return;
    }
    this.cuboFav.adicionar(
      { uf, favorecido: this.item(l, "codFav", "nomeFav"), tipoFavorecido: { cod: tipoFav || "Não informado", nome: tipoFav || "Não informado" } },
      [valor],
    );
  }
  cubos() {
    return [this.cubo, this.cuboMun, this.cuboFav];
  }
}

/* ---------------------------------------------------------------- Emendas parlamentares (arquivo único) */
export class ProcessadorEmendas extends Processador {
  readonly conjunto = "emendas" as const;
  readonly obrigatorias = {
    codigo: ["codigodaemenda"],
    ano: ["anodaemenda"],
    tipo: ["tipodaemenda", "tipodeemenda"],
    codAutor: ["codigodoautordaemenda"],
    nomeAutor: ["nomedoautordaemenda"],
    numero: ["numerodaemenda"],
    localidade: ["localidadedogasto", "localidadedeaplicacaodorecurso"],
    codMun: ["codigomunicipioibge"],
    nomeMun: ["municipio"],
    uf: ["uf"],
    codFuncao: ["codigofuncao"],
    nomeFuncao: ["nomefuncao"],
    codPrograma: ["codigoprograma"],
    nomePrograma: ["nomeprograma"],
    codAcao: ["codigoacao"],
    nomeAcao: ["nomeacao"],
    empenhado: ["valorempenhado"],
    liquidado: ["valorliquidado"],
    pago: ["valorpago"],
    rapInscrito: ["valorrestosapagarinscritos"],
    rapCancelado: ["valorrestosapagarcancelados", "valorrestosapagarcancelado"],
    rapPago: ["valorrestosapagarpagos"],
  };
  private cubo = new ConstrutorCubo("emendas", this.ano,
    ["emenda", "autor", "tipo", "uf", "municipio", "funcao", "programa", "acao"],
    ["empenhado", "liquidado", "pago", "rapInscrito", "rapCancelado", "rapPago"]);

  /** Autor de cada emenda (todas as emendas do arquivo, de qualquer ano): código → [autor, tipo, ano]. */
  autores = new Map<string, [string, string, string]>();
  /** Ligação emenda → convênio (arquivo EmendasParlamentares_Convenios): nº convênio → códigos de emenda. */
  vinculos = new Map<string, Set<string>>();
  private colVinc: { codigo: string; convenio: string } | null = null;

  reconheceVinculo(cols: string[]): boolean {
    const s = new Set(cols);
    if (s.has("codigodaemenda") && s.has("numeroconvenio")) {
      this.colVinc = { codigo: "codigodaemenda", convenio: "numeroconvenio" };
      return true;
    }
    return false;
  }

  processarVinculo(l: Linha): void {
    const cod = (l[this.colVinc!.codigo] ?? "").trim();
    const conv = (l[this.colVinc!.convenio] ?? "").trim();
    if (!cod || !conv) return;
    let s = this.vinculos.get(conv);
    if (!s) this.vinculos.set(conv, (s = new Set()));
    s.add(cod);
  }

  /** nº convênio → [[código da emenda, autor, tipo, ano]] — só ligações com autor conhecido. */
  vinculosComAutor(): Record<string, [string, string, string, string][]> {
    const out: Record<string, [string, string, string, string][]> = {};
    for (const [conv, cods] of this.vinculos) {
      const l = [...cods].map((c) => [c, ...(this.autores.get(c) ?? ["", "", ""])] as [string, string, string, string]).filter((x) => x[1] && !/sem informa/i.test(x[1]));
      if (l.length) out[conv] = l;
    }
    return out;
  }

  processar(l: Linha): void {
    this.lidas++;
    const codTodos = this.v(l, "codigo");
    if (codTodos && !this.autores.has(codTodos)) this.autores.set(codTodos, [this.v(l, "nomeAutor"), this.v(l, "tipo"), this.v(l, "ano")]);
    if (extrairAno(this.v(l, "ano")) !== this.ano) return this.descartar("ano da emenda diferente do solicitado");
    const codigo = this.v(l, "codigo");
    if (!codigo) return this.descartar("emenda sem código");
    const vals = ["empenhado", "liquidado", "pago", "rapInscrito", "rapCancelado", "rapPago"].map((k) => this.valor(l, k) ?? 0);
    const ufTxt = this.v(l, "uf");
    const uf = this.uf(ufTxt);
    const codMun = this.v(l, "codMun");
    const municipio: ItemDicionario =
      codMun && /^\d{7}$/.test(codMun)
        ? { cod: codMun, nome: this.v(l, "nomeMun") || codMun, extra: { uf: uf.cod, correspondencia: "codigo_ibge" } }
        : { cod: `NI:${uf.cod}`, nome: "Município não identificado", extra: { uf: uf.cod } };
    this.cubo.adicionar(
      {
        emenda: {
          cod: codigo,
          nome: this.v(l, "numero") || codigo,
          extra: { localidade: this.v(l, "localidade") },
        },
        autor: this.item(l, "codAutor", "nomeAutor"),
        tipo: { cod: this.v(l, "tipo") || "Não informado", nome: this.v(l, "tipo") || "Não informado" },
        uf,
        municipio,
        funcao: this.item(l, "codFuncao", "nomeFuncao"),
        programa: this.item(l, "codPrograma", "nomePrograma"),
        acao: this.item(l, "codAcao", "nomeAcao"),
      },
      vals,
    );
  }
  cubos() {
    return [this.cubo];
  }
}

export const CONJUNTOS_ETL = ["orcamento", "execucao", "transferencias", "emendas"] as const;
export type ConjuntoETL = (typeof CONJUNTOS_ETL)[number];

export function criarProcessador(c: ConjuntoETL, ano: number, mun: IndiceMunicipios): Processador {
  switch (c) {
    case "orcamento":
      return new ProcessadorOrcamento(ano, mun);
    case "execucao":
      return new ProcessadorExecucao(ano, mun);
    case "transferencias":
      return new ProcessadorTransferencias(ano, mun);
    case "emendas":
      return new ProcessadorEmendas(ano, mun);
  }
}

export type { NomeConjunto };
