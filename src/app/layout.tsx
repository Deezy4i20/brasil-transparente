import type { Metadata, Viewport } from "next";
import { Suspense } from "react";
import Link from "next/link";
import "./globals.css";
import { Cabecalho } from "@/components/cabecalho/Cabecalho";
import { MODO_DEMONSTRACAO } from "@/lib/dados/repositorio";
import { TriangleAlert } from "lucide-react";

export const metadata: Metadata = {
  title: { default: "Brasil Transparente", template: "%s · Brasil Transparente" },
  description: "Explore os gastos públicos federais brasileiros com dados oficiais do Portal da Transparência, fonte e metodologia à vista.",
};
export const viewport: Viewport = { themeColor: "#0b1220", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>
        <a href="#conteudo" className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded focus:bg-white focus:px-3 focus:py-2">
          Pular para o conteúdo
        </a>
        <Suspense>
          <Cabecalho />
        </Suspense>
        {MODO_DEMONSTRACAO && (
          <div role="alert" className="border-b border-[#fab219] bg-[#fff6e0] text-[#5c3d00]">
            <div className="mx-auto flex max-w-[1400px] items-center gap-2 px-4 py-2 text-[13px] md:px-6">
              <TriangleAlert aria-hidden className="h-4 w-4 shrink-0" />
              <span>
                <b>Modo demonstração:</b> todos os valores desta tela são <b>fictícios</b>, gerados para testar a interface. Para ver dados oficiais, carregue os arquivos do Portal da Transparência (veja <Link href="/fontes" className="underline">Fontes e método</Link>).
              </span>
            </div>
          </div>
        )}
        <main id="conteudo" className="mx-auto max-w-[1400px] px-4 py-5 md:px-6">
          {children}
        </main>
        <footer className="mt-8 border-t border-borda bg-superficie">
          <div className="mx-auto grid max-w-[1400px] gap-2 px-4 py-6 text-[12.5px] text-tinta-3 md:px-6">
            <p>
              Dados: <a className="link" href="https://portaldatransparencia.gov.br/" target="_blank" rel="noreferrer">Portal da Transparência do Governo Federal (CGU)</a> e IBGE. Projeto independente, sem vínculo com órgãos públicos.
            </p>
            <p>
              Esta plataforma organiza e compara dados oficiais. Ela não presume irregularidades: receber ou gastar recursos públicos não é indício de ilegalidade.
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}
