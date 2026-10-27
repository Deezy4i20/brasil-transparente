import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Módulos" };

const MODULOS = [
  { nome: "Painel e indicadores", status: "Funcionando", rota: "/", fonte: "Orçamento da Despesa, Execução da Despesa, Recursos Transferidos (CSV)" },
  { nome: "Para onde vai (mapa, estados, municípios)", status: "Funcionando", rota: "/mapa", fonte: "Recursos Transferidos, Execução da Despesa, Emendas (CSV) + malhas IBGE" },
  { nome: "Quem gasta (órgãos)", status: "Funcionando", rota: "/orgaos", fonte: "Orçamento + Execução da Despesa (CSV)" },
  { nome: "Com o que se gasta (áreas)", status: "Funcionando", rota: "/areas", fonte: "Classificação funcional oficial (CSV)" },
  { nome: "Emendas parlamentares", status: "Funcionando", rota: "/emendas", fonte: "Emendas Parlamentares (CSV); API /emendas para conferência" },
  { nome: "Empresas e favorecidos", status: "Parcial", rota: "/favorecidos", fonte: "Hoje: favorecidos de transferências. Próximo: “Recebimento de recursos por favorecido” (despesas-favorecidos) e API /contratos/cpf-cnpj" },
  { nome: "Contratos", status: "Parcial", rota: "/contratos", fonte: "Hoje: API /contratos por órgão (ao vivo). Próximo: arquivo Contratos (compras) no ETL para rankings e totais" },
  { nome: "Licitações", status: "Planejado", fonte: "API /licitacoes e arquivo Licitações" },
  { nome: "Projetos, programas e obras", status: "Planejado", fonte: "Programas/ações já disponíveis em Quem gasta. Obras individuais exigem fonte com vínculo comprovável (ex.: Cadastro Integrado de Projetos de Investimento / Obrasgov.br) — a documentar antes de exibir" },
  { nome: "Cartões de pagamento e viagens", status: "Planejado", fonte: "Arquivos CPGF e Viagens a serviço; APIs /cartoes e /viagens" },
  { nome: "Receitas e renúncias fiscais", status: "Planejado", fonte: "Arquivos Execução da receita e Renúncias Fiscais" },
];

export default function Modulos() {
  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <h1 className="text-[22px] font-semibold">Módulos da plataforma</h1>
      <p className="text-[14px] text-tinta-2">O que já funciona com dados oficiais, o que é parcial e o que ainda será integrado — e com qual fonte.</p>
      <div className="overflow-x-auto rounded-md border border-borda bg-superficie">
        <table className="tabela min-w-[640px]">
          <thead><tr><th>Módulo</th><th>Situação</th><th>Fonte</th></tr></thead>
          <tbody>
            {MODULOS.map((m) => (
              <tr key={m.nome}>
                <td className="font-medium">{m.rota ? <Link className="link" href={m.rota}>{m.nome}</Link> : m.nome}</td>
                <td><span className={`rounded-full px-2 py-0.5 text-[12px] font-semibold ${m.status === "Funcionando" ? "bg-[#e6f4e6] text-bom" : m.status === "Parcial" ? "bg-[#fff6e0] text-[#7a5200]" : "bg-plano text-tinta-3"}`}>{m.status}</span></td>
                <td className="text-[13px] text-tinta-2">{m.fonte}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
