import Link from "next/link";
export default function NaoEncontrado() {
  return (
    <div className="mx-auto max-w-xl space-y-3 py-10 text-center">
      <h1 className="text-[22px] font-semibold">Página não encontrada</h1>
      <p className="text-tinta-2">O endereço não existe ou o registro não está nos dados carregados para o ano selecionado.</p>
      <Link className="botao-primario" href="/">Voltar ao painel</Link>
    </div>
  );
}
