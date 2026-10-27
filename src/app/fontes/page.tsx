import type { Metadata } from "next";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { SeloOrigem } from "@/components/Proveniencia";
import { manifesto, MODO_DEMONSTRACAO } from "@/lib/dados/repositorio";
import { statusConexao, tokenConfigurado } from "@/lib/portal/cliente";
import { FONTE_POPULACAO } from "@/lib/referencia/ufs";

export const metadata: Metadata = { title: "Fontes e método" };
export const dynamic = "force-dynamic";

const ENDPOINTS = [
  ["Painel, Quem gasta, Áreas", "Arquivo Orçamento da Despesa (anual)", "Orçamento inicial, atualizado, empenhado e realizado por órgão, função, programa, ação e grupo"],
  ["Painel, Quem gasta, Áreas, Mapa", "Arquivo Execução da Despesa (mensal)", "Empenhado, liquidado, pago e restos a pagar; UF/município do plano de trabalho"],
  ["Painel, Mapa, Estado, Favorecidos", "Arquivo Recursos Transferidos (mensal)", "Transferências por UF/município do favorecido, função, programa, tipo"],
  ["Emendas, Mapa, Estado", "Arquivo Emendas Parlamentares (único)", "Emendas por autor, destino (UF/município IBGE) e execução"],
  ["Estado (convênios)", "API GET /api-de-dados/convenios", "Convênios por UF e período — consulta ao vivo"],
  ["Contratos", "API GET /api-de-dados/contratos", "Contratos por órgão (SIAFI) e vigência — consulta ao vivo"],
  ["Conferência / futuro", "API /despesas/por-orgao, /despesas/por-funcional-programatica, /emendas, /orgaos-siafi", "Validação cruzada e detalhamento"],
  ["Mapa", "IBGE — malhas territoriais", "Limites de UFs e municípios (códigos IBGE)"],
  ["Valores por habitante", FONTE_POPULACAO.nome, "População por UF"],
];

function fmt(iso?: string | null) {
  return iso ? new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" }) : "—";
}

export default async function Fontes() {
  const m = manifesto();
  const api = await statusConexao();
  const geoArq = join(process.cwd(), "data", "geo", "manifest.json");
  const geo = existsSync(geoArq) ? (JSON.parse(readFileSync(geoArq, "utf8")) as { geradoEm: string; origens: Record<string, string> }) : null;
  const origensGeo = geo ? [...new Set(Object.values(geo.origens))] : [];

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="text-[22px] font-semibold">Fontes, método e situação dos dados</h1>
        <p className="text-[14px] text-tinta-2">Tudo o que aparece na plataforma pode ser rastreado até um arquivo ou consulta oficial. Esta página mostra quais fontes foram carregadas, quando, e com quais limitações.</p>
      </div>

      <section className="cartao p-4">
        <h2 className="mb-2 text-[17px] font-semibold">Situação agora</h2>
        <ul className="space-y-1.5 text-[14px]">
          <li><b>Modo:</b> {MODO_DEMONSTRACAO ? <><SeloOrigem origem="demonstracao" /> valores fictícios para desenvolvimento</> : "dados oficiais"}</li>
          <li><b>Agregados processados em:</b> {fmt(m?.geradoEm)}</li>
          <li><b>API do Portal (consultas ao vivo):</b> {tokenConfigurado() ? (api.ok ? "respondendo" : `com problema — ${api.mensagem}`) : "desativada (token não configurado no servidor)"}{api.verificadoEm && ` · verificado em ${fmt(api.verificadoEm)}`}</li>
          <li><b>Malhas territoriais:</b> {origensGeo.join("; ") || "não geradas"}</li>
        </ul>
      </section>

      <section className="cartao p-4">
        <h2 className="mb-2 text-[17px] font-semibold">Arquivos processados</h2>
        {!m?.conjuntos.length ? (
          <p className="text-sm text-tinta-3">Nenhum arquivo processado. Execute <code>npm run etl -- --ano AAAA</code>.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="tabela min-w-[720px]">
              <thead><tr><th>Conjunto</th><th>Ano</th><th>Meses</th><th className="valor">Linhas lidas</th><th className="valor">Descartadas</th><th>Processado</th><th>Avisos</th></tr></thead>
              <tbody>
                {m.conjuntos.sort((a, b) => b.ano - a.ano || a.conjunto.localeCompare(b.conjunto)).map((c) => (
                  <tr key={`${c.conjunto}-${c.ano}`}>
                    <td><a className="link" href={c.fonte.url} target="_blank" rel="noreferrer">{c.fonte.nome}</a>{c.fonte.dicionario && <> · <a className="link text-[12px]" href={c.fonte.dicionario} target="_blank" rel="noreferrer">dicionário</a></>}</td>
                    <td className="num">{c.ano}</td>
                    <td className="num">{c.mesesDisponiveis.length ? `${c.mesesDisponiveis[0]}–${c.mesesDisponiveis[c.mesesDisponiveis.length - 1]}` : "anual"}</td>
                    <td className="valor">{c.arquivos.reduce((s, a) => s + a.linhasLidas, 0).toLocaleString("pt-BR")}</td>
                    <td className="valor">{c.arquivos.reduce((s, a) => s + a.linhasDescartadas, 0).toLocaleString("pt-BR")}</td>
                    <td className="text-[12.5px]">{fmt(c.processadoEm)}</td>
                    <td className="text-[12.5px] text-tinta-2">{c.avisos.length ? <ul className="list-disc pl-4">{c.avisos.map((a) => <li key={a}>{a}</li>)}</ul> : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="cartao p-4">
        <h2 className="mb-2 text-[17px] font-semibold">Que fonte alimenta cada parte</h2>
        <div className="overflow-x-auto">
          <table className="tabela min-w-[640px]">
            <thead><tr><th>Onde aparece</th><th>Fonte</th><th>O que traz</th></tr></thead>
            <tbody>{ENDPOINTS.map(([a, b, c]) => <tr key={b}><td>{a}</td><td className="font-medium">{b}</td><td className="text-tinta-2">{c}</td></tr>)}</tbody>
          </table>
        </div>
      </section>

      <section className="cartao space-y-3 p-4 text-[14px] text-tinta-2">
        <h2 className="text-[17px] font-semibold text-tinta">Regras de cálculo</h2>
        <ul className="list-disc space-y-1.5 pl-5">
          <li><b>Etapas não são somadas.</b> Orçamento, empenhado, liquidado e pago são mostrados lado a lado, nunca adicionados entre si.</li>
          <li><b>Fontes diferentes não são somadas.</b> Transferências, despesa localizada e emendas se sobrepõem (uma emenda pode virar uma transferência, que também é um pagamento). Cada uma aparece separada.</li>
          <li><b>Localização.</b> Transferências usam a UF do favorecido; a execução usa a UF indicada no plano de trabalho; emendas usam a UF/município de destino. Nenhuma despesa é atribuída ao estado da sede do órgão. Sem UF confiável, o valor vai para “localização não identificada”.</li>
          <li><b>Municípios.</b> Emendas trazem o código IBGE. Transferências e execução trazem o nome: a associação é feita por nome + UF, e o que não casa fica como “sem correspondência”, sem chute.</li>
          <li><b>Período.</b> Arquivos mensais são somados nos meses selecionados que estão disponíveis. A comparação com o ano anterior usa exatamente os mesmos meses. O orçamento é anual e ignora o filtro de meses (avisado no indicador).</li>
          <li><b>Saldo disponível</b> = orçamento atualizado − empenhado, ambos do mesmo arquivo e mesma data de extração. Não considera contingenciamento.</li>
          <li><b>Por habitante</b> usa o Censo 2022 (IBGE). Valor maior por habitante não significa melhor resultado.</li>
          <li><b>Precisão.</b> Somas feitas em centavos inteiros para evitar erro de arredondamento.</li>
          <li><b>Privacidade.</b> Pessoas físicas favorecidas não são listadas individualmente; seus valores permanecem nos totais. Autores de emendas são agentes públicos e aparecem como publicados.</li>
          <li><b>Alertas.</b> Contratos podem receber alertas informativos com regra, dados e contexto. Alertas não indicam irregularidade.</li>
        </ul>
      </section>
    </div>
  );
}
