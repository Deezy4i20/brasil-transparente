"use client";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { formatarBRLCompacto } from "@/lib/dinheiro";

interface Item {
  id: number;
  numero: string;
  objeto: string;
  situacao: string;
  convenente: string;
  municipio: string;
  valor: number | null;
  valorLiberado: number | null;
  vigencia: string;
  link: string;
}

/** Consulta a API do Portal (via rota do servidor) — exige token configurado no servidor. */
export function ConveniosAoVivo({ uf, ano }: { uf: string; ano: number }) {
  const [estado, setEstado] = useState<{ carregando: boolean; erro?: string; itens?: Item[]; consultadoEm?: string; url?: string }>({ carregando: true });
  useEffect(() => {
    const c = new AbortController();
    fetch(`/api/convenios?uf=${uf}&ano=${ano}`, { signal: c.signal })
      .then(async (r) => {
        const j = await r.json();
        if (!r.ok) throw new Error(j.erro ?? "Falha na consulta.");
        setEstado({ carregando: false, itens: j.itens, consultadoEm: j.consultadoEm, url: j.fonte });
      })
      .catch((e) => e.name !== "AbortError" && setEstado({ carregando: false, erro: e.message }));
    return () => c.abort();
  }, [uf, ano]);

  if (estado.carregando)
    return (
      <p className="flex items-center gap-2 text-sm text-tinta-3">
        <Loader2 aria-hidden className="h-4 w-4 animate-spin" /> Consultando a API do Portal da Transparência…
      </p>
    );
  if (estado.erro) return <p className="rounded-md border border-dashed border-borda p-3 text-[13px] text-tinta-2">{estado.erro}</p>;
  if (!estado.itens?.length) return <p className="text-sm text-tinta-3">Nenhum convênio retornado para o período.</p>;
  return (
    <div>
      <ul className="space-y-2.5 text-[13px]">
        {estado.itens.map((i) => (
          <li key={i.id} className="rounded-md border border-borda p-2.5">
            <div className="flex items-baseline justify-between gap-2">
              <a className="link font-medium" href={i.link} target="_blank" rel="noreferrer">Convênio {i.numero}</a>
              <span className="num font-semibold">{formatarBRLCompacto(i.valor)}</span>
            </div>
            <p className="line-clamp-2 text-tinta-2">{i.objeto || "Objeto não informado"}</p>
            <p className="text-[12px] text-tinta-3">
              {i.convenente} · {i.municipio} · {i.situacao} · vigência {i.vigencia} · liberado {formatarBRLCompacto(i.valorLiberado)}
            </p>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-[12px] text-tinta-3">
        Fonte: API do Portal da Transparência, endpoint /convenios, consultado em {estado.consultadoEm ? new Date(estado.consultadoEm).toLocaleString("pt-BR") : "—"}. Primeira página de resultados.
      </p>
    </div>
  );
}
