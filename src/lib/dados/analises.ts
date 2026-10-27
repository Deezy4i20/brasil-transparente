import "server-only";
/**
 * Análises usadas pelas páginas: indicadores, território, estado, rankings e busca.
 * Toda saída numérica carrega proveniência (fonte, período, metodologia, filtros, limitações).
 */
import { consultar, item, topN, type Grupo } from "./consulta";
import { anosDisponiveis, cubo, infoConjunto, manifesto, MODO_DEMONSTRACAO } from "./repositorio";
import type { Cubo, ItemDicionario, NomeConjunto, Origem, Proveniencia, ValorRastreavel } from "./tipos";
import { descreverPeriodo, filtrosDeCubo, METRICAS, mesAbrev, ROTULO_FILTRO, type Filtros, type Metrica } from "../filtros";
import { POPULACAO_BRASIL, UFS, resolverUF, normalizarTexto } from "../referencia/ufs";
import { variacao } from "../dinheiro";

/* ------------------------------------------------------------------ utilidades */

function origemDe(o: Origem): Origem {
  return MODO_DEMONSTRACAO ? "demonstracao" : o;
}

function nomesFiltros(dims: string[]): string[] {
  return [...new Set(dims.map((d) => ROTULO_FILTRO[d] ?? d))];
}

function prov(
  conjunto: NomeConjunto,
  f: Filtros,
  periodo: string,
  metodologia: string,
  r: { filtrosAplicados: string[]; filtrosNaoAplicaveis: string[] } | null,
  limitacoes: string[] = [],
  origem: Origem = "oficial",
): Proveniencia {
  const base = conjunto.replace(/_municipios|_favorecidos/, "");
  const info = infoConjunto(base, f.ano);
  return {
    origem: origemDe(origem),
    fonte: info?.fonte.nome ?? "Portal da Transparência (CGU)",
    url: info?.fonte.url,
    periodo,
    atualizadoEm: info?.processadoEm,
    metodologia,
    filtrosAplicados: r ? nomesFiltros(r.filtrosAplicados) : [],
    filtrosNaoAplicaveis: r ? nomesFiltros(r.filtrosNaoAplicaveis) : [],
    limitacoes: [...limitacoes, ...(info?.avisos ?? [])],
  };
}

/** Intervalo de meses efetivamente coberto: interseção do filtro com os meses disponíveis. */
export function mesesEfetivos(f: Filtros, conjunto: NomeConjunto, ano = f.ano): [number, number] | null {
  const base = conjunto.replace(/_municipios|_favorecidos/, "");
  const info = infoConjunto(base, ano);
  const disp = info?.mesesDisponiveis ?? [];
  if (!disp.length) return f.meses;
  const ini = Math.max(f.meses[0], Math.min(...disp));
  const fim = Math.min(f.meses[1], Math.max(...disp));
  return ini <= fim ? [ini, fim] : null;
}

function periodoTexto(f: Filtros, m: [number, number] | null): string {
  if (!m) return `${f.ano} (sem dados no período)`;
  return descreverPeriodo({ ...f, meses: m });
}

const temFiltroTerritorial = (f: Filtros) => Boolean(f.uf || f.regiao);

/* ------------------------------------------------------------------ indicadores principais */

export interface Indicador {
  id: string;
  titulo: string;
  explicacao: string;
  atual: ValorRastreavel;
  anterior: number | null;
  variacao: number | null;
  tipo: "moeda" | "inteiro";
  detalhe?: string; // rota para o detalhamento
  glossario?: string; // termo do glossário
}

function indisponivel(motivo: string, f: Filtros, fonte = "—"): ValorRastreavel {
  return {
    valor: null,
    proveniencia: {
      origem: "indisponivel",
      fonte,
      periodo: descreverPeriodo(f),
      metodologia: motivo,
      filtrosAplicados: [],
      filtrosNaoAplicaveis: [],
      limitacoes: [],
    },
  };
}

export function indicadores(f: Filtros): Indicador[] {
  const fc = filtrosDeCubo(f);
  const out: Indicador[] = [];
  const orc = cubo("orcamento", f.ano);
  const orcAnt = cubo("orcamento", f.ano - 1);
  const exe = cubo("execucao", f.ano);
  const exeAnt = cubo("execucao", f.ano - 1);
  const tra = cubo("transferencias", f.ano);
  const traAnt = cubo("transferencias", f.ano - 1);

  // 1 e 5 — Orçamento atualizado e saldo (fonte: Orçamento da Despesa, anual)
  if (orc && !temFiltroTerritorial(f)) {
    const r = consultar(orc, { filtros: fc });
    const rA = orcAnt ? consultar(orcAnt, { filtros: fc }) : null;
    const lim = ["O orçamento é anual: o filtro de meses não se aplica a este indicador."];
    out.push({
      id: "orcamento",
      titulo: "Orçamento atualizado",
      explicacao: "Limite de gastos autorizado para o ano, já com os ajustes feitos ao longo do exercício. Não é dinheiro gasto.",
      atual: {
        valor: r.total.atualizado,
        proveniencia: prov("orcamento", f, String(f.ano), "Soma da coluna “Orçamento Atualizado (R$)” do arquivo Orçamento da Despesa, após os filtros.", r, lim),
      },
      anterior: rA?.total.atualizado ?? null,
      variacao: rA ? variacao(r.total.atualizado, rA.total.atualizado) : null,
      tipo: "moeda",
      detalhe: "/orgaos",
      glossario: "orcamento-autorizado",
    });
    const saldo = r.total.atualizado - r.total.empenhado;
    const saldoA = rA ? rA.total.atualizado - rA.total.empenhado : null;
    out.push({
      id: "saldo",
      titulo: "Saldo disponível para empenho",
      explicacao: "Parte do orçamento atualizado que ainda não foi comprometida (empenhada). Calculado pela plataforma.",
      atual: {
        valor: saldo,
        proveniencia: prov(
          "orcamento",
          f,
          String(f.ano),
          "Orçamento Atualizado − Orçamento Empenhado, ambos do mesmo arquivo Orçamento da Despesa (mesma data de extração).",
          r,
          [...lim, "Não considera contingenciamentos (limites de empenho) nem restos a pagar."],
          "calculado",
        ),
      },
      // Saldo é uma "fotografia" na data de extração: comparar com o ano anterior
      // (fechado) mistura momentos diferentes do exercício, então não é exibida variação.
      anterior: saldoA,
      variacao: null,
      tipo: "moeda",
      detalhe: "/orgaos",
      glossario: "saldo-orcamentario",
    });
  } else {
    const motivo = !orc
      ? "Arquivo de Orçamento da Despesa ainda não carregado para este ano (execute o ETL)."
      : "O arquivo de orçamento não é regionalizado por estado; não há valor estadual equivalente.";
    out.push({ id: "orcamento", titulo: "Orçamento atualizado", explicacao: "Limite de gastos autorizado para o ano.", atual: indisponivel(motivo, f), anterior: null, variacao: null, tipo: "moeda", glossario: "orcamento-autorizado" });
    out.push({ id: "saldo", titulo: "Saldo disponível para empenho", explicacao: "Orçamento atualizado ainda não empenhado.", atual: indisponivel(motivo, f), anterior: null, variacao: null, tipo: "moeda", glossario: "saldo-orcamentario" });
  }

  // 2–4 — Estágios da despesa (fonte: Execução da Despesa, mensal)
  const estagios = [
    ["empenhado", "Empenhado", "Valor comprometido: o governo reservou o dinheiro para uma despesa específica.", "empenho"],
    ["liquidado", "Liquidado", "Valor de despesas cuja entrega do bem ou serviço foi verificada.", "liquidacao"],
    ["pago", "Pago", "Dinheiro que efetivamente saiu do caixa para quitar a despesa (exclui restos a pagar de anos anteriores).", "pagamento"],
  ] as const;
  const mE = mesesEfetivos(f, "execucao");
  if (exe && mE) {
    const r = consultar(exe, { filtros: fc, meses: mE });
    const rA = exeAnt ? consultar(exeAnt, { filtros: fc, meses: mE }) : null;
    const limTerr = temFiltroTerritorial(f)
      ? ["Com filtro territorial, considera apenas despesas cuja UF está indicada no plano de trabalho. Despesas nacionais não entram."]
      : [];
    for (const [k, t, e, g] of estagios) {
      out.push({
        id: k,
        titulo: t,
        explicacao: e,
        atual: {
          valor: r.total[k],
          proveniencia: prov("execucao", f, periodoTexto(f, mE), `Soma da coluna “Valor ${t} (R$)” dos arquivos mensais de Execução da Despesa no período.`, r, [
            "Empenhado, liquidado e pago são etapas do mesmo gasto: não devem ser somados entre si.",
            ...limTerr,
          ]),
        },
        anterior: rA?.total[k] ?? null,
        variacao: rA ? variacao(r.total[k], rA.total[k]) : null,
        tipo: "moeda",
        detalhe: "/orgaos",
        glossario: g,
      });
    }
  } else {
    for (const [k, t, e, g] of estagios)
      out.push({ id: k, titulo: t, explicacao: e, atual: indisponivel("Arquivos de Execução da Despesa não carregados para o período.", f), anterior: null, variacao: null, tipo: "moeda", glossario: g });
  }

  // 6 — Transferências
  const mT = mesesEfetivos(f, "transferencias");
  if (tra && mT) {
    const r = consultar(tra, { filtros: fc, meses: mT });
    const rA = traAnt ? consultar(traAnt, { filtros: fc, meses: mT }) : null;
    out.push({
      id: "transferencias",
      titulo: "Recursos transferidos",
      explicacao: "Dinheiro federal repassado a estados, municípios, entidades e cidadãos. Parte destes valores também aparece em “Pago”: são visões diferentes, não somáveis.",
      atual: {
        valor: r.total.valor,
        proveniencia: prov("transferencias", f, periodoTexto(f, mT), "Soma de “VALOR TRANSFERIDO” dos arquivos mensais de Recursos Transferidos.", r, [
          "Transferências são, em geral, pagamentos já contidos na execução da despesa. Não some com o indicador “Pago”.",
        ]),
      },
      anterior: rA?.total.valor ?? null,
      variacao: rA ? variacao(r.total.valor, rA.total.valor) : null,
      tipo: "moeda",
      detalhe: "/mapa",
      glossario: "transferencia",
    });
  } else {
    out.push({ id: "transferencias", titulo: "Recursos transferidos", explicacao: "Dinheiro federal repassado a outros entes.", atual: indisponivel("Arquivos de Recursos Transferidos não carregados para o período.", f), anterior: null, variacao: null, tipo: "moeda", glossario: "transferencia" });
  }

  // 7 — Contratos ativos (fonte ainda não integrada nesta versão)
  out.push({
    id: "contratos",
    titulo: "Contratos ativos identificados",
    explicacao: "Quantidade de contratos vigentes no período.",
    atual: indisponivel(
      "Ainda não integrado em lote. O arquivo “Contratos” (download-de-dados/compras) será incorporado ao ETL; enquanto isso, contratos podem ser consultados por órgão no módulo Contratos (API).",
      f,
      "Portal da Transparência — Contratos",
    ),
    anterior: null,
    variacao: null,
    tipo: "inteiro",
    detalhe: "/contratos",
    glossario: "contrato",
  });

  // 8 — Registros analisados
  const m = manifesto();
  const doAno = m?.conjuntos.filter((c) => c.ano === f.ano) ?? [];
  const lidas = doAno.reduce((s, c) => s + c.arquivos.reduce((a, x) => a + x.linhasLidas, 0), 0);
  out.push({
    id: "registros",
    titulo: "Registros analisados",
    explicacao: "Linhas dos arquivos oficiais lidas para montar este painel no ano selecionado.",
    atual: {
      valor: doAno.length ? lidas : null,
      proveniencia: {
        origem: origemDe("calculado"),
        fonte: "Manifesto do ETL (data/agregados/manifesto.json)",
        periodo: String(f.ano),
        atualizadoEm: m?.geradoEm,
        metodologia: "Soma das linhas lidas em todos os arquivos processados para o ano, independente dos filtros.",
        filtrosAplicados: [],
        filtrosNaoAplicaveis: [],
        limitacoes: [],
      },
    },
    anterior: null,
    variacao: null,
    tipo: "inteiro",
    detalhe: "/fontes",
  });
  return out;
}

/* ------------------------------------------------------------------ território */

function cuboDaMetrica(met: Metrica, ano: number, municipal = false): Cubo | null {
  if (met === "emendas") return cubo("emendas", ano);
  return cubo((municipal ? `${met}_municipios` : met) as NomeConjunto, ano);
}

export interface ValorUF {
  sigla: string;
  nome: string;
  cod: number;
  regiao: string;
  valor: number;
  perCapita: number;
  populacao: number;
  posicao: number;
}

export interface Territorio {
  metrica: Metrica;
  ufs: ValorUF[];
  naoIdentificado: number;
  totalGeral: number;
  disponivel: boolean;
  proveniencia: Proveniencia;
}

export function territorio(f: Filtros): Territorio {
  const met = METRICAS[f.metrica];
  const c = cuboDaMetrica(f.metrica, f.ano);
  const fc = { ...filtrosDeCubo(f), uf: undefined };
  const m = f.metrica === "emendas" ? null : mesesEfetivos(f, met.conjunto as NomeConjunto);
  if (!c || (f.metrica !== "emendas" && !m)) {
    return {
      metrica: f.metrica,
      ufs: [],
      naoIdentificado: 0,
      totalGeral: 0,
      disponivel: false,
      proveniencia: indisponivel(`${met.rotulo}: dados não carregados para o período.`, f).proveniencia,
    };
  }
  const r = consultar(c, { filtros: fc, meses: m ?? undefined, agrupar: ["uf"] });
  const porSigla = new Map(r.grupos.map((g) => [item(g, "uf").cod, g.valores[met.medida]]));
  const ufs: ValorUF[] = UFS.map((u) => {
    const v = porSigla.get(u.sigla) ?? 0;
    return { sigla: u.sigla, nome: u.nome, cod: u.cod, regiao: u.regiao, valor: v, perCapita: v / u.populacao, populacao: u.populacao, posicao: 0 };
  });
  const chave = f.modo === "per_capita" ? "perCapita" : "valor";
  [...ufs].sort((a, b) => b[chave] - a[chave]).forEach((u, i) => (u.posicao = i + 1));
  const lim = [
    "Região/estado selecionados destacam o mapa, mas não ocultam as demais UFs (para permitir comparação).",
    f.metrica === "emendas" ? "Emendas não têm detalhamento mensal: o filtro de meses não se aplica." : "",
    f.modo === "per_capita" ? "Valor por habitante usa a população do Censo 2022 (IBGE)." : "",
  ].filter(Boolean);
  return {
    metrica: f.metrica,
    ufs,
    naoIdentificado: porSigla.get("NI") ?? 0,
    totalGeral: r.total[met.medida],
    disponivel: true,
    proveniencia: prov(met.conjunto as NomeConjunto, f, f.metrica === "emendas" ? String(f.ano) : periodoTexto(f, m), met.descricao, r, lim, f.modo === "per_capita" ? "calculado" : "oficial"),
  };
}

export interface ValorMunicipio {
  cod: string;
  nome: string;
  valor: number;
  identificado: boolean;
}

export function municipios(f: Filtros, uf: string): { itens: ValorMunicipio[]; disponivel: boolean; proveniencia: Proveniencia } {
  const met = METRICAS[f.metrica];
  const c = cuboDaMetrica(f.metrica, f.ano, true);
  const m = f.metrica === "emendas" ? undefined : mesesEfetivos(f, met.conjunto as NomeConjunto) ?? undefined;
  if (!c) return { itens: [], disponivel: false, proveniencia: indisponivel("Detalhamento municipal não carregado.", f).proveniencia };
  const fc = { ...filtrosDeCubo(f), uf: [uf] };
  const r = consultar(c, { filtros: fc, meses: m, agrupar: ["municipio"] });
  const itens = r.grupos
    .map((g) => {
      const it = item(g, "municipio");
      return { cod: it.cod, nome: it.nome, valor: g.valores[met.medida], identificado: !it.cod.startsWith("NI") };
    })
    .sort((a, b) => b.valor - a.valor);
  return {
    itens,
    disponivel: true,
    proveniencia: prov(c.conjunto, f, m ? periodoTexto(f, m) : String(f.ano), `${met.descricao} Detalhado por município.`, r, [
      f.metrica === "emendas"
        ? "Município pelo código IBGE informado na emenda."
        : "Município associado pelo nome publicado na fonte + UF; nomes sem correspondência aparecem como não identificados.",
    ]),
  };
}

/* ------------------------------------------------------------------ painel do estado */

export interface Linha {
  cod: string;
  nome: string;
  valor: number;
  extra?: Record<string, string>;
}

function linhas(gs: Grupo[], dim: string, medida: string, n = 6): { itens: Linha[]; demais: number; quantidadeDemais: number } {
  const t = topN(gs, medida, n);
  return {
    itens: t.top.map((g) => ({ ...item(g, dim), valor: g.valores[medida] })),
    demais: t.demais,
    quantidadeDemais: t.quantidadeDemais,
  };
}

export function painelEstado(f: Filtros, sigla: string) {
  const uf = resolverUF(sigla)!;
  const fc = { ...filtrosDeCubo(f), uf: [uf.sigla] };
  const resumoMetricas = (Object.keys(METRICAS) as Metrica[]).map((k) => {
    const t = territorio({ ...f, metrica: k });
    const v = t.ufs.find((x) => x.sigla === uf.sigla);
    const totalBR = t.ufs.reduce((s, x) => s + x.valor, 0);
    return {
      metrica: k,
      rotulo: METRICAS[k].rotulo,
      disponivel: t.disponivel,
      valor: v?.valor ?? null,
      perCapita: v?.perCapita ?? null,
      perCapitaBrasil: totalBR / POPULACAO_BRASIL,
      posicao: v?.posicao ?? null,
      proveniencia: t.proveniencia,
    };
  });

  const met = METRICAS[f.metrica];
  const c = cuboDaMetrica(f.metrica, f.ano);
  const m = f.metrica === "emendas" ? undefined : mesesEfetivos(f, met.conjunto as NomeConjunto) ?? undefined;
  const areas = c ? linhas(consultar(c, { filtros: fc, meses: m, agrupar: ["funcao"] }).grupos, "funcao", met.medida) : null;
  const programas = c ? linhas(consultar(c, { filtros: fc, meses: m, agrupar: ["programa"] }).grupos, "programa", met.medida, 8) : null;

  const exe = cubo("execucao", f.ano);
  const mE = mesesEfetivos(f, "execucao") ?? undefined;
  const orgaos = exe ? linhas(consultar(exe, { filtros: fc, meses: mE, agrupar: ["orgaoSuperior"] }).grupos, "orgaoSuperior", "pago") : null;

  const tra = cubo("transferencias", f.ano);
  const mT = mesesEfetivos(f, "transferencias") ?? undefined;
  const tiposTransf = tra ? linhas(consultar(tra, { filtros: fc, meses: mT, agrupar: ["tipo"] }).grupos, "tipo", "valor", 6) : null;

  const fav = cubo("transferencias_favorecidos", f.ano);
  const favorecidos = fav ? linhas(consultar(fav, { filtros: { uf: [uf.sigla] }, agrupar: ["favorecido"] }).grupos, "favorecido", "valor", 8) : null;

  const em = cubo("emendas", f.ano);
  const emendas = em
    ? topN(consultar(em, { filtros: fc, agrupar: ["emenda", "autor", "municipio"] }).grupos, "pago", 8).top.map((g) => ({
        codigo: item(g, "emenda").cod,
        numero: item(g, "emenda").nome,
        autor: item(g, "autor").nome,
        municipio: item(g, "municipio").nome,
        empenhado: g.valores.empenhado,
        pago: g.valores.pago,
      }))
    : null;

  // Histórico mensal (métrica atual) e anual (todas as UFs ao longo dos anos disponíveis)
  const mensal =
    c && f.metrica !== "emendas"
      ? consultar(c, { filtros: fc, agrupar: ["mes"] })
          .grupos.map((g) => ({ mes: g.chave.mes as number, rotulo: mesAbrev(g.chave.mes as number), valor: g.valores[met.medida] }))
          .sort((a, b) => a.mes - b.mes)
      : null;
  const anual = anosDisponiveis()
    .slice()
    .sort((a, b) => a - b)
    .map((ano) => {
      const cc = cuboDaMetrica(f.metrica, ano);
      if (!cc) return { ano, valor: null as number | null };
      return { ano, valor: consultar(cc, { filtros: { ...fc } }).total[met.medida] };
    });

  return {
    uf,
    resumoMetricas,
    metrica: f.metrica,
    areas,
    programas,
    orgaos,
    tiposTransf,
    favorecidos,
    emendas,
    mensal,
    anual,
    proveniencia: c
      ? prov(met.conjunto as NomeConjunto, f, m ? periodoTexto(f, m) : String(f.ano), met.descricao, consultar(c, { filtros: fc, meses: m }), [])
      : indisponivel("Dados não carregados.", f).proveniencia,
  };
}

/* ------------------------------------------------------------------ rankings e módulos */

export function rankingOrgaos(f: Filtros) {
  const exe = cubo("execucao", f.ano);
  const orc = cubo("orcamento", f.ano);
  const fc = filtrosDeCubo(f);
  const mE = mesesEfetivos(f, "execucao") ?? undefined;
  const e = exe ? consultar(exe, { filtros: fc, meses: mE, agrupar: ["orgaoSuperior"] }) : null;
  const o = orc && !temFiltroTerritorial(f) ? consultar(orc, { filtros: fc, agrupar: ["orgaoSuperior"] }) : null;
  const mapa = new Map<string, { cod: string; nome: string; atualizado: number | null; empenhado: number; liquidado: number; pago: number }>();
  for (const g of o?.grupos ?? []) {
    const it = item(g, "orgaoSuperior");
    mapa.set(it.cod, { cod: it.cod, nome: it.nome, atualizado: g.valores.atualizado, empenhado: 0, liquidado: 0, pago: 0 });
  }
  for (const g of e?.grupos ?? []) {
    const it = item(g, "orgaoSuperior");
    const x = mapa.get(it.cod) ?? { cod: it.cod, nome: it.nome, atualizado: o ? 0 : null, empenhado: 0, liquidado: 0, pago: 0 };
    x.empenhado = g.valores.empenhado;
    x.liquidado = g.valores.liquidado;
    x.pago = g.valores.pago;
    mapa.set(it.cod, x);
  }
  return {
    itens: [...mapa.values()].sort((a, b) => b.pago - a.pago || (b.atualizado ?? 0) - (a.atualizado ?? 0)),
    proveniencia: e ? prov("execucao", f, periodoTexto(f, mE ?? null), "Orçamento atualizado (arquivo anual de Orçamento) ao lado dos estágios da execução (arquivos mensais), agrupados por órgão superior. As colunas vêm de arquivos distintos e não são somadas.", e, temFiltroTerritorial(f) ? ["Com filtro territorial, o orçamento não é exibido (não regionalizado)."] : []) : indisponivel("Execução não carregada.", f).proveniencia,
  };
}

export function detalheOrgao(f: Filtros, cod: string) {
  const fc = { ...filtrosDeCubo(f), orgaoSuperior: [cod] };
  const exe = cubo("execucao", f.ano);
  const orc = cubo("orcamento", f.ano);
  const mE = mesesEfetivos(f, "execucao") ?? undefined;
  const nome =
    exe?.dicionarios.orgaoSuperior.find((x) => x.cod === cod)?.nome ?? orc?.dicionarios.orgaoSuperior.find((x) => x.cod === cod)?.nome ?? null;
  if (!nome) return null;
  const porDim = (dim: string) => {
    const e = exe ? consultar(exe, { filtros: fc, meses: mE, agrupar: [dim] }) : null;
    const o = orc && orc.dimensoes.includes(dim) && !temFiltroTerritorial(f) ? consultar(orc, { filtros: fc, agrupar: [dim] }) : null;
    const mapa = new Map<string, { cod: string; nome: string; atualizado: number | null; empenhado: number; liquidado: number; pago: number }>();
    for (const g of o?.grupos ?? []) {
      const it = item(g, dim);
      mapa.set(it.cod, { cod: it.cod, nome: it.nome, atualizado: g.valores.atualizado, empenhado: 0, liquidado: 0, pago: 0 });
    }
    for (const g of e?.grupos ?? []) {
      const it = item(g, dim);
      const x = mapa.get(it.cod) ?? { cod: it.cod, nome: it.nome, atualizado: o ? 0 : null, empenhado: 0, liquidado: 0, pago: 0 };
      Object.assign(x, { empenhado: g.valores.empenhado, liquidado: g.valores.liquidado, pago: g.valores.pago });
      mapa.set(it.cod, x);
    }
    return [...mapa.values()].sort((a, b) => b.pago - a.pago || (b.atualizado ?? 0) - (a.atualizado ?? 0));
  };
  const mensal = exe
    ? consultar(exe, { filtros: fc, agrupar: ["mes"] }).grupos
        .map((g) => ({ mes: g.chave.mes as number, rotulo: mesAbrev(g.chave.mes as number), empenhado: g.valores.empenhado, liquidado: g.valores.liquidado, pago: g.valores.pago }))
        .sort((a, b) => a.mes - b.mes)
    : [];
  const anual = anosDisponiveis()
    .slice()
    .sort((a, b) => a - b)
    .map((ano) => {
      const c = cubo("execucao", ano);
      return { ano, pago: c ? consultar(c, { filtros: fc }).total.pago : null };
    });
  const totE = exe ? consultar(exe, { filtros: fc, meses: mE }) : null;
  const totO = orc && !temFiltroTerritorial(f) ? consultar(orc, { filtros: fc }) : null;
  return {
    cod,
    nome,
    total: {
      atualizado: totO?.total.atualizado ?? null,
      empenhado: totE?.total.empenhado ?? null,
      liquidado: totE?.total.liquidado ?? null,
      pago: totE?.total.pago ?? null,
    },
    orgaos: porDim("orgao"),
    programas: porDim("programa"),
    acoes: porDim("acao"),
    funcoes: porDim("funcao"),
    grupos: porDim("grupo"),
    mensal,
    anual,
    proveniencia: totE ? prov("execucao", f, periodoTexto(f, mE ?? null), "Execução da despesa (mensal) e orçamento (anual) do órgão superior, por unidade, programa, ação e natureza.", totE) : indisponivel("Execução não carregada.", f).proveniencia,
  };
}

export function porArea(f: Filtros) {
  const exe = cubo("execucao", f.ano);
  const orc = cubo("orcamento", f.ano);
  const fc = filtrosDeCubo(f);
  const mE = mesesEfetivos(f, "execucao") ?? undefined;
  const e = exe ? consultar(exe, { filtros: fc, meses: mE, agrupar: ["funcao"] }) : null;
  const o = orc && !temFiltroTerritorial(f) ? consultar(orc, { filtros: fc, agrupar: ["funcao"] }) : null;
  const mapa = new Map<string, { cod: string; nome: string; atualizado: number | null; empenhado: number; liquidado: number; pago: number }>();
  for (const g of o?.grupos ?? []) {
    const it = item(g, "funcao");
    mapa.set(it.cod, { cod: it.cod, nome: it.nome, atualizado: g.valores.atualizado, empenhado: 0, liquidado: 0, pago: 0 });
  }
  for (const g of e?.grupos ?? []) {
    const it = item(g, "funcao");
    const x = mapa.get(it.cod) ?? { cod: it.cod, nome: it.nome, atualizado: o ? 0 : null, empenhado: 0, liquidado: 0, pago: 0 };
    Object.assign(x, { empenhado: g.valores.empenhado, liquidado: g.valores.liquidado, pago: g.valores.pago });
    mapa.set(it.cod, x);
  }
  return {
    itens: [...mapa.values()].sort((a, b) => b.pago - a.pago),
    proveniencia: e ? prov("execucao", f, periodoTexto(f, mE ?? null), "Classificação funcional oficial (função de governo). Valores da execução mensal e do orçamento anual, lado a lado.", e) : indisponivel("Execução não carregada.", f).proveniencia,
  };
}

export function rankingProgramas(f: Filtros, n = 10) {
  const orc = cubo("orcamento", f.ano);
  if (!orc || temFiltroTerritorial(f)) return null;
  const r = consultar(orc, { filtros: filtrosDeCubo(f), agrupar: ["programa"] });
  return { ...linhas(r.grupos, "programa", "atualizado", n), proveniencia: prov("orcamento", f, String(f.ano), "Programas ordenados pelo orçamento atualizado.", r) };
}

export function rankingFavorecidos(f: Filtros, n = 10, q?: string) {
  const c = cubo("transferencias_favorecidos", f.ano);
  if (!c) return null;
  const fc = { uf: filtrosDeCubo(f).uf };
  const r = consultar(c, { filtros: fc, agrupar: ["favorecido", "tipoFavorecido"] });
  let gs = r.grupos;
  if (q) {
    const nq = normalizarTexto(q);
    gs = gs.filter((g) => normalizarTexto(item(g, "favorecido").nome).includes(nq) || item(g, "favorecido").cod.includes(q.replace(/\D/g, "") || "§"));
  }
  const t = topN(gs, "valor", n);
  return {
    itens: t.top.map((g) => ({ ...item(g, "favorecido"), tipo: item(g, "tipoFavorecido").nome, valor: g.valores.valor })),
    total: gs.length,
    proveniencia: prov("transferencias_favorecidos", f, String(f.ano), "Soma das transferências recebidas por favorecido (pessoas jurídicas e entes públicos) no ano.", r, [
      "Pessoas físicas não são listadas individualmente.",
      "Receber recursos públicos não é indício de irregularidade.",
    ]),
  };
}

export function listaEmendas(f: Filtros, opts: { q?: string; ordenar?: "pago" | "empenhado"; pagina?: number; porPagina?: number } = {}) {
  const c = cubo("emendas", f.ano);
  if (!c) return null;
  const fc = filtrosDeCubo(f);
  const r = consultar(c, { filtros: fc, agrupar: ["emenda", "autor", "tipo", "uf", "municipio", "funcao"] });
  let gs = r.grupos;
  if (opts.q) {
    const nq = normalizarTexto(opts.q);
    gs = gs.filter((g) =>
      [item(g, "emenda").cod, item(g, "emenda").nome, item(g, "autor").nome, item(g, "municipio").nome].some((s) => normalizarTexto(s).includes(nq)),
    );
  }
  const ord = opts.ordenar ?? "pago";
  gs.sort((a, b) => b.valores[ord] - a.valores[ord]);
  const pp = opts.porPagina ?? 25;
  const pagina = Math.max(1, opts.pagina ?? 1);
  const tot = { empenhado: 0, liquidado: 0, pago: 0 };
  for (const g of gs) for (const k of Object.keys(tot) as (keyof typeof tot)[]) tot[k] += g.valores[k];
  const porAutor = topN(consultar(c, { filtros: fc, agrupar: ["autor"] }).grupos, "pago", 10);
  return {
    total: gs.length,
    pagina,
    paginas: Math.max(1, Math.ceil(gs.length / pp)),
    somas: tot,
    itens: gs.slice((pagina - 1) * pp, pagina * pp).map((g) => ({
      codigo: item(g, "emenda").cod,
      numero: item(g, "emenda").nome,
      localidade: item(g, "emenda").extra?.localidade ?? "",
      autor: item(g, "autor").nome,
      tipo: item(g, "tipo").nome,
      uf: item(g, "uf").cod,
      municipio: item(g, "municipio").nome,
      funcao: item(g, "funcao").nome,
      empenhado: g.valores.empenhado,
      liquidado: g.valores.liquidado,
      pago: g.valores.pago,
      rapPago: g.valores.rapPago,
    })),
    porAutor: porAutor.top.map((g) => ({ ...item(g, "autor"), pago: g.valores.pago, empenhado: g.valores.empenhado })),
    proveniencia: prov("emendas", f, String(f.ano), "Arquivo de Emendas Parlamentares (por emenda). Valores de empenho, liquidação e pagamento da execução de cada emenda.", r, [
      "Autoria, indicação de destino, execução e recebimento são etapas distintas.",
      "Emendas sem município específico aparecem como “Município não identificado”.",
    ]),
  };
}

/* ------------------------------------------------------------------ busca global */

export interface ResultadoBusca {
  tipo: string;
  titulo: string;
  subtitulo?: string;
  href: string;
}

export function buscar(q: string, ano: number, limitePorTipo = 6): Record<string, ResultadoBusca[]> {
  const nq = normalizarTexto(q);
  if (nq.length < 2) return {};
  const out: Record<string, ResultadoBusca[]> = {};
  const add = (tipo: string, r: ResultadoBusca) => {
    const l = (out[tipo] ??= []);
    if (l.length < limitePorTipo && !l.some((x) => x.href === r.href)) l.push(r);
  };
  const casa = (it: ItemDicionario) => normalizarTexto(it.nome).includes(nq) || it.cod === q.trim();

  for (const u of UFS) if (normalizarTexto(u.nome).includes(nq) || u.sigla === q.trim().toUpperCase()) add("Estados", { tipo: "Estados", titulo: u.nome, subtitulo: u.regiao, href: `/estado/${u.sigla}?ano=${ano}` });

  const exe = cubo("execucao", ano) ?? cubo("orcamento", ano);
  if (exe) {
    for (const it of exe.dicionarios.orgaoSuperior ?? []) if (casa(it)) add("Órgãos", { tipo: "Órgãos", titulo: it.nome, subtitulo: `Código SIAFI ${it.cod}`, href: `/orgaos/${it.cod}?ano=${ano}` });
    for (const it of exe.dicionarios.funcao ?? []) if (casa(it)) add("Áreas de atuação", { tipo: "Áreas de atuação", titulo: it.nome, subtitulo: `Função ${it.cod}`, href: `/areas?ano=${ano}&funcao=${it.cod}` });
    for (const it of exe.dicionarios.programa ?? []) if (casa(it)) add("Programas", { tipo: "Programas", titulo: it.nome, subtitulo: `Programa ${it.cod}`, href: `/?ano=${ano}&programa=${it.cod}` });
    for (const it of exe.dicionarios.acao ?? []) if (casa(it)) add("Ações orçamentárias", { tipo: "Ações orçamentárias", titulo: it.nome, subtitulo: `Ação ${it.cod}`, href: `/busca/acao/${encodeURIComponent(it.cod)}?ano=${ano}` });
  }
  const mun = cubo("transferencias_municipios", ano) ?? cubo("execucao_municipios", ano);
  for (const it of mun?.dicionarios.municipio ?? [])
    if (!it.cod.startsWith("NI") && casa(it)) add("Municípios", { tipo: "Municípios", titulo: it.nome, subtitulo: it.extra?.uf, href: `/mapa?ano=${ano}&uf=${it.extra?.uf}&mun=${it.cod}` });
  const em = cubo("emendas", ano);
  if (em) {
    for (const it of em.dicionarios.emenda ?? []) if (it.cod === q.trim() || it.nome === q.trim()) add("Emendas parlamentares", { tipo: "Emendas parlamentares", titulo: `Emenda ${it.nome}`, subtitulo: it.cod, href: `/emendas?ano=${ano}&q=${it.cod}` });
    for (const it of em.dicionarios.autor ?? []) if (casa(it)) add("Emendas parlamentares", { tipo: "Emendas parlamentares", titulo: it.nome, subtitulo: "Autor de emendas", href: `/emendas?ano=${ano}&q=${encodeURIComponent(it.nome)}` });
  }
  const fav = cubo("transferencias_favorecidos", ano);
  for (const it of fav?.dicionarios.favorecido ?? []) if (casa(it)) add("Empresas e entidades", { tipo: "Empresas e entidades", titulo: it.nome, subtitulo: it.cod, href: `/favorecidos?ano=${ano}&q=${encodeURIComponent(it.nome)}` });
  return out;
}

/** Detalhe de uma ação orçamentária (rota de resultado de busca). */
export function detalheAcao(f: Filtros, cod: string) {
  const exe = cubo("execucao", f.ano);
  const orc = cubo("orcamento", f.ano);
  const it = exe?.dicionarios.acao.find((x) => x.cod === cod) ?? orc?.dicionarios.acao.find((x) => x.cod === cod);
  if (!it) return null;
  const fc = { acao: [cod] };
  const e = exe ? consultar(exe, { filtros: fc, agrupar: ["orgaoSuperior", "programa", "funcao"] }) : null;
  const o = orc ? consultar(orc, { filtros: fc }) : null;
  const ufs = exe ? consultar(exe, { filtros: fc, agrupar: ["uf"] }).grupos.map((g) => ({ ...item(g, "uf"), pago: g.valores.pago })).sort((a, b) => b.pago - a.pago) : [];
  return {
    acao: it,
    vinculos: e?.grupos.map((g) => ({ orgao: item(g, "orgaoSuperior"), programa: item(g, "programa"), funcao: item(g, "funcao") })) ?? [],
    total: { atualizado: o?.total.atualizado ?? null, empenhado: e?.total.empenhado ?? null, liquidado: e?.total.liquidado ?? null, pago: e?.total.pago ?? null },
    ufs,
    proveniencia: e ? prov("execucao", f, String(f.ano), "Ação orçamentária: execução (mensal) e orçamento (anual).", e, ["Uma ação orçamentária não é uma obra ou projeto individual: pode financiar muitas iniciativas."]) : indisponivel("Execução não carregada.", f).proveniencia,
  };
}

/** Opções para os seletores de filtro (código + nome) do ano. */
export function opcoesFiltro(ano: number) {
  const c = cubo("execucao", ano) ?? cubo("orcamento", ano);
  const ord = (l: ItemDicionario[] = []) => [...l].filter((x) => x.cod !== "SEM_CODIGO").sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  return {
    orgaos: ord(c?.dicionarios.orgaoSuperior),
    funcoes: ord(c?.dicionarios.funcao),
    programas: ord(c?.dicionarios.programa),
    grupos: ord(c?.dicionarios.grupo),
    unidades: ord(c?.dicionarios.orgao),
  };
}
