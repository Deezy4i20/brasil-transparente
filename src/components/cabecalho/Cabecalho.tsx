import Link from "next/link";
import { Landmark } from "lucide-react";
import { manifesto, MODO_DEMONSTRACAO, anosDisponiveis, anoPadrao } from "@/lib/dados/repositorio";
import { statusConexao } from "@/lib/portal/cliente";
import { BuscaGlobal } from "./BuscaGlobal";
import { SeletorPeriodo } from "./SeletorPeriodo";
import { Navegacao } from "./Navegacao";

function fmt(iso?: string) {
  if (!iso) return null;
  return new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" });
}

export async function Cabecalho() {
  const m = manifesto();
  const api = await statusConexao();
  const anos = anosDisponiveis();
  const status = MODO_DEMONSTRACAO
    ? { cor: "bg-[#fab219]", texto: "Modo demonstração", dica: "Dados fictícios. Conecte as fontes oficiais executando o ETL." }
    : !m
      ? { cor: "bg-[#ec835a]", texto: "Dados não carregados", dica: "Execute `npm run etl` para carregar os arquivos oficiais." }
      : api.ok
        ? { cor: "bg-[#0ca30c]", texto: "Fontes conectadas", dica: `Agregados carregados; ${api.mensagem}` }
        : { cor: "bg-[#fab219]", texto: "API ao vivo indisponível", dica: `Agregados carregados. API: ${api.mensagem}` };

  return (
    <header className="bg-[#0b1220] text-white">
      <div className="mx-auto flex max-w-[1400px] flex-wrap items-center gap-x-5 gap-y-3 px-4 py-3 md:px-6">
        <Link href="/" className="flex items-center gap-2.5" aria-label="Brasil Transparente — página inicial">
          <span className="grid h-8 w-8 place-items-center rounded-md bg-white/10">
            <Landmark aria-hidden className="h-[18px] w-[18px]" />
          </span>
          <span className="leading-tight">
            <span className="block text-[15px] font-semibold">Brasil Transparente</span>
            <span className="block text-[11.5px] text-white/60">Gastos públicos federais, com fonte</span>
          </span>
        </Link>
        <div className="order-3 w-full md:order-none md:w-auto md:flex-1">
          <BuscaGlobal />
        </div>
        <SeletorPeriodo anos={anos.length ? anos : [anoPadrao()]} />
        <div className="flex items-center gap-3 text-[12px] text-white/75">
          <span className="flex items-center gap-1.5" title={status.dica}>
            <span aria-hidden className={`h-2 w-2 rounded-full ${status.cor}`} />
            {status.texto}
          </span>
          {m && (
            <span className="hidden lg:inline" title="Data do último processamento dos arquivos oficiais">
              Atualizado em {fmt(m.geradoEm)}
            </span>
          )}
        </div>
      </div>
      <Navegacao />
    </header>
  );
}
