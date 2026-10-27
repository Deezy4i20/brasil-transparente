import Link from "next/link";
import { X, ArrowRight } from "lucide-react";
import { painelEstado } from "@/lib/dados/analises";
import { formatarBRL, formatarBRLCompacto } from "@/lib/dinheiro";
import { METRICAS, paraQuery, type Filtros } from "@/lib/filtros";
import { Proveniencia } from "./Proveniencia";
import { Ajuda, ListaBarras } from "./ui";
import { GraficoBarras } from "./graficos/GraficoBarras";
import { ConveniosAoVivo } from "./ConveniosAoVivo";

function Bloco({ titulo, ajuda, children }: { titulo: string; ajuda?: string; children: React.ReactNode }) {
  return (
    <section className="border-t border-borda pt-4">
      <h3 className="rotulo mb-2.5 flex items-center gap-1.5">
        {titulo} {ajuda && <Ajuda id={ajuda} />}
      </h3>
      {children}
    </section>
  );
}

export function PainelEstado({ f, sigla, completo = false }: { f: Filtros; sigla: string; completo?: boolean }) {
  const p = painelEstado(f, sigla);
  const q = (o: Record<string, string | undefined | null>) => paraQuery(f, o);
  const met = METRICAS[p.metrica];
  const fmt = formatarBRLCompacto;
  const demais = (d: number, n: number) => (n > 0 ? `+ ${n} outros: ${fmt(d)}` : undefined);

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="rotulo">{p.uf.regiao}</p>
          <h2 className="text-[22px] font-semibold leading-tight">{p.uf.nome}</h2>
          <p className="text-[12.5px] text-tinta-3">População: {p.uf.populacao.toLocaleString("pt-BR")} (Censo 2022)</p>
        </div>
        {!completo && (
          <Link href={`/${q({ uf: null })}`} className="botao h-8 w-8 justify-center p-0" aria-label="Fechar painel do estado" scroll={false}>
            <X aria-hidden className="h-4 w-4" />
          </Link>
        )}
      </div>

      <section aria-label="Recursos federais identificados no estado">
        <h3 className="rotulo mb-2">Recursos federais identificados</h3>
        <div className="grid gap-2">
          {p.resumoMetricas.map((m) => (
            <Link
              key={m.metrica}
              href={`${completo ? `/estado/${sigla}` : "/"}${q({ metrica: m.metrica === "transferencias" ? null : m.metrica })}`}
              scroll={false}
              className={`rounded-md border px-3 py-2 ${m.metrica === p.metrica ? "border-marinho/40 bg-marinho-claro" : "border-borda hover:bg-plano"}`}
            >
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-[13px] text-tinta-2">{m.rotulo}</span>
                <span className="num text-[16px] font-semibold">{m.disponivel ? fmt(m.valor) : "não disponível"}</span>
              </div>
              {m.disponivel && m.perCapita !== null && (
                <div className="num mt-0.5 flex justify-between text-[12px] text-tinta-3">
                  <span>{formatarBRL(m.perCapita)}/hab. · Brasil {formatarBRL(m.perCapitaBrasil)}/hab.</span>
                  <span>{m.posicao}º de 27</span>
                </div>
              )}
            </Link>
          ))}
        </div>
        <p className="mt-2 text-[12px] text-tinta-3">
          As três linhas vêm de fontes e critérios de localização diferentes e se sobrepõem: não as some.
        </p>
      </section>

      <Bloco titulo={`Principais áreas — ${met.curto.toLowerCase()}`} ajuda="funcao">
        {p.areas ? (
          <ListaBarras itens={p.areas.itens} formatar={fmt} hrefDe={(c) => `/areas${q({ funcao: c })}`} rodape={demais(p.areas.demais, p.areas.quantidadeDemais)} />
        ) : (
          <p className="text-sm text-tinta-3">Não disponível.</p>
        )}
      </Bloco>

      <Bloco titulo="Órgãos com despesa localizada no estado" ajuda="orgao-superior">
        {p.orgaos ? (
          <ListaBarras itens={p.orgaos.itens} formatar={fmt} hrefDe={(c) => `/orgaos/${c}${q({})}`} rodape={demais(p.orgaos.demais, p.orgaos.quantidadeDemais)} vazio="Nenhuma despesa com UF indicada no plano de trabalho." />
        ) : (
          <p className="text-sm text-tinta-3">Não disponível.</p>
        )}
        <p className="mt-2 text-[12px] text-tinta-3">Valor pago de despesas cujo plano de trabalho indica este estado (não a sede do órgão).</p>
      </Bloco>

      <Bloco titulo="Transferências recebidas, por tipo" ajuda="transferencia">
        {p.tiposTransf ? <ListaBarras itens={p.tiposTransf.itens} formatar={fmt} /> : <p className="text-sm text-tinta-3">Não disponível.</p>}
      </Bloco>

      <Bloco titulo={`Programas — ${met.curto.toLowerCase()}`} ajuda="programa">
        {p.programas ? <ListaBarras itens={p.programas.itens.map((x) => ({ ...x, sub: `Programa ${x.cod}` }))} formatar={fmt} rodape={demais(p.programas.demais, p.programas.quantidadeDemais)} /> : <p className="text-sm text-tinta-3">Não disponível.</p>}
        <p className="mt-2 text-[12px] text-tinta-3">Programas e ações orçamentárias não são obras individuais. Projetos só aparecem quando há vínculo comprovável nos dados.</p>
      </Bloco>

      <Bloco titulo="Principais favorecidos de transferências">
        {p.favorecidos ? (
          <ListaBarras itens={p.favorecidos.itens} formatar={fmt} hrefDe={() => undefined} rodape="Pessoas físicas não são listadas. Receber recursos públicos não indica irregularidade." />
        ) : (
          <p className="text-sm text-tinta-3">Não disponível.</p>
        )}
      </Bloco>

      <Bloco titulo="Emendas parlamentares com destino ao estado" ajuda="emenda-parlamentar">
        {p.emendas?.length ? (
          <ul className="space-y-2 text-[13px]">
            {p.emendas.map((e) => (
              <li key={`${e.codigo}-${e.municipio}`} className="flex items-baseline justify-between gap-3">
                <span className="min-w-0">
                  <Link className="link" href={`/emendas${q({ q: e.codigo, uf: sigla })}`}>Emenda {e.numero}</Link>
                  <span className="block truncate text-[12px] text-tinta-3">{e.autor} · {e.municipio}</span>
                </span>
                <span className="num shrink-0 text-right">
                  <span className="font-semibold">{fmt(e.pago)}</span>
                  <span className="block text-[11.5px] text-tinta-3">pago de {fmt(e.empenhado)} empenhado</span>
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-tinta-3">{p.emendas ? "Nenhuma emenda para os filtros." : "Não disponível."}</p>
        )}
      </Bloco>

      {p.mensal && (
        <Bloco titulo={`Histórico mensal — ${met.curto.toLowerCase()}, ${f.ano}`}>
          <GraficoBarras dados={p.mensal.map((m) => ({ rotulo: m.rotulo, valor: m.valor }))} rotulo={met.rotulo} descricao={`${met.rotulo} em ${p.uf.nome} por mês de ${f.ano}.`} altura={170} />
        </Bloco>
      )}
      {p.anual.length > 1 && (
        <Bloco titulo={`Histórico anual — ${met.curto.toLowerCase()}`}>
          <GraficoBarras dados={p.anual.map((a) => ({ rotulo: String(a.ano), valor: a.valor }))} rotulo={met.rotulo} descricao={`${met.rotulo} em ${p.uf.nome} por ano.`} altura={150} />
          <p className="text-[12px] text-tinta-3">Anos incompletos aparecem com o acumulado disponível até o último mês publicado.</p>
        </Bloco>
      )}

      {completo && (
        <Bloco titulo="Convênios e acordos no estado (consulta ao vivo)" ajuda="convenio">
          <ConveniosAoVivo uf={sigla} ano={f.ano} />
        </Bloco>
      )}

      <div className="border-t border-borda pt-3">
        <Proveniencia p={p.proveniencia} />
      </div>
      {!completo && (
        <Link href={`/estado/${sigla}${q({ uf: null })}`} className="botao-primario w-full justify-center">
          Abrir página completa do estado <ArrowRight aria-hidden className="h-4 w-4" />
        </Link>
      )}
    </div>
  );
}
