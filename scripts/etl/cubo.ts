import type { Cubo, ItemDicionario, NomeConjunto } from "../../src/lib/dados/tipos";
import { somar } from "../../src/lib/dinheiro";

/**
 * Acumulador de cubo: soma medidas por combinação de dimensões, mantendo
 * dicionários (código oficial → nome). Valores são acumulados em centavos
 * inteiros para evitar erro de ponto flutuante em milhões de linhas.
 */
export class ConstrutorCubo {
  private dicts = new Map<string, Map<string, number>>();
  private itens = new Map<string, ItemDicionario[]>();
  private acum = new Map<string, number[]>();

  constructor(
    readonly conjunto: NomeConjunto,
    readonly ano: number,
    readonly dimensoes: string[],
    readonly medidas: string[],
  ) {
    for (const d of dimensoes) if (d !== "mes") {
      this.dicts.set(d, new Map());
      this.itens.set(d, []);
    }
  }

  private indice(dim: string, item: ItemDicionario): number {
    const m = this.dicts.get(dim)!;
    const k = item.cod;
    let i = m.get(k);
    if (i === undefined) {
      i = this.itens.get(dim)!.length;
      m.set(k, i);
      this.itens.get(dim)!.push({ ...item });
    } else {
      // Mantém o nome mais recente não vazio (nomes podem mudar ao longo do ano).
      const atual = this.itens.get(dim)![i];
      if (item.nome && item.nome !== atual.nome) atual.nome = item.nome;
      if (item.extra) atual.extra = { ...atual.extra, ...item.extra };
    }
    return i;
  }

  /** `chave`: para "mes" um número; para as demais, um ItemDicionario. `valores`: na ordem de `medidas`. */
  adicionar(chave: Record<string, ItemDicionario | number>, valores: number[]): void {
    const idx: number[] = [];
    for (const d of this.dimensoes) {
      const v = chave[d];
      if (v === undefined) throw new Error(`Dimensão ausente: ${d}`);
      idx.push(d === "mes" ? (v as number) : this.indice(d, v as ItemDicionario));
    }
    const k = idx.join("|");
    let a = this.acum.get(k);
    if (!a) {
      a = new Array(this.medidas.length).fill(0);
      this.acum.set(k, a);
    }
    for (let j = 0; j < valores.length; j++) a[j] += Math.round(valores[j] * 100);
  }

  get tamanho(): number {
    return this.acum.size;
  }

  construir(): Cubo {
    const linhas: number[][] = [];
    for (const [k, a] of this.acum) {
      const dims = k.split("|").map(Number);
      // descarta combinações cujas medidas são todas zero
      if (a.every((c) => c === 0)) continue;
      linhas.push([...dims, ...a.map((c) => c / 100)]);
    }
    const dicionarios: Record<string, ItemDicionario[]> = {};
    for (const [d, l] of this.itens) dicionarios[d] = l;
    return {
      versao: 1,
      conjunto: this.conjunto,
      ano: this.ano,
      dimensoes: this.dimensoes,
      medidas: this.medidas,
      dicionarios,
      linhas,
    };
  }
}

export { somar };
