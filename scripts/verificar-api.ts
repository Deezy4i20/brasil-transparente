/**
 * Verifica, com o token real, se os endpoints usados respondem e se as respostas
 * batem com os esquemas (zod). Rode após configurar PORTAL_TRANSPARENCIA_TOKEN:
 *   npm run verificar:api
 * Não imprime o token. Mostra, por endpoint: status, nº de registros, inválidos e
 * os campos recebidos que o esquema não conhece (para ajustar os tipos).
 */
import { Contrato, Convenio, DespesaFuncional, DespesaPorOrgao, Emenda, OrgaoSiafi } from "../src/lib/portal/esquemas";
import type { z } from "zod";

const BASE = "https://api.portaldatransparencia.gov.br/api-de-dados";
const token = process.env.PORTAL_TRANSPARENCIA_TOKEN?.trim();
if (!token) {
  console.error("Defina PORTAL_TRANSPARENCIA_TOKEN (ex.: em .env.local e rode com `node --env-file=.env.local`).");
  process.exit(1);
}
const ano = new Date().getFullYear() - 1;
const casos: [string, Record<string, string | number>, z.ZodTypeAny][] = [
  ["orgaos-siafi", { pagina: 1 }, OrgaoSiafi],
  ["despesas/por-orgao", { ano, orgaoSuperior: "36000", pagina: 1 }, DespesaPorOrgao],
  ["despesas/por-funcional-programatica", { ano, funcao: "10", pagina: 1 }, DespesaFuncional],
  ["emendas", { ano, pagina: 1 }, Emenda],
  ["contratos", { codigoOrgao: "26246", dataInicial: `01/01/${ano}`, dataFinal: `31/12/${ano}`, pagina: 1 }, Contrato],
  ["convenios", { uf: "BA", dataInicial: `01/01/${ano}`, dataFinal: `31/12/${ano}`, pagina: 1 }, Convenio],
];

(async () => {
  let falhas = 0;
  for (const [cam, params, esq] of casos) {
    const u = new URL(`${BASE}/${cam}`);
    for (const [k, v] of Object.entries(params)) u.searchParams.set(k, String(v));
    try {
      const r = await fetch(u, { headers: { "chave-api-dados": token, Accept: "application/json" } });
      if (!r.ok) {
        falhas++;
        console.log(`✗ ${cam}: HTTP ${r.status} — ${(await r.text()).slice(0, 200)}`);
        continue;
      }
      const j = (await r.json()) as unknown[];
      const arr = Array.isArray(j) ? j : [j];
      let inval = 0;
      const extras = new Set<string>();
      const conhecidos = new Set(Object.keys((esq as unknown as { shape?: object }).shape ?? {}));
      for (const x of arr) {
        if (!esq.safeParse(x).success) inval++;
        for (const k of Object.keys(x as object)) if (!conhecidos.has(k)) extras.add(k);
      }
      if (inval) falhas++;
      console.log(`${inval ? "✗" : "✓"} ${cam}: ${arr.length} registro(s), ${inval} inválido(s)${extras.size ? ` · campos extras: ${[...extras].join(", ")}` : ""}`);
      if (inval) console.log("  exemplo:", JSON.stringify(arr[0]).slice(0, 600));
    } catch (e) {
      falhas++;
      console.log(`✗ ${cam}: ${(e as Error).message}`);
    }
    await new Promise((s) => setTimeout(s, 250));
  }
  process.exit(falhas ? 1 : 0);
})();
