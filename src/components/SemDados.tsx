import Link from "next/link";
import { EstadoVazio } from "./ui";

export function SemDados({ ano }: { ano: number }) {
  return (
    <EstadoVazio titulo={`Os dados oficiais de ${ano} ainda não foram carregados`}>
      <p>
        Esta plataforma lê os arquivos de dados abertos do Portal da Transparência e os pré-agrega para responder rápido. Para carregar o ano, execute no servidor:
      </p>
      <pre className="w-full overflow-x-auto rounded-md bg-plano p-2 text-[12.5px]">npm run etl -- --ano {ano}</pre>
      <p>
        Nenhum número é exibido até lá — a plataforma não preenche lacunas com valores inventados. Veja <Link className="link" href="/fontes">Fontes e método</Link>.
      </p>
    </EstadoVazio>
  );
}
