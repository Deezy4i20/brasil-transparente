/** Glossário em linguagem simples. Usado na página /glossario e nos ícones de ajuda. */
export interface Termo {
  id: string;
  termo: string;
  curto: string;
  explicacao: string;
  exemplo?: string;
}

export const GLOSSARIO: Termo[] = [
  {
    id: "orcamento-autorizado",
    termo: "Orçamento autorizado (atualizado)",
    curto: "O limite de gastos aprovado para o ano, com os ajustes feitos ao longo dele.",
    explicacao:
      "A lei orçamentária define quanto cada órgão pode gastar e em quê. Durante o ano, créditos adicionais e remanejamentos mudam esses limites: o resultado é o orçamento atualizado. É uma autorização para gastar, não dinheiro gasto.",
    exemplo: "Um ministério com R$ 10 bi de orçamento atualizado pode terminar o ano tendo pago R$ 8 bi.",
  },
  {
    id: "empenho",
    termo: "Empenho",
    curto: "O governo reserva parte do orçamento para uma despesa específica.",
    explicacao:
      "É a primeira etapa da despesa: cria a obrigação de pagamento depois que a condição for cumprida (por exemplo, a entrega de um produto). O valor empenhado deixa de estar disponível para outros gastos.",
  },
  {
    id: "liquidacao",
    termo: "Liquidação",
    curto: "Verificação de que o bem foi entregue ou o serviço foi prestado.",
    explicacao:
      "Segunda etapa: a administração confere documentos e condições e reconhece que o credor tem direito a receber. Só depois disso o pagamento pode ser feito.",
  },
  {
    id: "pagamento",
    termo: "Pagamento",
    curto: "O dinheiro sai efetivamente do caixa para o credor.",
    explicacao:
      "Última etapa da despesa. Empenhado, liquidado e pago são fases do MESMO gasto: somar os três contaria o mesmo dinheiro até três vezes.",
  },
  {
    id: "restos-a-pagar",
    termo: "Restos a pagar",
    curto: "Despesas empenhadas que ficaram sem pagamento no fim do ano.",
    explicacao:
      "Passam para o ano seguinte e podem ser pagas ou canceladas. Pagamentos de restos a pagar não aparecem no indicador “Pago” do ano corrente nesta plataforma; são informados à parte.",
  },
  {
    id: "saldo-orcamentario",
    termo: "Saldo disponível para empenho",
    curto: "Parte do orçamento atualizado que ainda não foi comprometida.",
    explicacao:
      "Calculado como orçamento atualizado menos valor empenhado. Não considera bloqueios (contingenciamentos), então nem todo o saldo está necessariamente liberado para uso.",
  },
  {
    id: "transferencia",
    termo: "Transferência",
    curto: "Recurso federal repassado a outro ente, entidade ou cidadão.",
    explicacao:
      "Inclui repasses obrigatórios (como os fundos de participação de estados e municípios), repasses por convênios e programas, e pagamentos diretos a cidadãos. O valor aparece pelo local do favorecido, que pode ser diferente de onde o recurso é usado.",
  },
  {
    id: "emenda-parlamentar",
    termo: "Emenda parlamentar",
    curto: "Indicação de deputados e senadores para direcionar parte do orçamento.",
    explicacao:
      "A emenda altera ou direciona recursos do orçamento. Autoria, indicação do destino, execução (empenho, liquidação, pagamento) e recebimento pelo beneficiário são etapas diferentes, com responsáveis diferentes.",
  },
  {
    id: "contrato",
    termo: "Contrato",
    curto: "Instrumento que formaliza obrigações entre o governo e um fornecedor.",
    explicacao:
      "Define objeto, valor, prazo de vigência e condições. Pode ser alterado por termos aditivos (prazo, valor, escopo), dentro dos limites da lei.",
  },
  {
    id: "convenio",
    termo: "Convênio",
    curto: "Acordo para repassar recursos a estados, municípios ou entidades executarem algo em parceria.",
    explicacao: "O convenente executa o objeto acordado (uma obra, um serviço) e presta contas ao órgão concedente.",
  },
  {
    id: "renuncia-fiscal",
    termo: "Renúncia fiscal",
    curto: "Receita que o governo deixa de arrecadar por conceder benefícios tributários.",
    explicacao: "Valores geralmente são estimativas da Receita Federal, conforme metodologia própria; não são gastos efetivos.",
  },
  {
    id: "funcao",
    termo: "Função (área de atuação)",
    curto: "A grande área de governo a que a despesa se destina, como Saúde ou Educação.",
    explicacao: "É a classificação funcional oficial, comum a União, estados e municípios. Esta plataforma usa os nomes e códigos oficiais.",
  },
  {
    id: "programa",
    termo: "Programa",
    curto: "Conjunto de ações do governo voltadas a um objetivo.",
    explicacao: "Os programas organizam o orçamento por resultados esperados. Cada programa se divide em ações orçamentárias.",
  },
  {
    id: "acao",
    termo: "Ação orçamentária",
    curto: "Operação que entrega bens ou serviços dentro de um programa.",
    explicacao:
      "Uma ação não é uma obra individual: uma mesma ação pode financiar centenas de projetos. Por isso esta plataforma só chama algo de “projeto” quando há vínculo comprovável nos dados.",
  },
  {
    id: "orgao-superior",
    termo: "Órgão superior",
    curto: "O ministério ou equivalente que responde pela despesa.",
    explicacao: "Abaixo dele ficam órgãos subordinados (autarquias, fundações, secretarias) e as unidades gestoras que executam os gastos.",
  },
  {
    id: "natureza-despesa",
    termo: "Natureza da despesa (grupo)",
    curto: "O tipo de gasto: pessoal, custeio, investimento, dívida…",
    explicacao: "Grupos oficiais: 1 Pessoal e encargos, 2 Juros e encargos da dívida, 3 Outras despesas correntes, 4 Investimentos, 5 Inversões financeiras, 6 Amortização da dívida.",
  },
  {
    id: "per-capita",
    termo: "Valor por habitante",
    curto: "Valor dividido pela população (Censo 2022 do IBGE).",
    explicacao: "Ajuda a comparar estados de tamanhos diferentes. Gastar mais por habitante não significa, por si só, melhor resultado: custos, responsabilidades e contexto variam.",
  },
  {
    id: "localizacao-nao-identificada",
    termo: "Localização não identificada",
    curto: "Registros sem estado ou município confiável na fonte.",
    explicacao:
      "Muitas despesas federais são de abrangência nacional. A plataforma não as atribui ao estado da sede do órgão: elas ficam neste grupo, para que nenhum estado receba valores que não são dele.",
  },
];

export const termo = (id: string) => GLOSSARIO.find((t) => t.id === id);
