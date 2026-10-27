/**
 * Limitador de requisições à API do Portal da Transparência.
 * Limites oficiais (página "API de dados"):
 *   06:00–23:59 → 400 requisições/minuto
 *   00:00–05:59 → 700 requisições/minuto
 * (horário de Brasília). Usamos uma margem de segurança (padrão 80%).
 */
export function limiteOficialPorMinuto(agora: Date = new Date()): number {
  const hora = Number(
    new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", hour12: false, timeZone: "America/Sao_Paulo" }).format(agora),
  );
  return hora >= 0 && hora < 6 ? 700 : 400;
}

export class LimitadorJanela {
  private marcas: number[] = [];
  private fila: (() => void)[] = [];
  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private readonly margem = 0.8,
    private readonly agora: () => number = Date.now,
    private readonly limite: (d: Date) => number = limiteOficialPorMinuto,
  ) {}

  private capacidade(): number {
    return Math.max(1, Math.floor(this.limite(new Date(this.agora())) * this.margem));
  }

  private limpar(): void {
    const corte = this.agora() - 60_000;
    while (this.marcas.length && this.marcas[0] <= corte) this.marcas.shift();
  }

  /** Quantas requisições ainda cabem na janela atual. */
  disponivel(): number {
    this.limpar();
    return this.capacidade() - this.marcas.length;
  }

  /** Resolve quando a requisição puder ser feita (respeitando a janela de 60s). */
  aguardar(): Promise<void> {
    return new Promise((res) => {
      this.fila.push(res);
      this.drenar();
    });
  }

  private drenar(): void {
    this.limpar();
    while (this.fila.length && this.marcas.length < this.capacidade()) {
      this.marcas.push(this.agora());
      this.fila.shift()!();
    }
    if (this.fila.length && !this.timer) {
      const espera = Math.max(10, this.marcas[0] + 60_000 - this.agora());
      this.timer = setTimeout(() => {
        this.timer = null;
        this.drenar();
      }, espera);
    }
  }
}
