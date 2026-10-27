import type { Metadata } from "next";
import { GLOSSARIO } from "@/lib/glossario";

export const metadata: Metadata = { title: "Glossário" };

export default function Glossario() {
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <h1 className="text-[22px] font-semibold">Glossário</h1>
      <p className="text-[14px] text-tinta-2">Os termos da contabilidade pública, em linguagem simples. O mais importante: <b>empenhado, liquidado e pago são etapas do mesmo gasto</b> — nunca devem ser somados entre si.</p>
      <dl className="space-y-3">
        {GLOSSARIO.map((t) => (
          <div key={t.id} id={t.id} className="cartao scroll-mt-24 p-4 target:ring-2 target:ring-azul-450">
            <dt className="text-[16px] font-semibold">{t.termo}</dt>
            <dd className="mt-1 space-y-1.5 text-[14px] text-tinta-2">
              <p className="font-medium text-tinta">{t.curto}</p>
              <p>{t.explicacao}</p>
              {t.exemplo && <p className="text-tinta-3">Exemplo: {t.exemplo}</p>}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
