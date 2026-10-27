"use client";
import { geoMercator, geoPath, type GeoPermissibleObjects } from "d3-geo";
import { select } from "d3-selection";
import "d3-transition";
import { zoom as d3zoom, zoomIdentity, type ZoomBehavior } from "d3-zoom";
import { feature } from "topojson-client";
import type { Topology, GeometryCollection } from "topojson-specification";
import type { Feature, FeatureCollection, Geometry } from "geojson";
import { Minus, Plus, RotateCcw, Table2, Map as IconeMapa, Loader2 } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import topoUfs from "../../../data/geo/ufs.topo.json";
import { formatarBRL, formatarBRLCompacto } from "@/lib/dinheiro";

export interface DadoUF {
  sigla: string;
  cod: number;
  nome: string;
  regiao: string;
  valor: number;
  perCapita: number;
  posicao: number;
  populacao: number;
}
interface DadoMun {
  cod: string;
  nome: string;
  valor: number;
  identificado: boolean;
}

/** Rampa sequencial azul (claro → escuro), validada para contraste; “sem registro” em cinza neutro. */
const RAMPA = ["#cde2fb", "#9ec5f4", "#5598e7", "#256abf", "#0d366b"];
const SEM_DADO = "#eceef2";

function quebrasQuantil(valores: number[], n = RAMPA.length): number[] {
  const v = valores.filter((x) => x > 0).sort((a, b) => a - b);
  if (!v.length) return [];
  const q: number[] = [];
  for (let i = 1; i < n; i++) q.push(v[Math.min(v.length - 1, Math.floor((i / n) * v.length))]);
  return q;
}
function corPara(v: number, quebras: number[]): string {
  if (!(v > 0) || !quebras.length) return SEM_DADO;
  let i = 0;
  while (i < quebras.length && v >= quebras[i]) i++;
  return RAMPA[i];
}

const L = 860;
const A = 760;

export function MapaBrasil({
  dados,
  modo,
  selecionada,
  regiaoDestaque,
  detalharMunicipios = false,
  rotuloMetrica,
  naoIdentificado,
  consultaMunicipios,
  municipioDestaque,
}: {
  dados: DadoUF[];
  modo: "absoluto" | "per_capita";
  selecionada?: string;
  regiaoDestaque?: string;
  detalharMunicipios?: boolean;
  rotuloMetrica: string;
  naoIdentificado: number;
  /** query string usada para buscar /api/municipios */
  consultaMunicipios?: string;
  municipioDestaque?: string;
}) {
  const r = useRouter();
  const path = usePathname();
  const sp = useSearchParams();
  const svgRef = useRef<SVGSVGElement>(null);
  const gRef = useRef<SVGGElement>(null);
  const zoomRef = useRef<ZoomBehavior<SVGSVGElement, unknown> | null>(null);
  const [dica, setDica] = useState<{ x: number; y: number; titulo: string; linhas: string[] } | null>(null);
  const [comoTabela, setComoTabela] = useState(false);
  const [mun, setMun] = useState<{ geo: FeatureCollection; dados: Map<string, DadoMun>; semId: number } | null>(null);
  const [carregandoMun, setCarregandoMun] = useState(false);
  const [erroMun, setErroMun] = useState<string | null>(null);

  const ufs = useMemo(() => {
    const t = topoUfs as unknown as Topology;
    const obj = Object.values(t.objects)[0] as GeometryCollection;
    return feature(t, obj) as unknown as FeatureCollection<Geometry, { cod: number }>;
  }, []);
  const proj = useMemo(() => geoMercator().fitExtent([[10, 10], [L - 10, A - 10]], ufs as unknown as GeoPermissibleObjects), [ufs]);
  const caminho = useMemo(() => geoPath(proj), [proj]);
  const porCod = useMemo(() => new Map(dados.map((d) => [d.cod, d])), [dados]);
  const chave = modo === "per_capita" ? "perCapita" : "valor";
  const quebras = useMemo(() => quebrasQuantil(dados.map((d) => d[chave])), [dados, chave]);
  const fmt = (v: number) => (modo === "per_capita" ? `${formatarBRL(v)}/hab.` : formatarBRLCompacto(v));
  const codSel = dados.find((d) => d.sigla === selecionada)?.cod;

  // Zoom/arrasto
  useEffect(() => {
    if (!svgRef.current || !gRef.current) return;
    const z = d3zoom<SVGSVGElement, unknown>()
      .scaleExtent([1, 40])
      .translateExtent([[-200, -200], [L + 200, A + 200]])
      .on("zoom", (e) => {
        select(gRef.current).attr("transform", e.transform.toString());
        select(gRef.current).style("--k", String(e.transform.k));
      });
    zoomRef.current = z;
    select(svgRef.current).call(z).on("dblclick.zoom", null);
  }, []);

  // Enquadra a UF selecionada
  useEffect(() => {
    const svg = svgRef.current;
    const z = zoomRef.current;
    if (!svg || !z) return;
    const f = ufs.features.find((x) => x.properties.cod === codSel);
    if (!f || !detalharMunicipios) {
      select(svg).transition().duration(400).call(z.transform, zoomIdentity);
      return;
    }
    const [[x0, y0], [x1, y1]] = caminho.bounds(f as GeoPermissibleObjects);
    const k = Math.min(30, 0.85 / Math.max((x1 - x0) / L, (y1 - y0) / A));
    const t = zoomIdentity.translate(L / 2, A / 2).scale(k).translate(-(x0 + x1) / 2, -(y0 + y1) / 2);
    select(svg).transition().duration(500).call(z.transform, t);
  }, [codSel, detalharMunicipios, ufs, caminho]);

  // Detalhamento municipal
  useEffect(() => {
    if (!detalharMunicipios || !codSel || !consultaMunicipios) {
      setMun(null);
      return;
    }
    const ctrl = new AbortController();
    setCarregandoMun(true);
    setErroMun(null);
    Promise.all([
      fetch(`/api/geo/municipios/${codSel}`, { signal: ctrl.signal }).then((x) => (x.ok ? x.json() : Promise.reject(new Error("malha")))),
      fetch(`/api/municipios${consultaMunicipios}`, { signal: ctrl.signal }).then((x) => (x.ok ? x.json() : Promise.reject(new Error("dados")))),
    ])
      .then(([topo, res]: [Topology, { itens: DadoMun[] }]) => {
        const obj = Object.values(topo.objects)[0] as GeometryCollection;
        const geo = feature(topo, obj) as unknown as FeatureCollection;
        const m = new Map<string, DadoMun>();
        let semId = 0;
        for (const it of res.itens) {
          if (it.identificado) m.set(it.cod, it);
          else semId += it.valor;
        }
        setMun({ geo, dados: m, semId });
      })
      .catch((e) => e.name !== "AbortError" && setErroMun("Não foi possível carregar o detalhamento municipal."))
      .finally(() => setCarregandoMun(false));
    return () => ctrl.abort();
  }, [detalharMunicipios, codSel, consultaMunicipios]);

  const quebrasMun = useMemo(() => (mun ? quebrasQuantil([...mun.dados.values()].map((d) => d.valor)) : []), [mun]);

  function selecionar(sigla: string | null) {
    const q = new URLSearchParams(sp.toString());
    if (sigla && sigla !== selecionada) {
      q.set("uf", sigla);
      q.delete("regiao");
    } else q.delete("uf");
    q.delete("mun");
    r.push(`${path}${q.toString() ? `?${q}` : ""}`, { scroll: false });
  }
  function zoomPor(f: number) {
    if (svgRef.current && zoomRef.current) select(svgRef.current).transition().duration(250).call(zoomRef.current.scaleBy, f);
  }
  function mostrar(e: React.MouseEvent | React.FocusEvent, titulo: string, linhas: string[]) {
    const box = svgRef.current!.parentElement!.getBoundingClientRect();
    let x: number, y: number;
    if ("clientX" in e) {
      x = e.clientX - box.left;
      y = e.clientY - box.top;
    } else {
      const b = (e.target as Element).getBoundingClientRect();
      x = b.left + b.width / 2 - box.left;
      y = b.top - box.top;
    }
    setDica({ x, y, titulo, linhas });
  }

  const legenda = (q: number[], f: (v: number) => string) =>
    q.length ? (
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11.5px] text-tinta-2">
        {RAMPA.map((c, i) => (
          <span key={c} className="flex items-center gap-1">
            <span aria-hidden className="h-2.5 w-4 rounded-sm" style={{ background: c }} />
            {i === 0 ? `até ${f(q[0])}` : i === RAMPA.length - 1 ? `≥ ${f(q[q.length - 1])}` : `${f(q[i - 1])}–${f(q[i])}`}
          </span>
        ))}
        <span className="flex items-center gap-1">
          <span aria-hidden className="h-2.5 w-4 rounded-sm border border-borda" style={{ background: SEM_DADO }} />
          sem registro
        </span>
      </div>
    ) : null;

  const ordenados = [...dados].sort((a, b) => a.posicao - b.posicao);

  return (
    <div className="relative">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        {mun ? legenda(quebrasMun, formatarBRLCompacto) : legenda(quebras, fmt)}
        <button type="button" className="botao text-[12.5px]" onClick={() => setComoTabela((t) => !t)} aria-pressed={comoTabela}>
          {comoTabela ? <IconeMapa aria-hidden className="h-4 w-4" /> : <Table2 aria-hidden className="h-4 w-4" />}
          {comoTabela ? "Ver mapa" : "Ver como tabela"}
        </button>
      </div>

      {comoTabela ? (
        <div className="max-h-[560px] overflow-auto rounded-md border border-borda">
          <table className="tabela">
            <caption className="sr-only">{rotuloMetrica} por estado</caption>
            <thead className="sticky top-0 bg-superficie">
              <tr>
                <th>#</th>
                <th>Estado</th>
                <th className="valor">Valor</th>
                <th className="valor">Por habitante</th>
              </tr>
            </thead>
            <tbody>
              {ordenados.map((d) => (
                <tr key={d.sigla} className={d.sigla === selecionada ? "bg-marinho-claro" : ""}>
                  <td className="num text-tinta-3">{d.posicao}</td>
                  <td>
                    <button type="button" className="link text-left" onClick={() => selecionar(d.sigla)}>
                      {d.nome}
                    </button>
                  </td>
                  <td className="valor">{formatarBRLCompacto(d.valor)}</td>
                  <td className="valor">{formatarBRL(d.perCapita)}</td>
                </tr>
              ))}
              <tr>
                <td />
                <td className="text-tinta-3">Localização não identificada</td>
                <td className="valor text-tinta-3">{formatarBRLCompacto(naoIdentificado)}</td>
                <td className="valor text-tinta-3">—</td>
              </tr>
            </tbody>
          </table>
        </div>
      ) : (
        <div className="relative overflow-hidden rounded-md bg-[#f8fafc]" onMouseLeave={() => setDica(null)}>
          <svg
            ref={svgRef}
            viewBox={`0 0 ${L} ${A}`}
            className="block h-auto w-full touch-none select-none"
            role="group"
            aria-label={`Mapa do Brasil: ${rotuloMetrica} por estado. Use Tab para percorrer os estados e Enter para selecionar.`}
          >
            <g ref={gRef}>
              {ufs.features.map((f: Feature<Geometry, { cod: number }>) => {
                const d = porCod.get(f.properties.cod);
                const sel = f.properties.cod === codSel;
                const esmaecido = (regiaoDestaque && d?.regiao !== regiaoDestaque) || (mun && !sel);
                const fill = mun ? (sel ? "#ffffff" : "#eef1f5") : d ? corPara(d[chave], quebras) : SEM_DADO;
                return (
                  <path
                    key={f.properties.cod}
                    d={caminho(f as GeoPermissibleObjects) ?? ""}
                    fill={fill}
                    fillOpacity={esmaecido && !mun ? 0.35 : 1}
                    stroke={sel ? "#0b1220" : "#ffffff"}
                    strokeWidth={sel ? 2.2 : 1}
                    vectorEffect="non-scaling-stroke"
                    tabIndex={0}
                    role="button"
                    aria-pressed={sel}
                    aria-label={d ? `${d.nome}: ${fmt(d[chave])}, ${d.posicao}º lugar` : "Estado sem dados"}
                    className="cursor-pointer outline-none transition-[fill-opacity] hover:fill-opacity-80 focus-visible:stroke-[#2a78d6]"
                    onClick={() => d && selecionar(d.sigla)}
                    onKeyDown={(e) => {
                      if ((e.key === "Enter" || e.key === " ") && d) {
                        e.preventDefault();
                        selecionar(d.sigla);
                      }
                    }}
                    onMouseMove={(e) =>
                      d && !mun && mostrar(e, d.nome, [`${rotuloMetrica}: ${formatarBRLCompacto(d.valor)}`, `Por habitante: ${formatarBRL(d.perCapita)}`, `${d.posicao}º de 27 (${modo === "per_capita" ? "por habitante" : "valor absoluto"})`])
                    }
                    onFocus={(e) => d && mostrar(e, d.nome, [`${rotuloMetrica}: ${formatarBRLCompacto(d.valor)}`, `Por habitante: ${formatarBRL(d.perCapita)}`])}
                    onBlur={() => setDica(null)}
                  />
                );
              })}
              {mun &&
                mun.geo.features.map((f) => {
                  const cod = String((f.properties as { cod: number }).cod);
                  const d = mun.dados.get(cod);
                  const nome = d?.nome ?? (f.properties as { nome?: string }).nome ?? cod;
                  const dest = cod === municipioDestaque;
                  return (
                    <path
                      key={cod}
                      d={caminho(f as GeoPermissibleObjects) ?? ""}
                      fill={d ? corPara(d.valor, quebrasMun) : SEM_DADO}
                      stroke={dest ? "#0b1220" : "#ffffff"}
                      strokeWidth={dest ? 2 : 0.5}
                      vectorEffect="non-scaling-stroke"
                      onMouseMove={(e) => mostrar(e, nome, [d ? `${rotuloMetrica}: ${formatarBRLCompacto(d.valor)}` : "Sem registro no período"])}
                    >
                      <title>{`${nome}: ${d ? formatarBRL(d.valor) : "sem registro"}`}</title>
                    </path>
                  );
                })}
            </g>
          </svg>

          {dica && (
            <div
              role="status"
              className="pointer-events-none absolute z-20 min-w-[180px] -translate-x-1/2 -translate-y-[calc(100%+12px)] rounded-md bg-tinta px-3 py-2 text-[12.5px] text-white shadow-lg"
              style={{ left: dica.x, top: dica.y }}
            >
              <div className="font-semibold">{dica.titulo}</div>
              {dica.linhas.map((l) => (
                <div key={l} className="num text-white/85">{l}</div>
              ))}
            </div>
          )}

          <div className="absolute right-2 top-2 flex flex-col gap-1">
            <button type="button" className="botao h-8 w-8 justify-center p-0" aria-label="Aproximar" onClick={() => zoomPor(1.6)}>
              <Plus aria-hidden className="h-4 w-4" />
            </button>
            <button type="button" className="botao h-8 w-8 justify-center p-0" aria-label="Afastar" onClick={() => zoomPor(1 / 1.6)}>
              <Minus aria-hidden className="h-4 w-4" />
            </button>
            <button
              type="button"
              className="botao h-8 w-8 justify-center p-0"
              aria-label="Ver Brasil inteiro"
              onClick={() => (selecionada ? selecionar(null) : svgRef.current && zoomRef.current && select(svgRef.current).transition().call(zoomRef.current.transform, zoomIdentity))}
            >
              <RotateCcw aria-hidden className="h-4 w-4" />
            </button>
          </div>
          {carregandoMun && (
            <div className="absolute left-3 top-3 flex items-center gap-2 rounded-md bg-superficie px-2.5 py-1.5 text-[12.5px] shadow">
              <Loader2 aria-hidden className="h-4 w-4 animate-spin" /> Carregando municípios…
            </div>
          )}
          {erroMun && <div className="absolute left-3 top-3 rounded-md bg-superficie px-2.5 py-1.5 text-[12.5px] text-critico shadow">{erroMun}</div>}
        </div>
      )}

      <p className="mt-2 text-[12px] text-tinta-3">
        Fora do mapa — <b>localização não identificada</b>: <span className="num font-semibold text-tinta-2">{formatarBRLCompacto(naoIdentificado)}</span>
        {mun && mun.semId > 0 && (
          <>
            {" "}· no estado, sem município identificado: <span className="num font-semibold text-tinta-2">{formatarBRLCompacto(mun.semId)}</span>
          </>
        )}
        . Despesas sem estado confiável não são atribuídas à sede do órgão.
      </p>
    </div>
  );
}
