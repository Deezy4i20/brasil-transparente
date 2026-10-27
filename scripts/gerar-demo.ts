/**
 * Gera DADOS DE DEMONSTRAÇÃO (fictícios) no mesmo formato dos cubos do ETL,
 * em data/demo. Servem apenas para desenvolver e testar a interface sem acesso
 * às fontes oficiais. Ative com DADOS_DEMONSTRACAO=true: a interface exibe um
 * aviso permanente e marca todos os valores como "demonstração".
 *
 * Nomes de órgãos, favorecidos e autores levam o prefixo [DEMO]. As funções de
 * governo usam a classificação funcional oficial (taxonomia pública), mas os
 * valores associados são inventados.
 */
import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { ConstrutorCubo } from "./etl/cubo";
import { UFS } from "../src/lib/referencia/ufs";
import { carregarIndiceMunicipios } from "./etl/municipios";
import type { Manifesto, ManifestoConjunto, NomeConjunto } from "../src/lib/dados/tipos";

const OUT = join(process.cwd(), "data", "demo");
let semente = 20260101;
const rnd = () => ((semente = (semente * 1664525 + 1013904223) % 4294967296) / 4294967296);
const entre = (a: number, b: number) => a + rnd() * (b - a);

const FUNCOES = [
  ["10", "Saúde", 0.11], ["12", "Educação", 0.07], ["09", "Previdência Social", 0.3], ["08", "Assistência Social", 0.1],
  ["28", "Encargos Especiais", 0.25], ["05", "Defesa Nacional", 0.03], ["06", "Segurança Pública", 0.01],
  ["26", "Transporte", 0.012], ["19", "Ciência e Tecnologia", 0.004], ["18", "Gestão Ambiental", 0.002],
  ["20", "Agricultura", 0.01], ["04", "Administração", 0.02], ["13", "Cultura", 0.001], ["27", "Desporto e Lazer", 0.0008],
  ["11", "Trabalho", 0.03], ["15", "Urbanismo", 0.004],
] as const;
const ORGAOS = [
  ["36000", "[DEMO] Ministério da Saúde", ["10"]], ["26000", "[DEMO] Ministério da Educação", ["12"]],
  ["33000", "[DEMO] Ministério da Previdência Social", ["09"]], ["55000", "[DEMO] Ministério do Desenvolvimento e Assistência Social", ["08"]],
  ["71000", "[DEMO] Encargos Financeiros da União", ["28"]], ["73000", "[DEMO] Transferências a Estados, DF e Municípios", ["28"]],
  ["52000", "[DEMO] Ministério da Defesa", ["05"]], ["30000", "[DEMO] Ministério da Justiça e Segurança Pública", ["06"]],
  ["39000", "[DEMO] Ministério dos Transportes", ["26"]], ["24000", "[DEMO] Ministério da Ciência, Tecnologia e Inovação", ["19"]],
  ["44000", "[DEMO] Ministério do Meio Ambiente", ["18"]], ["22000", "[DEMO] Ministério da Agricultura e Pecuária", ["20"]],
  ["40000", "[DEMO] Ministério do Trabalho e Emprego", ["11"]], ["42000", "[DEMO] Ministério da Cultura", ["13"]],
  ["51000", "[DEMO] Ministério do Esporte", ["27"]], ["56000", "[DEMO] Ministério das Cidades", ["15"]],
  ["20000", "[DEMO] Presidência da República", ["04"]],
] as const;
const GRUPOS = [["1", "Pessoal e Encargos Sociais"], ["2", "Juros e Encargos da Dívida"], ["3", "Outras Despesas Correntes"], ["4", "Investimentos"], ["6", "Amortização da Dívida"]] as const;
const TIPOS_TRANSF = ["Constitucionais e Royalties", "Legais, Voluntárias e Específicas", "Diretamente ao Cidadão"];

function programasDe(cod: string) {
  return [0, 1, 2].map((i) => ({ cod: `${5000 + Number(cod) * 3 + i}`, nome: `[DEMO] Programa ${i + 1} de ${FUNCOES.find((f) => f[0] === cod)![1]}` }));
}
function acoesDe(prog: string) {
  return [0, 1].map((i) => ({ cod: `${prog.slice(-2)}${String.fromCharCode(65 + i)}${i}`.padEnd(4, "0"), nome: `[DEMO] Ação ${i + 1} do programa ${prog}` }));
}

function gerarAno(ano: number, ultimoMes: number, fator: number): ManifestoConjunto[] {
  const dir = join(OUT, String(ano));
  mkdirSync(dir, { recursive: true });
  const mun = carregarIndiceMunicipios();
  const munPorUf = new Map<string, { cod: string; nome: string }[]>();
  for (const [k, v] of mun.porNome) {
    const uf = k.split("|")[0];
    (munPorUf.get(uf) ?? munPorUf.set(uf, []).get(uf)!).push(v);
  }
  const TOTAL = 5.2e12 * fator;
  const orc = new ConstrutorCubo("orcamento", ano, ["orgaoSuperior", "orgao", "funcao", "programa", "acao", "grupo"], ["inicial", "atualizado", "empenhado", "realizado"]);
  const exe = new ConstrutorCubo("execucao", ano, ["mes", "orgaoSuperior", "orgao", "funcao", "programa", "acao", "grupo", "uf"], ["empenhado", "liquidado", "pago", "rapInscrito", "rapCancelado", "rapPago"]);
  const exeM = new ConstrutorCubo("execucao_municipios", ano, ["mes", "uf", "municipio", "funcao"], ["empenhado", "liquidado", "pago"]);
  const tra = new ConstrutorCubo("transferencias", ano, ["mes", "tipo", "orgao", "funcao", "programa", "acao", "uf"], ["valor"]);
  const traM = new ConstrutorCubo("transferencias_municipios", ano, ["mes", "uf", "municipio", "funcao", "tipo"], ["valor"]);
  const traF = new ConstrutorCubo("transferencias_favorecidos", ano, ["uf", "favorecido", "tipoFavorecido"], ["valor"]);
  const em = new ConstrutorCubo("emendas", ano, ["emenda", "autor", "tipo", "uf", "municipio", "funcao", "programa", "acao"], ["empenhado", "liquidado", "pago", "rapInscrito", "rapCancelado", "rapPago"]);
  const popTot = UFS.reduce((s, u) => s + u.populacao, 0);
  const ufPeso = (sigla: string) => UFS.find((u) => u.sigla === sigla)!.populacao / popTot;
  let linhas = 0;

  for (const [codO, nomeO, funcs] of ORGAOS) {
    for (const codF of funcs) {
      const fn = FUNCOES.find((f) => f[0] === codF)!;
      const nOrgaosComF = ORGAOS.filter((o) => (o[2] as readonly string[]).includes(codF)).length;
      const base = (TOTAL * fn[2]) / nOrgaosComF;
      const funcao = { cod: fn[0], nome: fn[1] };
      const os = { cod: codO, nome: nomeO };
      const orgao = { cod: `${codO.slice(0, 2)}${String(Math.floor(entre(100, 999)))}`, nome: `${nomeO} — Administração direta` };
      for (const prog of programasDe(codF)) {
        for (const ac of acoesDe(prog.cod)) {
          const grupo = codF === "28" ? GRUPOS[rnd() < 0.5 ? 1 : 4] : GRUPOS[rnd() < 0.35 ? 0 : rnd() < 0.8 ? 2 : 3];
          const atualizado = (base / 6) * entre(0.6, 1.4);
          const taxaEmp = entre(0.7, 0.98) * (ultimoMes / 12) ** 0.6;
          const taxaPago = entre(0.75, 0.97);
          let emp = 0, pag = 0;
          for (let m = 1; m <= ultimoMes; m++) {
            const e = (atualizado * taxaEmp) / ultimoMes * entre(0.7, 1.3);
            const l = e * entre(0.85, 0.99);
            const p = l * taxaPago;
            emp += e; pag += p;
            // Parte com localidade indicada (projetos regionais) e parte nacional
            const local = codF === "09" || codF === "28" ? 0.05 : entre(0.3, 0.6);
            for (const u of UFS) {
              const w = local * ufPeso(u.sigla) * entre(0.5, 1.6);
              exe.adicionar({ mes: m, orgaoSuperior: os, orgao, funcao, programa: prog, acao: ac, grupo: { cod: grupo[0], nome: grupo[1] }, uf: { cod: u.sigla, nome: u.nome } }, [e * w, l * w, p * w, 0, 0, 0]);
              const lista = munPorUf.get(u.sigla) ?? [];
              const capital = lista[Math.floor(rnd() * Math.min(lista.length, 3))];
              if (capital && rnd() < 0.25) exeM.adicionar({ mes: m, uf: { cod: u.sigla, nome: u.nome }, municipio: { ...capital, extra: { uf: u.sigla } }, funcao }, [e * w * 0.4, l * w * 0.4, p * w * 0.4]);
            }
            exe.adicionar({ mes: m, orgaoSuperior: os, orgao, funcao, programa: prog, acao: ac, grupo: { cod: grupo[0], nome: grupo[1] }, uf: { cod: "NI", nome: "Localização não identificada" } }, [e * (1 - local), l * (1 - local), p * (1 - local), 0, 0, 0]);
            linhas += 28;
          }
          orc.adicionar({ orgaoSuperior: os, orgao, funcao, programa: prog, acao: ac, grupo: { cod: grupo[0], nome: grupo[1] } }, [atualizado * entre(0.9, 1), atualizado, emp, pag]);
        }
      }
    }
  }

  // Transferências: proporcionais à população com variação, maior peso em Saúde/Educação/Encargos
  const fTransf = FUNCOES.filter((f) => ["10", "12", "28", "08", "15", "26"].includes(f[0]));
  for (let m = 1; m <= ultimoMes; m++) {
    for (const u of UFS) {
      const fatorUf = entre(0.7, 1.5) * (u.regiao === "Norte" || u.regiao === "Nordeste" ? 1.35 : 1);
      for (const fn of fTransf) {
        const tipo = fn[0] === "28" ? TIPOS_TRANSF[0] : fn[0] === "08" ? TIPOS_TRANSF[2] : TIPOS_TRANSF[1];
        const v = (TOTAL * 0.16 * ufPeso(u.sigla) * fatorUf * (fn[0] === "28" ? 0.5 : 0.1)) / 12;
        const prog = programasDe(fn[0])[0];
        tra.adicionar({ mes: m, tipo: { cod: tipo, nome: tipo }, orgao: { cod: "73000", nome: "[DEMO] Transferências a Estados, DF e Municípios" }, funcao: { cod: fn[0], nome: fn[1] }, programa: prog, acao: acoesDe(prog.cod)[0], uf: { cod: u.sigla, nome: u.nome } }, [v]);
        const lista = munPorUf.get(u.sigla) ?? [];
        // distribui uma parte entre até 40 municípios
        const n = Math.min(40, lista.length);
        for (let i = 0; i < n; i++) {
          const mu = lista[Math.floor(rnd() * lista.length)];
          traM.adicionar({ mes: m, uf: { cod: u.sigla, nome: u.nome }, municipio: { ...mu, extra: { uf: u.sigla, correspondencia: "nome" } }, funcao: { cod: fn[0], nome: fn[1] }, tipo: { cod: tipo, nome: tipo } }, [(v * 0.6 * entre(0.2, 1.8)) / n]);
        }
        traM.adicionar({ mes: m, uf: { cod: u.sigla, nome: u.nome }, municipio: { cod: `NI:${u.sigla}`, nome: "Município não identificado", extra: { uf: u.sigla } }, funcao: { cod: fn[0], nome: fn[1] }, tipo: { cod: tipo, nome: tipo } }, [v * 0.05]);
        linhas += n + 2;
      }
    }
    tra.adicionar({ mes: m, tipo: { cod: TIPOS_TRANSF[1], nome: TIPOS_TRANSF[1] }, orgao: { cod: "73000", nome: "[DEMO] Transferências a Estados, DF e Municípios" }, funcao: { cod: "10", nome: "Saúde" }, programa: programasDe("10")[0], acao: acoesDe(programasDe("10")[0].cod)[0], uf: { cod: "NI", nome: "Localização não identificada" } }, [TOTAL * 0.0004]);
  }
  for (const u of UFS) {
    for (let i = 1; i <= 12; i++) {
      const cnpj = String(10_000_000 + Math.floor(rnd() * 89_999_999)).padEnd(14, "0");
      const nome = i === 1 ? `[DEMO] Governo do Estado — ${u.nome}` : i <= 4 ? `[DEMO] Município ${i - 1} — ${u.sigla}` : `[DEMO] Entidade sem fins lucrativos ${i - 4} — ${u.sigla}`;
      traF.adicionar({ uf: { cod: u.sigla, nome: u.nome }, favorecido: { cod: cnpj, nome }, tipoFavorecido: { cod: i <= 4 ? "Administração Pública" : "Entidades Sem Fins Lucrativos", nome: i <= 4 ? "Administração Pública" : "Entidades Sem Fins Lucrativos" } }, [(TOTAL * 0.16 * ufPeso(u.sigla)) / (i * 6)]);
    }
  }

  // Emendas
  for (let i = 1; i <= 900; i++) {
    const u = UFS[Math.floor(rnd() * UFS.length)];
    const lista = munPorUf.get(u.sigla) ?? [];
    const temMun = rnd() < 0.8 && lista.length;
    const mu = temMun ? lista[Math.floor(rnd() * lista.length)] : null;
    const fn = FUNCOES[[0, 1, 3, 13, 15, 10][Math.floor(rnd() * 6)]];
    const prog = programasDe(fn[0])[0];
    const emp = entre(1e5, 2.5e7) * fator;
    const pag = emp * entre(0, 0.95) * (ultimoMes / 12);
    em.adicionar(
      {
        emenda: { cod: `${ano}${String(1000 + (i % 300)).padStart(4, "0")}${String(i).padStart(4, "0")}`, nome: String(i).padStart(4, "0"), extra: { localidade: mu ? `${mu.nome} - ${u.sigla}` : u.nome.toUpperCase() } },
        autor: { cod: String(3000 + (i % 120)), nome: `[DEMO] Parlamentar fictício ${String((i % 120) + 1).padStart(3, "0")}` },
        tipo: { cod: i % 3 === 0 ? "Emenda de Bancada" : "Emenda Individual - Transferências Especiais", nome: i % 3 === 0 ? "Emenda de Bancada" : "Emenda Individual - Transferências Especiais" },
        uf: { cod: u.sigla, nome: u.nome },
        municipio: mu ? { ...mu, extra: { uf: u.sigla, correspondencia: "codigo_ibge" } } : { cod: `NI:${u.sigla}`, nome: "Município não identificado", extra: { uf: u.sigla } },
        funcao: { cod: fn[0], nome: fn[1] },
        programa: prog,
        acao: acoesDe(prog.cod)[0],
      },
      [emp, pag * 1.05, pag, 0, 0, 0],
    );
  }

  const conj: [ConstrutorCubo, NomeConjunto][] = [[orc, "orcamento"], [exe, "execucao"], [exeM, "execucao_municipios"], [tra, "transferencias"], [traM, "transferencias_municipios"], [traF, "transferencias_favorecidos"], [em, "emendas"]];
  for (const [b] of conj) writeFileSync(join(dir, `${b.conjunto}.json`), JSON.stringify(b.construir()));

  const meses = Array.from({ length: ultimoMes }, (_, i) => i + 1);
  const mk = (c: string, nome: string, mensal: boolean): ManifestoConjunto => ({
    conjunto: c as NomeConjunto,
    ano,
    origem: "demonstracao",
    fonte: { nome: `${nome} — DADOS DE DEMONSTRAÇÃO (fictícios)`, url: "https://portaldatransparencia.gov.br/download-de-dados" },
    arquivos: [{ nome: "gerado por scripts/gerar-demo.ts", url: null, periodo: String(ano), baixadoEm: new Date().toISOString(), bytes: 0, linhasLidas: Math.round(linhas / 4), linhasDescartadas: 0, motivosDescarte: {} }],
    mesesDisponiveis: mensal ? meses : [],
    processadoEm: new Date().toISOString(),
    avisos: ["Valores fictícios gerados para desenvolvimento. Não representam gastos reais."],
    linhasAgregadas: 0,
  });
  return [mk("orcamento", "Orçamento da Despesa", false), mk("execucao", "Execução da Despesa", true), mk("transferencias", "Recursos Transferidos", true), mk("emendas", "Emendas Parlamentares", false)];
}

rmSync(OUT, { recursive: true, force: true });
const conjuntos = [...gerarAno(2025, 12, 1), ...gerarAno(2026, 9, 1.06)];
const m: Manifesto = { geradoEm: new Date().toISOString(), modo: "demonstracao", conjuntos };
writeFileSync(join(OUT, "manifesto.json"), JSON.stringify(m, null, 2));
console.log("Dados de demonstração gerados em data/demo (2025 completo, 2026 até setembro).");
