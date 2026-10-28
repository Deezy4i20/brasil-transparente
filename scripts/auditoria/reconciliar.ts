/**
 * Reconciliação dos dados processados (data/agregados): confere, com os próprios arquivos oficiais,
 * as regras que sustentam os números do site. Roda nos testes e pode ser chamado à mão:
 *   npx tsx scripts/auditoria/reconciliar.ts
 */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import type { Cubo } from "../../src/lib/dados/tipos";

export interface Verificacao { nome: string; ok: boolean; detalhe: string; /** false = só aviso (não bloqueia a atualização) */ bloqueia?: boolean }
const BI = (v: number) => `R$ ${(v / 1e9).toLocaleString("pt-BR", { maximumFractionDigits: 2 })} bi`;

function ler(dir: string, ano: number, c: string): Cubo | null {
  const p = join(dir, String(ano), `${c}.json`);
  return existsSync(p) ? (JSON.parse(readFileSync(p, "utf8")) as Cubo) : null;
}
function somar(c: Cubo, medida: string, filtro: (l: number[]) => boolean = () => true) {
  const i = c.dimensoes.length + c.medidas.indexOf(medida);
  let s = 0;
  for (const l of c.linhas) if (filtro(l)) s += l[i];
  return s;
}
function porDim(c: Cubo, dim: string, medida: string, filtro: (l: number[]) => boolean = () => true) {
  const d = c.dimensoes.indexOf(dim), i = c.dimensoes.length + c.medidas.indexOf(medida), out = new Map<string, number>();
  for (const l of c.linhas) { if (!filtro(l)) continue; const k = c.dicionarios[dim][l[d]]?.cod ?? "?"; out.set(k, (out.get(k) ?? 0) + l[i]); }
  return out;
}

export function reconciliar(dir = join(process.cwd(), "data", "agregados")): Verificacao[] {
  const v: Verificacao[] = [];
  const anos = readdirSync(dir).filter((x) => /^\d{4}$/.test(x)).map(Number).sort();
  for (const ano of anos) {
    const orc = ler(dir, ano, "orcamento"), exe = ler(dir, ano, "execucao"), tra = ler(dir, ano, "transferencias");
    const traMun = ler(dir, ano, "transferencias_municipios"), fav = ler(dir, ano, "transferencias_favorecidos"), em = ler(dir, ano, "emendas");
    if (orc && exe) {
      const [a, b] = [somar(orc, "empenhado"), somar(exe, "empenhado")];
      v.push({ nome: `${ano}: empenhado do Orçamento = empenhado da Execução`, ok: Math.abs(a - b) <= Math.abs(a) * 0.005, detalhe: `${BI(a)} × ${BI(b)}` });
      const [c, d] = [somar(orc, "realizado"), somar(exe, "pago")];
      v.push({ nome: `${ano}: realizado do Orçamento = pago da Execução`, ok: Math.abs(c - d) <= Math.abs(c) * 0.005, detalhe: `${BI(c)} × ${BI(d)}` });
    }
    if (exe) {
      const [e, l, p] = ["empenhado", "liquidado", "pago"].map((m) => somar(exe, m));
      v.push({ nome: `${ano}: empenhado ≥ liquidado ≥ pago (totais)`, ok: e >= l && l >= p * 0.999, detalhe: `${BI(e)} ≥ ${BI(l)} ≥ ${BI(p)}` });
    }
    if (tra && exe) {
      // Transferências são parte dos pagamentos (do ano ou de restos a pagar), ação por ação, nos mesmos meses.
      const meses = new Set(tra.linhas.map((l) => l[0]));
      const t = porDim(tra, "acao", "valor"), pg = porDim(exe, "acao", "pago", (l) => meses.has(l[0])), rap = porDim(exe, "acao", "rapPago", (l) => meses.has(l[0]));
      let excesso = 0, total = 0;
      for (const [k, x] of t) { total += x; excesso += Math.max(0, x - (pg.get(k) ?? 0) - (rap.get(k) ?? 0)); }
      v.push({ nome: `${ano}: transferências cabem em pago + restos a pagar pagos (por ação)`, ok: excesso <= total * 0.01, detalhe: `excesso ${BI(excesso)} de ${BI(total)} (${((excesso / total) * 100).toFixed(2)}%)` });
    }
    if (tra && traMun && fav) {
      const [a, b, c] = [somar(tra, "valor"), somar(traMun, "valor"), somar(fav, "valor")];
      v.push({ nome: `${ano}: transferências = soma por município = soma por favorecido`, ok: Math.abs(a - b) < 1 && Math.abs(a - c) < 1, detalhe: `${BI(a)} / ${BI(b)} / ${BI(c)}` });
    }
    if (em) {
      const ip = em.dimensoes.length + em.medidas.indexOf("pago"), ie = em.dimensoes.length + em.medidas.indexOf("empenhado");
      const ruins = em.linhas.filter((l) => l[ip] > l[ie] * 1.001 + 1).length;
      v.push({ nome: `${ano}: emendas com pago ≤ empenhado`, ok: ruins === 0, detalhe: `${ruins} emenda(s) com pago acima do empenhado` });
    }
  }
  // Malhas municipais completas (o IBGE tem 5.570 municípios)
  const dg = join(dir, "..", "geo", "municipios");
  if (existsSync(dg)) {
    let n = 0;
    for (const f of readdirSync(dg)) n += (Object.values(JSON.parse(readFileSync(join(dg, f), "utf8")).objects)[0] as { geometries: unknown[] }).geometries.length;
    v.push({ nome: "malhas: todos os 5.570 municípios presentes", ok: n === 5570, detalhe: `${n} municípios${n < 5570 ? " — malha de espelho sem os municípios mais novos; rode as malhas com a API do IBGE" : ""}`, bloqueia: false });
  }
  return v;
}

if (process.argv[1]?.endsWith("reconciliar.ts")) {
  const r = reconciliar();
  for (const x of r) console.log(`${x.ok ? "✓" : "✗"} ${x.nome} — ${x.detalhe}`);
  process.exit(r.every((x) => x.ok || x.bloqueia === false) ? 0 : 1);
}
