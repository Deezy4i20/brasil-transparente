"use client";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

export const MODULOS = [
  { href: "/", rotulo: "Painel" },
  { href: "/mapa", rotulo: "Para onde vai" },
  { href: "/orgaos", rotulo: "Quem gasta" },
  { href: "/areas", rotulo: "Com o que se gasta" },
  { href: "/emendas", rotulo: "Emendas" },
  { href: "/favorecidos", rotulo: "Favorecidos" },
  { href: "/contratos", rotulo: "Contratos" },
  { href: "/modulos", rotulo: "Mais módulos" },
  { href: "/glossario", rotulo: "Glossário" },
  { href: "/fontes", rotulo: "Fontes e método" },
];

/** Mantém os filtros globais ao trocar de módulo. */
const GLOBAIS = ["ano", "mi", "mf", "regiao", "uf", "funcao", "orgao", "programa", "grupo", "metrica", "modo"];

export function Navegacao() {
  const path = usePathname();
  const sp = useSearchParams();
  const q = new URLSearchParams();
  for (const k of GLOBAIS) {
    const v = sp.get(k);
    if (v) q.set(k, v);
  }
  const sufixo = q.toString() ? `?${q}` : "";
  return (
    <nav aria-label="Módulos" className="border-t border-white/10">
      <ul className="mx-auto flex max-w-[1400px] gap-1 overflow-x-auto px-3 md:px-5 [scrollbar-width:none]">
        {MODULOS.map((m) => {
          const ativo = m.href === "/" ? path === "/" : path.startsWith(m.href) || (m.href === "/mapa" && path.startsWith("/estado"));
          return (
            <li key={m.href} className="shrink-0">
              <Link
                href={`${m.href}${["/glossario", "/modulos"].includes(m.href) ? "" : sufixo}`}
                aria-current={ativo ? "page" : undefined}
                className={`block border-b-2 px-2.5 py-2 text-[13.5px] ${ativo ? "border-white font-semibold text-white" : "border-transparent text-white/70 hover:text-white"}`}
              >
                {m.rotulo}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
