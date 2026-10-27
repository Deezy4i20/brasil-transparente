import "server-only";
/**
 * Endpoints da API usados pela plataforma. Caminhos e parâmetros conforme a
 * documentação oficial (https://api.portaldatransparencia.gov.br/).
 * Datas no formato DD/MM/AAAA; mês/ano no formato MM/AAAA.
 */
import { consultar, consultarPaginas } from "./cliente";
import { Contrato, Convenio, DespesaFuncional, DespesaPorOrgao, Emenda, OrgaoSiafi } from "./esquemas";

/** GET /despesas/por-orgao — ano obrigatório; órgão ou órgão superior (código SIAFI). */
export const despesasPorOrgao = (ano: number, p: { orgaoSuperior?: string; orgao?: string }) =>
  consultarPaginas("despesas/por-orgao", { ano, ...p }, DespesaPorOrgao, 10);

/** GET /despesas/por-funcional-programatica — ano obrigatório; função, subfunção, programa, ação opcionais. */
export const despesasFuncionais = (ano: number, p: { funcao?: string; programa?: string; acao?: string }) =>
  consultarPaginas("despesas/por-funcional-programatica", { ano, ...p }, DespesaFuncional, 10);

/** GET /emendas — consulta de emendas parlamentares. */
export const emendas = (p: { ano?: number; codigoEmenda?: string; nomeAutor?: string; numeroEmenda?: string; pagina?: number }) =>
  consultar("emendas", { pagina: 1, ...p }, Emenda);

/** GET /contratos — codigoOrgao (SIAFI) obrigatório; período de vigência DD/MM/AAAA. */
export const contratosPorOrgao = (codigoOrgao: string, dataInicial: string, dataFinal: string, pagina = 1) =>
  consultar("contratos", { codigoOrgao, dataInicial, dataFinal, pagina }, Contrato);

/** GET /contratos/cpf-cnpj — contratos de um fornecedor (CNPJ). */
export const contratosPorFornecedor = (cpfCnpj: string, pagina = 1) => consultar("contratos/cpf-cnpj", { cpfCnpj, pagina }, Contrato);

/** GET /convenios — filtros por UF, município (IBGE), órgão, situação, períodos. */
export const convenios = (p: { uf?: string; codigoIBGE?: string; codigoOrgao?: string; dataInicial?: string; dataFinal?: string; pagina?: number }) =>
  consultar("convenios", { pagina: 1, ...p }, Convenio);

/** GET /orgaos-siafi — lista de órgãos com código SIAFI. */
export const orgaosSiafi = (pagina = 1, descricao?: string) => consultar("orgaos-siafi", { pagina, descricao }, OrgaoSiafi, { ttl: 24 * 3600_000 });

/** Links para as consultas equivalentes no site do Portal (para o cidadão conferir). */
export const linksPortal = {
  contrato: (id: number) => `https://portaldatransparencia.gov.br/contratos/${id}`,
  convenio: (id: number) => `https://portaldatransparencia.gov.br/convenios/${id}`,
  orgao: (cod: string) => `https://portaldatransparencia.gov.br/orgaos/${cod}`,
  emendasConsulta: (ano: number) => `https://portaldatransparencia.gov.br/emendas/consulta?de=01%2F01%2F${ano}&ate=31%2F12%2F${ano}`,
  favorecido: (cnpj: string) => `https://portaldatransparencia.gov.br/pessoa-juridica/${cnpj.replace(/\D/g, "")}`,
  localidade: (uf: string) => `https://portaldatransparencia.gov.br/localidades/${uf}`,
};
