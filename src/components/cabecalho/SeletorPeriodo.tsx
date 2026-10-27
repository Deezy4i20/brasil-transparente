"use client";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

export function SeletorPeriodo({ anos }: { anos: number[] }) {
  const r = useRouter();
  const path = usePathname();
  const sp = useSearchParams();
  const ano = sp.get("ano") ?? String(anos[0]);
  const mi = sp.get("mi") ?? "1";
  const mf = sp.get("mf") ?? "12";

  function definir(k: string, v: string, padrao: string) {
    const q = new URLSearchParams(sp.toString());
    if (v === padrao) q.delete(k);
    else q.set(k, v);
    q.delete("pagina");
    r.push(`${path}${q.toString() ? `?${q}` : ""}`);
  }
  const sel = "rounded-md border border-white/15 bg-white/10 px-2 py-1 text-sm text-white [&>option]:text-tinta";
  return (
    <fieldset className="flex items-center gap-1.5 text-sm">
      <legend className="sr-only">Período</legend>
      <label className="sr-only" htmlFor="sel-ano">Ano</label>
      <select id="sel-ano" className={sel} value={ano} onChange={(e) => definir("ano", e.target.value, String(anos[0]))}>
        {anos.map((a) => (
          <option key={a} value={a}>{a}</option>
        ))}
      </select>
      <label className="sr-only" htmlFor="sel-mi">Mês inicial</label>
      <select id="sel-mi" className={sel} value={mi} onChange={(e) => definir("mi", e.target.value, "1")}>
        {MESES.map((m, i) => (
          <option key={m} value={i + 1}>{m}</option>
        ))}
      </select>
      <span className="text-white/50" aria-hidden>–</span>
      <label className="sr-only" htmlFor="sel-mf">Mês final</label>
      <select id="sel-mf" className={sel} value={mf} onChange={(e) => definir("mf", e.target.value, "12")}>
        {MESES.map((m, i) => (
          <option key={m} value={i + 1}>{m}</option>
        ))}
      </select>
    </fieldset>
  );
}
