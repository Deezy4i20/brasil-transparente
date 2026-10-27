-- =====================================================================
-- Brasil Transparente — modelo de dados normalizado (PostgreSQL)
--
-- Situação: a versão 0.1 roda sem banco, a partir de cubos pré-agregados
-- (data/agregados/*.json) gerados pelo ETL. Este esquema é o destino da
-- Fase 4, quando a busca por registro individual (documentos de despesa,
-- contratos, licitações, notas fiscais) exigir consultas sobre milhões de
-- linhas. Os cubos atuais correspondem às tabelas fato_* agregadas abaixo.
--
-- Princípios:
--  * Todo registro guarda o identificador oficial e de onde veio (conjunto + arquivo + linha).
--  * Associações entre fontes só existem em tabelas de vínculo com o critério usado.
--  * Valores em NUMERIC(18,2); etapas da despesa em colunas separadas, nunca somadas.
-- =====================================================================

-- ---------- Proveniência
CREATE TABLE fonte_dados (
  id            SERIAL PRIMARY KEY,
  nome          TEXT NOT NULL,                 -- "Portal da Transparência (CGU)"
  url           TEXT NOT NULL,
  tipo          TEXT NOT NULL CHECK (tipo IN ('arquivo', 'api', 'referencia'))
);

CREATE TABLE conjunto_dados (
  id            SERIAL PRIMARY KEY,
  fonte_id      INT NOT NULL REFERENCES fonte_dados(id),
  slug          TEXT NOT NULL UNIQUE,          -- "despesas-execucao", "transferencias", "/api-de-dados/contratos"
  nome          TEXT NOT NULL,
  periodicidade TEXT NOT NULL,                 -- anual | mensal | unico | sob demanda
  dicionario_url TEXT
);

CREATE TABLE registro_atualizacao (            -- um arquivo baixado/processado ou uma consulta à API
  id              BIGSERIAL PRIMARY KEY,
  conjunto_id     INT NOT NULL REFERENCES conjunto_dados(id),
  periodo         TEXT NOT NULL,               -- "202501", "2025", "UNICO"
  url             TEXT,
  arquivo         TEXT,
  sha256          TEXT,
  baixado_em      TIMESTAMPTZ NOT NULL,
  processado_em   TIMESTAMPTZ,
  linhas_lidas    INT,
  linhas_descartadas INT,
  motivos_descarte JSONB,
  avisos          TEXT[],
  UNIQUE (conjunto_id, periodo, sha256)
);

-- ---------- Dimensões oficiais (códigos preservados)
CREATE TABLE localidade (
  id            SERIAL PRIMARY KEY,
  tipo          TEXT NOT NULL CHECK (tipo IN ('pais','regiao','uf','municipio','nao_identificada')),
  cod_ibge      TEXT UNIQUE,                   -- 2 dígitos (UF) ou 7 (município)
  cod_siafi     TEXT,                          -- código SIAFI do município (transferências)
  sigla         TEXT,
  nome          TEXT NOT NULL,
  pai_id        INT REFERENCES localidade(id),
  populacao     INT,
  populacao_ref TEXT                           -- "Censo 2022"
);

CREATE TABLE orgao (
  id            SERIAL PRIMARY KEY,
  cod_siafi     TEXT NOT NULL UNIQUE,
  nome          TEXT NOT NULL,
  superior_id   INT REFERENCES orgao(id),      -- NULL = órgão superior
  sede_localidade_id INT REFERENCES localidade(id)  -- informativo; NUNCA usado para localizar despesa
);

CREATE TABLE unidade_gestora (
  id            SERIAL PRIMARY KEY,
  cod_siafi     TEXT NOT NULL UNIQUE,
  nome          TEXT NOT NULL,
  orgao_id      INT REFERENCES orgao(id)
);

CREATE TABLE funcao    (cod TEXT PRIMARY KEY, nome TEXT NOT NULL);
CREATE TABLE subfuncao (cod TEXT PRIMARY KEY, nome TEXT NOT NULL);
CREATE TABLE programa  (cod TEXT NOT NULL, ano INT NOT NULL, nome TEXT NOT NULL, PRIMARY KEY (cod, ano));
CREATE TABLE acao      (cod TEXT NOT NULL, ano INT NOT NULL, nome TEXT NOT NULL, linguagem_cidada TEXT,
                        programa_cod TEXT, PRIMARY KEY (cod, ano));
CREATE TABLE grupo_despesa (cod TEXT PRIMARY KEY, nome TEXT NOT NULL);

CREATE TABLE favorecido (
  id            BIGSERIAL PRIMARY KEY,
  tipo_pessoa   TEXT NOT NULL CHECK (tipo_pessoa IN ('PJ','PF','ente_publico','outro')),
  identificador TEXT NOT NULL,                 -- CNPJ completo; PF apenas no formato mascarado publicado
  nome          TEXT NOT NULL,
  localidade_id INT REFERENCES localidade(id),
  UNIQUE (tipo_pessoa, identificador)
);

-- ---------- Fatos
CREATE TABLE fato_orcamento (                  -- arquivo Orçamento da Despesa (anual)
  ano           INT NOT NULL,
  orgao_id      INT NOT NULL REFERENCES orgao(id),
  funcao_cod    TEXT NOT NULL REFERENCES funcao(cod),
  programa_cod  TEXT NOT NULL,
  acao_cod      TEXT NOT NULL,
  grupo_cod     TEXT NOT NULL REFERENCES grupo_despesa(cod),
  inicial       NUMERIC(18,2) NOT NULL,
  atualizado    NUMERIC(18,2) NOT NULL,
  empenhado     NUMERIC(18,2) NOT NULL,
  realizado     NUMERIC(18,2) NOT NULL,
  atualizacao_id BIGINT NOT NULL REFERENCES registro_atualizacao(id)
);

CREATE TABLE fato_execucao (                   -- arquivo Execução da Despesa (mensal)
  ano INT NOT NULL, mes SMALLINT NOT NULL CHECK (mes BETWEEN 1 AND 12),
  orgao_id INT NOT NULL REFERENCES orgao(id),
  unidade_gestora_id INT REFERENCES unidade_gestora(id),
  funcao_cod TEXT NOT NULL, subfuncao_cod TEXT, programa_cod TEXT NOT NULL, acao_cod TEXT NOT NULL,
  grupo_cod TEXT NOT NULL, elemento_cod TEXT, modalidade_cod TEXT,
  localidade_execucao_id INT NOT NULL REFERENCES localidade(id),  -- UF/município do plano de trabalho ou "não identificada"
  emenda_autor_cod TEXT,
  empenhado NUMERIC(18,2) NOT NULL, liquidado NUMERIC(18,2) NOT NULL, pago NUMERIC(18,2) NOT NULL,
  rap_inscrito NUMERIC(18,2) NOT NULL, rap_cancelado NUMERIC(18,2) NOT NULL, rap_pago NUMERIC(18,2) NOT NULL,
  atualizacao_id BIGINT NOT NULL REFERENCES registro_atualizacao(id)
);
CREATE INDEX ON fato_execucao (ano, mes);
CREATE INDEX ON fato_execucao (ano, orgao_id);
CREATE INDEX ON fato_execucao (ano, localidade_execucao_id);

CREATE TABLE transferencia (                   -- arquivo Recursos Transferidos (mensal)
  id BIGSERIAL PRIMARY KEY,
  ano INT NOT NULL, mes SMALLINT NOT NULL,
  tipo TEXT NOT NULL,
  orgao_id INT REFERENCES orgao(id),
  funcao_cod TEXT, programa_cod TEXT, acao_cod TEXT,
  favorecido_id BIGINT REFERENCES favorecido(id),
  localidade_destino_id INT NOT NULL REFERENCES localidade(id),   -- UF/município do favorecido
  valor NUMERIC(18,2) NOT NULL,
  atualizacao_id BIGINT NOT NULL REFERENCES registro_atualizacao(id),
  linha_origem INT NOT NULL
);

CREATE TABLE emenda (
  codigo TEXT PRIMARY KEY,                     -- 12 dígitos
  ano INT NOT NULL, tipo TEXT, numero TEXT,
  autor_cod TEXT, autor_nome TEXT,
  localidade_gasto_texto TEXT,                 -- como publicado
  localidade_destino_id INT REFERENCES localidade(id),
  funcao_cod TEXT, programa_cod TEXT, acao_cod TEXT,
  empenhado NUMERIC(18,2), liquidado NUMERIC(18,2), pago NUMERIC(18,2),
  rap_inscrito NUMERIC(18,2), rap_cancelado NUMERIC(18,2), rap_pago NUMERIC(18,2),
  atualizacao_id BIGINT NOT NULL REFERENCES registro_atualizacao(id)
);

CREATE TABLE documento_despesa (               -- arquivo Documentos de empenho/liquidação/pagamento (Fase 4)
  codigo TEXT PRIMARY KEY,                     -- UG + gestão + número
  fase TEXT NOT NULL CHECK (fase IN ('empenho','liquidacao','pagamento')),
  data DATE NOT NULL,
  unidade_gestora_id INT REFERENCES unidade_gestora(id),
  favorecido_id BIGINT REFERENCES favorecido(id),
  valor NUMERIC(18,2) NOT NULL,
  observacao TEXT,
  atualizacao_id BIGINT NOT NULL REFERENCES registro_atualizacao(id)
);

CREATE TABLE licitacao (
  id_portal BIGINT PRIMARY KEY, numero TEXT, modalidade TEXT, objeto TEXT, situacao TEXT,
  unidade_gestora_id INT REFERENCES unidade_gestora(id), data_abertura DATE, valor NUMERIC(18,2),
  atualizacao_id BIGINT NOT NULL REFERENCES registro_atualizacao(id)
);

CREATE TABLE contrato (
  id_portal BIGINT PRIMARY KEY, numero TEXT NOT NULL, objeto TEXT,
  unidade_gestora_id INT REFERENCES unidade_gestora(id),
  fornecedor_id BIGINT REFERENCES favorecido(id),
  licitacao_id BIGINT REFERENCES licitacao(id),   -- só quando a fonte informa o vínculo
  situacao TEXT, modalidade TEXT,
  data_assinatura DATE, vigencia_inicio DATE, vigencia_fim DATE,
  valor_inicial NUMERIC(18,2), valor_final NUMERIC(18,2),
  atualizacao_id BIGINT NOT NULL REFERENCES registro_atualizacao(id)
);

CREATE TABLE projeto (                         -- só com fonte que identifique o projeto/obra individualmente
  id BIGSERIAL PRIMARY KEY,
  fonte_identificador TEXT NOT NULL,           -- ex.: id no Obrasgov.br
  conjunto_id INT NOT NULL REFERENCES conjunto_dados(id),
  nome TEXT NOT NULL, descricao TEXT,
  orgao_id INT REFERENCES orgao(id), localidade_id INT REFERENCES localidade(id),
  valor_previsto NUMERIC(18,2), situacao TEXT, percentual_fisico NUMERIC(5,2),
  UNIQUE (conjunto_id, fonte_identificador)
);

-- ---------- Vínculos entre registros (somente com chave/correspondência confiável)
CREATE TABLE vinculo (
  id BIGSERIAL PRIMARY KEY,
  origem_tipo TEXT NOT NULL, origem_id TEXT NOT NULL,      -- ex.: 'contrato', '12345'
  destino_tipo TEXT NOT NULL, destino_id TEXT NOT NULL,    -- ex.: 'documento_despesa', '153...'
  criterio TEXT NOT NULL,                                  -- 'chave_oficial' | 'api_documentos_relacionados' | ...
  evidencia TEXT,                                          -- campo/valor que sustenta o vínculo
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (origem_tipo, origem_id, destino_tipo, destino_id)
);

-- ---------- Séries pré-agregadas (o que hoje está em data/agregados)
CREATE MATERIALIZED VIEW serie_execucao_uf_mes AS
  SELECT ano, mes, localidade_execucao_id, funcao_cod, orgao_id,
         SUM(empenhado) empenhado, SUM(liquidado) liquidado, SUM(pago) pago
  FROM fato_execucao GROUP BY 1,2,3,4,5;
