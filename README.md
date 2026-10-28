# Brasil Transparente

Plataforma visual para explorar os gastos públicos federais brasileiros com dados oficiais do [Portal da Transparência](https://portaldatransparencia.gov.br/) (CGU) e do IBGE — com fonte, período e metodologia visíveis em cada número.

- **Painel**: orçamento atualizado, empenhado, liquidado, pago, saldo, transferências, com variação no mesmo período do ano anterior.
- **Mapa do Brasil**: estados e municípios, três leituras territoriais separadas (destino das transferências, localidade do plano de trabalho, destino das emendas), total ou por habitante, zoom, teclado e alternativa em tabela.
- **Estado**: áreas, órgãos, transferências, programas, favorecidos, emendas, histórico mensal e anual, convênios ao vivo.
- **Quem gasta** (órgãos → unidades, programas, ações, natureza), **Com o que se gasta** (funções oficiais + categorias), **Emendas**, **Favorecidos**, **Contratos** (API ao vivo, com alertas explicáveis), **Busca global**, **Glossário**, **Fontes e método**.

Arquitetura, fontes por módulo, regras e riscos: [`docs/ARQUITETURA.md`](docs/ARQUITETURA.md).

## Requisitos

- Node.js 20 ou superior
- Acesso à internet a `portaldatransparencia.gov.br` (e `dadosabertos-download.cgu.gov.br`) para o ETL
- Opcional: token gratuito da API do Portal, para as consultas ao vivo

## Instalação

```bash
npm install
cp .env.example .env.local      # edite e coloque o token, se tiver
```

O token é obtido em <https://portaldatransparencia.gov.br/api-de-dados/cadastrar-email>. Ele fica só no servidor (`PORTAL_TRANSPARENCIA_TOKEN`) — nunca use prefixo `NEXT_PUBLIC_`.

## Carregar os dados oficiais

```bash
npm run etl -- --ano 2025                 # orçamento, execução (12 meses), transferências, emendas
npm run etl -- --ano 2026 --meses 1-9     # ano corrente, meses publicados
```

Isso baixa os ZIPs oficiais, lê os CSVs em streaming e grava os cubos em `data/agregados/`. Carregue também o ano anterior para habilitar a comparação. A página **Fontes e método** mostra o que foi processado, linhas lidas/descartadas e avisos.

Se o servidor não alcançar o Portal, baixe os arquivos manualmente em <https://portaldatransparencia.gov.br/download-de-dados> e processe localmente:

```bash
npm run etl -- --ano 2025 --conjuntos transferencias --arquivo transferencias=./downloads/202501_Transferencias.zip
```

Os arquivos de execução e transferências são atualizados diariamente pela CGU; agende o ETL (cron) para manter o painel atualizado.

## Rodar

```bash
npm run dev          # desenvolvimento: http://localhost:3000
npm run build && npm start
```

Sem dados carregados, as páginas mostram como carregar — nenhum número é inventado.

### Modo demonstração

Para testar a interface sem acesso às fontes:

```bash
npm run demo                              # gera data/demo (valores FICTÍCIOS)
DADOS_DEMONSTRACAO=true npm run dev
```

Nesse modo há uma faixa de aviso permanente, cada valor leva o selo “Demonstração” e os nomes têm o prefixo `[DEMO]`.

### Modelo navegável (uma página, sem servidor)

```bash
npm run demo && npm run modelo     # gera prototipo/brasil-transparente-modelo.html
```

## Verificações

```bash
npm test               # cálculos, filtros, motor de consulta, limitador, alertas, ETL ponta a ponta
npm run typecheck
npm run lint
npm run verificar:api  # com token: confere endpoints e formatos de resposta
npm run malhas         # regenera as malhas do IBGE (usa a API oficial quando acessível)
npm run reconciliar    # confere os dados processados: orçamento × execução, transferências × pagos, malhas
```

As regras de cálculo e as evidências de cada uma estão em [docs/METODOLOGIA.md](docs/METODOLOGIA.md).

## Hospedagem

### Recomendado: GitHub + Vercel, com atualização automática

1. Envie este projeto para um repositório no GitHub.
2. A rotina `.github/workflows/atualizar-dados.yml` roda todo dia às 06:15 (Brasília): baixa os arquivos oficiais do ano atual e do anterior, roda os testes, processa e salva `data/agregados` no repositório. Para rodar na hora: aba **Actions → Atualizar dados oficiais → Run workflow**. Para mudar a frequência, edite a linha `cron`.
3. Na Vercel, importe o repositório (Add New → Project). Sem configuração extra. A cada atualização de dados, a Vercel republica o site sozinha.
4. Opcional: em Vercel → Settings → Environment Variables, adicione `PORTAL_TRANSPARENCIA_TOKEN` para ativar contratos e convênios ao vivo.

### Outras opções

- **Vercel / Netlify**: funciona; gere `data/agregados` no build ou num job e inclua no deploy (o `next.config.mjs` já inclui `data/` no trace do servidor). Configure `PORTAL_TRANSPARENCIA_TOKEN` nas variáveis de ambiente.
- **VPS / Docker**: `npm run build && npm start`, com o ETL num cron diário.

## Princípios

Não presume irregularidades. Não soma etapas da despesa nem fontes diferentes. Não atribui despesa ao estado da sede do órgão. Mostra “não disponível” em vez de estimar. Distingue dado oficial, calculado, indisponível e demonstração.
