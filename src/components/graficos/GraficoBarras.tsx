"use client";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatarBRL, formatarBRLCompacto } from "@/lib/dinheiro";

/**
 * Série temporal em barras (uma medida, um eixo). Usada para histórico mensal e anual.
 * Inclui descrição textual e tabela alternativa (para leitores de tela).
 */
export function GraficoBarras({
  dados,
  rotulo,
  descricao,
  altura = 220,
}: {
  dados: { rotulo: string; valor: number | null }[];
  rotulo: string;
  descricao: string;
  altura?: number;
}) {
  const validos = dados.filter((d) => d.valor !== null) as { rotulo: string; valor: number }[];
  if (!validos.length) return <p className="text-sm text-tinta-3">Sem dados para o período.</p>;
  return (
    <figure>
      <div style={{ height: altura }} aria-hidden>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={dados} margin={{ top: 8, right: 8, bottom: 0, left: 0 }} barCategoryGap="22%">
            <CartesianGrid vertical={false} stroke="#e1e0d9" strokeWidth={1} />
            <XAxis dataKey="rotulo" tickLine={false} axisLine={{ stroke: "#c3c2b7" }} tick={{ fontSize: 11.5, fill: "#6b7482" }} />
            <YAxis tickFormatter={(v: number) => formatarBRLCompacto(v).replace("R$ ", "")} tickLine={false} axisLine={false} width={64} tick={{ fontSize: 11.5, fill: "#6b7482" }} />
            <Tooltip
              cursor={{ fill: "rgba(11,18,32,0.05)" }}
              formatter={(v) => [formatarBRL(Number(v)), rotulo]}
              contentStyle={{ borderRadius: 8, border: "1px solid #e2e7ee", fontSize: 12.5 }}
            />
            <Bar dataKey="valor" fill="#2a78d6" radius={[4, 4, 0, 0]} maxBarSize={38} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <figcaption className="sr-only">{descricao}</figcaption>
      <details className="mt-1 text-[12px] text-tinta-3">
        <summary className="cursor-pointer">Ver dados em tabela</summary>
        <table className="tabela mt-1">
          <thead>
            <tr>
              <th>Período</th>
              <th className="valor">{rotulo}</th>
            </tr>
          </thead>
          <tbody>
            {dados.map((d) => (
              <tr key={d.rotulo}>
                <td>{d.rotulo}</td>
                <td className="valor">{d.valor === null ? "não disponível" : formatarBRL(d.valor)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}
