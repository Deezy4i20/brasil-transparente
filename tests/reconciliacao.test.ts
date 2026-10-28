import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { reconciliar } from "../scripts/auditoria/reconciliar";

const temDados = existsSync(join(process.cwd(), "data", "agregados", "manifesto.json"));

describe.skipIf(!temDados)("reconciliação dos dados processados", () => {
  for (const v of temDados ? reconciliar() : []) {
    if (v.bloqueia === false && !v.ok) it.skip(`${v.nome} (aviso: ${v.detalhe})`, () => {});
    else it(v.nome, () => expect(v.ok, v.detalhe).toBe(true));
  }
});
