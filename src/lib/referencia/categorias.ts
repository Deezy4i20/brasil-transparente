/**
 * Categorias "cidadãs" → funções oficiais da classificação funcional (Portaria MOG 42/1999).
 * Só entram correspondências diretas por código. Onde não há correspondência confiável,
 * a função fica sem categoria e é exibida com o nome oficial.
 * "Desenvolvimento regional" não tem função própria (é tratado por programas de vários
 * órgãos), por isso não é uma categoria aqui.
 */
export interface Categoria {
  id: string;
  nome: string;
  funcoes: string[];
  nota?: string;
}

export const CATEGORIAS_CIDADAS: Categoria[] = [
  { id: "saude", nome: "Saúde", funcoes: ["10"] },
  { id: "educacao", nome: "Educação", funcoes: ["12"] },
  { id: "seguranca", nome: "Segurança pública", funcoes: ["06"] },
  { id: "transporte", nome: "Infraestrutura e transportes", funcoes: ["26"] },
  { id: "cidades", nome: "Urbanismo, habitação e saneamento", funcoes: ["15", "16", "17"] },
  { id: "previdencia", nome: "Previdência e assistência social", funcoes: ["09", "08"] },
  { id: "administracao", nome: "Administração pública", funcoes: ["04"] },
  { id: "defesa", nome: "Defesa nacional", funcoes: ["05"] },
  { id: "ciencia", nome: "Ciência e tecnologia", funcoes: ["19"] },
  { id: "ambiente", nome: "Meio ambiente", funcoes: ["18"] },
  { id: "cultura", nome: "Cultura e esporte", funcoes: ["13", "27"] },
  { id: "agricultura", nome: "Agricultura", funcoes: ["20", "21"] },
  { id: "trabalho", nome: "Trabalho", funcoes: ["11"] },
  {
    id: "encargos",
    nome: "Encargos especiais (inclui dívida)",
    funcoes: ["28"],
    nota: "Inclui juros e amortização da dívida, mas também transferências constitucionais a estados e municípios. Não é só dívida.",
  },
];

export function categoriaDaFuncao(cod: string): Categoria | undefined {
  return CATEGORIAS_CIDADAS.find((c) => c.funcoes.includes(cod));
}
