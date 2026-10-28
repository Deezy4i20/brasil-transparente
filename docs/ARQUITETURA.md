# Arquitetura — Brasil Transparente

## Visão geral

```
            ┌──────────────────────── servidor (Next.js / Node) ────────────────────────┐
 Portal da  │  scripts/etl  ──►  data/agregados/<ano>/*.json  ──►  src/lib/dados/*      │
 Transpar.  │  (download ZIP     (cubos pré-agregados +           (motor de consulta,   │   navegador
 CSV/ZIP ──►│   oficial, CSV      manifesto de proveniência)       indicadores, mapa)  ─┼─► páginas (RSC)
            │   latin1 → cubo)                                                          │   + mapa SVG
 API REST ─►│  src/lib/portal/cliente  (token no servidor, limite 400/700 por min,      │   + gráficos
 (token)    │   cache TTL, novas tentativas, validação zod)  ──► rotas /api/*          ─┼─►
 IBGE ─────►│  scripts/geo  ──►  data/geo/*.topo.json (malhas simplificadas)            │
            └───────────────────────────────────────────────────────────────────────────┘
```

**Por que CSV + pré-agregação e não só a API?** A API devolve páginas pequenas e é limitada a 400 req/min (700 de madrugada). Totais por estado ou por órgão exigiriam milhares de páginas por consulta. A própria CGU recomenda os arquivos de dados abertos para volumes grandes. Então:

- **Agregações** (indicadores, mapa, rankings, séries): arquivos CSV oficiais → ETL → cubos em disco. O navegador nunca recebe registros brutos, só resultados agregados.
- **Detalhes pontuais e conferência** (contratos por órgão, convênios por UF, emendas): API ao vivo, pelo servidor.

**Por que sem banco na v0.1?** Os cubos de um ano cabem em poucos MB e são consultados em memória em milissegundos; isso roda em qualquer hospedagem Node (Vercel, VPS) sem infraestrutura extra. O modelo normalizado para PostgreSQL está em `db/schema.sql` e entra quando a busca por documento individual (milhões de linhas) for implementada.

## Pastas

| Caminho | Conteúdo |
|---|---|
| `src/app` | Páginas (App Router) e rotas `/api/*` |
| `src/components` | Mapa (`mapa/`), gráficos, cartões, filtros, proveniência |
| `src/lib/dados` | Tipos dos cubos, repositório (leitura do disco), motor de consulta, análises |
| `src/lib/portal` | Cliente da API (somente servidor), limitador, esquemas zod, endpoints |
| `src/lib/referencia` | UFs + população (Censo 2022), categorias cidadãs ↔ funções oficiais |
| `scripts/etl` | Download, leitura de CSV latin1 em streaming, processadores, manifesto |
| `scripts/geo` | Geração das malhas simplificadas (IBGE) |
| `scripts/gerar-demo.ts` | Dados de demonstração (fictícios, marcados) |
| `scripts/verificar-api.ts` | Confere endpoints e formatos com um token real |
| `data/geo` | Malhas TopoJSON (versionadas) |
| `data/agregados` | Saída do ETL (versionada; atualizada pelo GitHub Actions) |
| `db/schema.sql` | Modelo normalizado para a fase com banco |
| `tests` | Testes de cálculo, consulta, filtros, limitador, alertas e ETL ponta a ponta |

## Fontes → módulos

| Módulo | Arquivo oficial (download-de-dados) | Endpoint da API |
|---|---|---|
| Indicadores: orçamento atualizado, saldo | `orcamento-despesa/AAAA` | — |
| Indicadores: empenhado, liquidado, pago | `despesas-execucao/AAAAMM` | `/despesas/por-orgao`, `/despesas/por-funcional-programatica` (conferência) |
| Indicadores: transferências; mapa | `transferencias/AAAAMM` | — |
| Emendas; mapa | `emendas-parlamentares/UNICO` | `/emendas`, `/emendas/documentos/{codigo}` |
| Estado: convênios | — | `/convenios?uf=` |
| Contratos | `compras/AAAAMM` (próxima etapa) | `/contratos?codigoOrgao=`, `/contratos/cpf-cnpj`, `/contratos/termo-aditivo` |
| Licitações (planejado) | `licitacoes/AAAAMM` | `/licitacoes` |
| Favorecidos | `transferencias` (hoje), `despesas-favorecidos` (próxima) | `/despesas/recursos-recebidos` |
| Cartões e viagens (planejado) | `cpgf`, `viagens` | `/cartoes`, `/viagens` |
| Receitas e renúncias (planejado) | `receitas`, `renuncias` | `/renuncias-*` |
| Mapa | IBGE — API de malhas v3 | — |

Dicionários de dados usados para mapear as colunas: Orçamento da Despesa (603417), Execução da Despesa (603453), Recursos Transferidos (603420), Emendas Parlamentares (603482) — links em `scripts/etl/fontes.ts`.

## Regras de dados implementadas

1. **Etapas separadas.** Orçamento, empenhado, liquidado e pago são medidas distintas no cubo e nunca somadas.
2. **Fontes separadas.** Transferências, despesa localizada e emendas aparecem como três métricas do mapa, nunca somadas.
3. **Localização.** UF do favorecido (transferências), UF do plano de trabalho (execução), UF/município de destino (emendas). Sem UF reconhecível → `NI` (“localização não identificada”). Nunca a sede do órgão.
4. **Municípios.** Emendas: código IBGE. Execução e transferências: nome + UF casados com a malha do IBGE; sem correspondência → registrado como tal.
5. **Filtros não aplicáveis.** O motor de consulta devolve os filtros que a fonte não suporta; a interface mostra “não aplicável” em vez de ignorar em silêncio.
6. **Período comparável.** A variação usa exatamente os mesmos meses do ano anterior.
7. **Precisão.** Somas em centavos inteiros.
8. **Descartes registrados.** Cada linha descartada tem motivo contado no manifesto.
9. **Consistência entre fontes.** O ETL compara o empenhado da execução mensal com o empenhado do arquivo de orçamento e avisa se a diferença passar de 5%.
10. **Privacidade.** Favorecidos pessoa física não são listados individualmente.

## Riscos e limitações conhecidas

- **Formato dos arquivos não testado contra download real neste ambiente.** O ambiente de desenvolvimento não alcançava o Portal. As colunas seguem os dicionários oficiais e o ETL aceita variações (acentos, caixa, “(R$)”), falha com a lista de colunas encontradas se algo mudar, e foi testado com arquivos no formato oficial (latin1, `;`, ZIP com vários CSVs). Rode o primeiro ETL e confira `/fontes`.
- **Arquivos mensais de execução** são tratados como movimento do mês; a checagem de consistência acusa se forem acumulados.
- **Esquemas da API** são tolerantes (campos extras aceitos, valores “1.234,56” ou número). Rode `npm run verificar:api` com o token para conferir.
- **URL de download.** Usa a rota pública do Portal e, como alternativa, o servidor de arquivos da CGU.
- **Malhas.** Geradas a partir de espelhos derivados das malhas do IBGE (a API do IBGE não estava acessível no build); `npm run malhas` usa a API oficial quando acessível.
- **Contratos ativos** ainda não têm total nacional (depende do arquivo `compras` no ETL).
- **Projetos e obras** não são exibidos: programas/ações não são obras. Requer fonte com identificação individual (ex.: Obrasgov.br) — a documentar antes.

## Próximas etapas

1. Rodar o ETL com dados reais (2025 e 2026), conferir avisos e ajustar o que o dicionário não previu.
2. ETL de `compras` (contratos) e `licitacoes` → ranking de contratos, contratos ativos, alertas em lote.
3. `despesas-favorecidos` → módulo Empresas completo (pagamentos diretos).
4. PostgreSQL (`db/schema.sql`) + documentos de despesa para busca por registro.
5. Receitas, renúncias, cartões e viagens.
6. Agendamento diário do ETL (os arquivos de execução e transferências são atualizados diariamente).
