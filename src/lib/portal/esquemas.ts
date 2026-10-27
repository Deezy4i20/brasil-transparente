/**
 * Esquemas (zod) das respostas da API do Portal da Transparência usadas pela plataforma.
 *
 * As respostas variam entre versões da API (valores como texto "1.234,56" ou
 * número; campos aninhados). Os esquemas são tolerantes a campos extras
 * (passthrough) e normalizam valores monetários com parseValorBR.
 * Rode `npm run verificar:api` com um token para conferir os formatos atuais.
 */
import { z } from "zod";
import { parseValorBR } from "../dinheiro";

const moeda = z.union([z.string(), z.number(), z.null()]).optional().transform((v) => parseValorBR(v));
const texto = z.union([z.string(), z.number(), z.null()]).optional().transform((v) => (v === null || v === undefined ? "" : String(v)));

export const DespesaPorOrgao = z
  .object({
    ano: z.coerce.number().optional(),
    orgao: texto,
    codigoOrgao: texto,
    orgaoSuperior: texto,
    codigoOrgaoSuperior: texto,
    empenhado: moeda,
    liquidado: moeda,
    pago: moeda,
  })
  .passthrough();
export type DespesaPorOrgao = z.infer<typeof DespesaPorOrgao>;

export const DespesaFuncional = z
  .object({
    ano: z.coerce.number().optional(),
    funcao: texto,
    codigoFuncao: texto,
    subfuncao: texto,
    codigoSubfuncao: texto,
    programa: texto,
    codigoPrograma: texto,
    acao: texto,
    codigoAcao: texto,
    empenhado: moeda,
    liquidado: moeda,
    pago: moeda,
  })
  .passthrough();

export const Emenda = z
  .object({
    codigoEmenda: texto,
    ano: z.coerce.number().optional(),
    tipoEmenda: texto,
    autor: texto,
    nomeAutor: texto,
    numeroEmenda: texto,
    localidadeDoGasto: texto,
    funcao: texto,
    subfuncao: texto,
    valorEmpenhado: moeda,
    valorLiquidado: moeda,
    valorPago: moeda,
    valorRestoInscrito: moeda,
    valorRestoCancelado: moeda,
    valorRestoPago: moeda,
  })
  .passthrough();

const pessoa = z
  .object({ nome: texto, cnpjFormatado: texto, cpfFormatado: texto, razaoSocialReceita: texto, nomeFantasiaReceita: texto })
  .passthrough()
  .nullish();

export const Contrato = z
  .object({
    id: z.coerce.number(),
    numero: texto,
    objeto: texto,
    numeroProcesso: texto,
    fundamentoLegal: texto,
    situacaoContrato: texto,
    modalidadeCompra: texto,
    dataAssinatura: texto,
    dataPublicacaoDOU: texto,
    dataInicioVigencia: texto,
    dataFimVigencia: texto,
    valorInicialCompra: moeda,
    valorFinalCompra: moeda,
    fornecedor: pessoa,
    unidadeGestora: z
      .object({ codigo: texto, nome: texto, orgaoVinculado: z.object({ codigoSIAFI: texto, nome: texto }).passthrough().nullish() })
      .passthrough()
      .nullish(),
    compra: z.object({ numero: texto, objeto: texto, numeroProcesso: texto, contatoResponsavel: texto }).passthrough().nullish(),
  })
  .passthrough();
export type Contrato = z.infer<typeof Contrato>;

export const Convenio = z
  .object({
    id: z.coerce.number(),
    numero: texto,
    numeroOriginal: texto,
    objeto: texto,
    situacao: texto,
    tipoInstrumento: z.union([z.string(), z.object({ descricao: texto }).passthrough()]).nullish(),
    dataInicioVigencia: texto,
    dataFinalVigencia: texto,
    dataPublicacao: texto,
    dataUltimaLiberacao: texto,
    valor: moeda,
    valorLiberado: moeda,
    valorContrapartida: moeda,
    convenente: z.object({ nome: texto, cnpjFormatado: texto }).passthrough().nullish(),
    municipioConvenente: z.object({ nomeIBGE: texto, codigoIBGE: texto, uf: z.object({ sigla: texto }).passthrough().nullish() }).passthrough().nullish(),
    orgao: z.object({ nome: texto, codigoSIAFI: texto }).passthrough().nullish(),
  })
  .passthrough();
export type Convenio = z.infer<typeof Convenio>;

export const OrgaoSiafi = z.object({ codigo: texto, descricao: texto }).passthrough();

export const lista = <T extends z.ZodTypeAny>(item: T) => z.array(item);
