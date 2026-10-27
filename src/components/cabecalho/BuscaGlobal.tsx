"use client";
import { Search } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

export function BuscaGlobal() {
  const r = useRouter();
  const sp = useSearchParams();
  const [q, setQ] = useState(sp.get("q") ?? "");
  return (
    <form
      role="search"
      onSubmit={(e) => {
        e.preventDefault();
        const t = q.trim();
        if (t.length < 2) return;
        const ano = sp.get("ano");
        r.push(`/busca?q=${encodeURIComponent(t)}${ano ? `&ano=${ano}` : ""}`);
      }}
      className="relative max-w-xl"
    >
      <label htmlFor="busca-global" className="sr-only">
        Buscar órgãos, estados, municípios, programas, emendas, empresas
      </label>
      <Search aria-hidden className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-white/50" />
      <input
        id="busca-global"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        maxLength={120}
        placeholder="Buscar órgão, estado, município, programa, emenda, empresa…"
        className="w-full rounded-md border border-white/15 bg-white/10 py-1.5 pl-8 pr-3 text-sm text-white placeholder:text-white/50 focus:bg-white/15"
      />
    </form>
  );
}
