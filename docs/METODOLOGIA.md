# Metodologia dos números

Regras usadas pelo site publicado (`prototipo/modelo.template.html`, gerado por `scripts/exportar-modelo.ts`).
Cada regra tem a evidência que a sustenta e onde está testada. Revisado na auditoria de 28/10/2026.

## Fontes

| Conjunto | Fonte oficial | Periodicidade | Uso no site |
|---|---|---|---|
| Orçamento da Despesa | Portal da Transparência (CGU), download de dados | anual (fotografia na data do arquivo) | autorizado, saldo, programas |
| Execução da Despesa | Portal da Transparência (CGU) | mensal | empenhado, liquidado, pago, restos a pagar pagos, despesa localizada |
| Recursos Transferidos | Portal da Transparência (CGU) | mensal | transferências por estado, cidade, área e favorecido |
| Emendas Parlamentares | Portal da Transparência (CGU) | arquivo único | emendas por autor e destino |
| Convênios | Portal da Transparência (CGU) | arquivo diário (data no nome) | projetos por cidade |
| Contratos | Compras.gov.br, API de Dados Abertos (`modulo-contratos`) | consulta diária | contratos, empresas, órgãos |
| Licitações | Compras.gov.br, API de Dados Abertos (`modulo-contratacoes`, PNCP/Lei 14.133) | consulta diária | licitações e contratações diretas |
| Malhas municipais | IBGE, API de malhas (ou espelho, se a API estiver fora) | eventual | mapa e ligação de nomes de cidades a códigos IBGE |
| População | IBGE, Censo 2022 | fixa | valores por habitante |

## Estágios da despesa

- **Empenhado, liquidado e pago são etapas do mesmo gasto e nunca são somados.**
- Verificação (`scripts/auditoria/reconciliar.ts`): o empenhado do arquivo de Orçamento é igual ao empenhado da Execução, e o “realizado” do Orçamento é igual ao pago da Execução (2025 e 2026, diferença ≤ R$ 0,1 bi).
- Liquidado e pago ficam próximos no ano porque quase tudo que é conferido é pago em poucos dias. O que foi liquidado e não pago até 31/12 vira restos a pagar (em 2025: R$ 99 bi).
- **“Pago de fato”** é o pago do orçamento do próprio ano. **“Pago de anos anteriores”** (restos a pagar pagos) aparece separado. Os dois juntos são o que saiu do caixa no período.

## Transferências

- **Não são gasto adicional.** Ação por ação e nos mesmos meses, o valor transferido cabe dentro de pago + restos a pagar pagos da Execução (excesso de 0,06% em 2026 e 0,11% em 2025). Cerca de R$ 42 bi das transferências de jan–set/2026 são pagamentos de restos a pagar, por isso o texto diz “parte do que foi pago, deste ano ou de anos anteriores”.
- Soma por estado = soma por município = soma por favorecido (verificado).

## Dívida pública

- Nada é excluído do total oficial. A plataforma só **separa** as partes, a partir da ação orçamentária e do grupo de despesa:
  - **rolagem (refinanciamento)**: ações “Refinanciamento da Dívida Pública Mobiliária Federal Interna/Externa”. É o pagamento de títulos que vencem com dinheiro de títulos novos. Em jan–set/2026: R$ 1,29 tri (30% do pago).
  - **juros e amortização**: grupos de despesa 2 e 6, fora da rolagem (R$ 0,79 tri).
  - **demais despesas** (R$ 2,27 tri).
- O valor “por brasileiro” usa o pago **sem a rolagem**. Nas respostas por área, a rolagem aparece como uma linha própria, e o resto de “Encargos especiais” mantém o nome oficial.
- Regra em `src/lib/auditoria.ts` (`naturezaDivida`), testada em `tests/auditoria.test.ts`.

## Comparações entre anos

- Só se comparam **os mesmos meses**, e só se todos eles estiverem completos nos dois anos.
- **Mês incompleto**: o arquivo do mês em curso é baixado antes de o mês acabar (ex.: outubro/2026 baixado em 27/10). Ele fica fora do período padrão, dos gráficos e das comparações. O usuário pode incluí-lo, e nesse caso as comparações são desligadas. Regra: `mesCompleto` em `src/lib/auditoria.ts`.
- Variação = (atual − anterior) ÷ |anterior|. Com base zero, ausente ou não finita, não se mostra percentual (nunca NaN nem infinito). `variacao` em `src/lib/auditoria.ts` e a cópia na página são testadas juntas (`tests/template.test.ts`).
- **O orçamento atualizado não é comparado entre anos**: o de 2026 é uma fotografia no meio do ano e o de 2025 é o valor final.

## Localização

- Nenhuma despesa vai para o estado da sede do órgão. Sem estado confiável, fica como “localização não identificada”.
- **Cobertura da despesa localizada**: só cerca de 5% do valor pago em 2026 informa estado na fonte. O resto é sobretudo dívida, benefícios da Previdência e repasses obrigatórios. O mapa mostra a cobertura de cada leitura.
- Transferências: 59% do valor tem município identificado. Cerca de 36% são repasses a governos estaduais ou sem município na fonte. O restante tinha nome de cidade sem correspondência na malha, o que foi corrigido (veja abaixo).
- **Malhas**: a simplificação descartava 44 municípios, entre eles Rio de Janeiro, Vitória e Macaé. Por isso R$ 31 bi de transferências de 2026 ficavam sem cidade. Corrigido em `scripts/geo/build-malhas.ts`, que agora também falha se alguma feição se perder. A malha de espelho não tem os 6 municípios criados depois de 2010; a malha da API do IBGE tem os 5.570.

## Contratos e convênios

- Contratos: “valendo hoje” = início ≤ hoje ≤ fim. Valor = valor global informado pelo órgão; o “valor acumulado” só aparece quando é maior e não é interpretado como irregularidade.
- Os registros do tipo “Empenho” no Contratos.gov.br (R$ 2,8 tri em 204 mil registros) ficam fora da lista e da soma. Eles não são necessariamente compras pequenas; o detalhamento está em `contratos/resumo.json` (`auditoriaEmpenhos`).
- O local dos contratos é o da unidade que assinou, não o do serviço. Por isso os contratos não entram no mapa.
- Convênios: “falta repassar” é somado **convênio a convênio** (max(0, combinado − liberado)). 29 convênios têm liberado acima do combinado; o dicionário da CGU informa que os dois valores incluem rendimentos de aplicação (parcela 999).

## Limitações conhecidas

- População do Censo 2022 para todos os anos (o IBGE publica estimativas anuais mais recentes).
- O app Next.js (`src/`) não é o site publicado e não recebeu as regras desta revisão (rolagem, mês incompleto, restos a pagar).
- Andamento físico de obras, cartões, viagens, receitas e renúncias ainda não estão integrados.
