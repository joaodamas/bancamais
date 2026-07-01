import { describe, it, expect } from "vitest";
import { betProfit, potentialReturn, clvPercent, calculateMetrics, profitFactor, segmentByOddsBand, segmentByStakeBand, segmentByDayOfWeek, segmentByMarket, segmentByLeague, bettingStreaks } from "./metrics";
import { bankrollBase } from "./ledger";
import type { Transaction } from "./types";
import { emptyState } from "./storage";
import type { Bet, AppState } from "./types";

function makeBet(overrides: Partial<Bet>): Bet {
  return {
    id: "bet-test",
    placedAt: new Date().toISOString(),
    eventAt: new Date().toISOString(),
    sport: "Futebol",
    league: "UCL",
    eventName: "Real x City",
    market: "Resultado",
    selection: "Real vence",
    bookmakerId: "book-1",
    tags: [],
    stake: 100,
    odds: 2.0,
    status: "pending",
    mode: "prelive",
    ...overrides,
  };
}

function makeState(bets: Bet[], overrides?: Partial<AppState>): AppState {
  return {
    ...emptyState(),
    bookmakers: [{ id: "book-1", name: "Bet365", balance: 1000, status: "manual", lastSyncLabel: "manual" }],
    bets,
    ...overrides,
  };
}

describe("betProfit", () => {
  it("retorna 0 para aposta pendente", () => {
    expect(betProfit(makeBet({ status: "pending" }))).toBe(0);
  });

  it("retorna 0 para aposta void", () => {
    expect(betProfit(makeBet({ status: "void", payout: 100 }))).toBe(0);
  });

  it("calcula lucro para aposta ganha", () => {
    const bet = makeBet({ status: "won", stake: 100, odds: 2.0, payout: 200 });
    expect(betProfit(bet)).toBe(100);
  });

  it("calcula prejuízo para aposta perdida", () => {
    const bet = makeBet({ status: "lost", stake: 100, payout: 0 });
    expect(betProfit(bet)).toBe(-100);
  });

  it("calcula cashout com valor parcial", () => {
    const bet = makeBet({ status: "cashout", stake: 100, payout: 80 });
    expect(betProfit(bet)).toBe(-20);
  });

  it("freebet ganha: lucro é só o ganho (não abate o stake)", () => {
    const bet = makeBet({ status: "won", stake: 100, odds: 3, payout: 200, isFreebet: true });
    expect(betProfit(bet)).toBe(200); // stake×(odd−1), sem devolver stake
  });

  it("freebet perdida: lucro 0 (não perde dinheiro próprio)", () => {
    const bet = makeBet({ status: "lost", stake: 100, odds: 3, payout: 0, isFreebet: true });
    expect(betProfit(bet)).toBe(0);
  });
});

function deposit(amount: number): Transaction {
  return {
    id: `dep-${amount}`,
    date: new Date().toISOString(),
    type: "deposit",
    bookmakerId: "book-1",
    description: "Depósito",
    amount,
    referenceType: "manual",
  };
}

describe("bankrollBase", () => {
  it("usa o total depositado quando há depósitos", () => {
    const state = makeState([], { transactions: [deposit(500)] });
    expect(bankrollBase(state)).toBe(500);
  });

  it("cai para startingBalance quando não há depósitos", () => {
    const state = makeState([], { bookmakers: [], startingBalance: 2000 });
    expect(bankrollBase(state)).toBe(2000);
  });
});

describe("potentialReturn", () => {
  it("calcula retorno potencial corretamente", () => {
    expect(potentialReturn(makeBet({ stake: 100, odds: 1.92 }))).toBeCloseTo(192);
  });

  it("retorno é sempre stake * odds", () => {
    const bet = makeBet({ stake: 250, odds: 2.5 });
    expect(potentialReturn(bet)).toBe(625);
  });
});

describe("clvPercent", () => {
  it("retorna null sem closingOdds", () => {
    expect(clvPercent(makeBet({ closingOdds: undefined }))).toBeNull();
  });

  it("CLV positivo quando odd > fechamento", () => {
    const clv = clvPercent(makeBet({ odds: 2.0, closingOdds: 1.8 }));
    expect(clv).toBeGreaterThan(0);
    expect(clv).toBeCloseTo((2.0 - 1.8) / 1.8);
  });

  it("CLV negativo quando odd < fechamento", () => {
    const clv = clvPercent(makeBet({ odds: 1.7, closingOdds: 2.0 }));
    expect(clv).toBeLessThan(0);
  });

  it("CLV zero quando odd === fechamento", () => {
    expect(clvPercent(makeBet({ odds: 2.0, closingOdds: 2.0 }))).toBe(0);
  });
});

describe("calculateMetrics", () => {
  it("retorna zeros com estado vazio", () => {
    const state = makeState([]);
    const m = calculateMetrics(state);
    expect(m.profit).toBe(0);
    expect(m.roi).toBe(0);
    expect(m.hitRate).toBe(0);
    expect(m.pendingCount).toBe(0);
    expect(m.settledCount).toBe(0);
  });

  it("zera ROI e yield quando o lucro é zero", () => {
    const bets: Bet[] = [
      makeBet({ id: "1", status: "won", stake: 100, odds: 2.0, payout: 200 }),
      makeBet({ id: "2", status: "lost", stake: 100, odds: 2.0, payout: 0 }),
    ];
    const m = calculateMetrics(makeState(bets));
    // Lucro = 100 - 100 = 0 → ROI (lucro/banca) e yield (lucro/turnover) = 0
    expect(m.profit).toBe(0);
    expect(m.roi).toBe(0);
    expect(m.yield).toBe(0);
    expect(m.hitRate).toBe(0.5);
    expect(m.settledCount).toBe(2);
  });

  it("separa ROI (lucro/banca) de yield (lucro/turnover liquidado)", () => {
    const bets: Bet[] = [
      makeBet({ id: "1", status: "won", stake: 100, odds: 3.0, payout: 300 }),
      makeBet({ id: "2", status: "lost", stake: 100, odds: 2.0, payout: 0 }),
    ];
    const m = calculateMetrics(makeState(bets));
    expect(m.profit).toBe(100);     // 200 - 100
    expect(m.yield).toBe(0.5);      // 100 / 200 (turnover liquidado)
    expect(m.roi).toBeCloseTo(0.1); // 100 / 1000 (banca = saldo da casa)
    expect(m.hitRate).toBe(0.5);
  });

  it("freebet entra no lucro mas fica fora do turnover do yield", () => {
    const bets: Bet[] = [
      makeBet({ id: "1", status: "won", stake: 100, odds: 2.0, payout: 200 }),                  // arriscada: +100
      makeBet({ id: "2", status: "won", stake: 100, odds: 3.0, payout: 200, isFreebet: true }), // freebet: +200 ganho
    ];
    const m = calculateMetrics(makeState(bets));
    expect(m.profit).toBe(300);   // 100 + 200 (dinheiro real ganho)
    expect(m.yield).toBe(1.0);    // 100 / 100 (só a arriscada) — não 300/200
  });

  it("yield ignora o stake de apostas pendentes no denominador", () => {
    const bets: Bet[] = [
      makeBet({ id: "1", status: "won", stake: 100, odds: 3.0, payout: 300 }), // +200
      makeBet({ id: "2", status: "lost", stake: 100, odds: 2.0, payout: 0 }),  // -100
      makeBet({ id: "3", status: "pending", stake: 500 }),                     // não entra
    ];
    const m = calculateMetrics(makeState(bets));
    // turnover liquidado = 200 (não 700); yield = 100 / 200 = 0.5
    expect(m.yield).toBe(0.5);
  });

  it("exclui void do cálculo de profit e hitRate", () => {
    const bets: Bet[] = [
      makeBet({ id: "1", status: "won", stake: 100, odds: 2.0, payout: 200 }),
      makeBet({ id: "2", status: "void", stake: 50, payout: 50 }),
    ];
    const m = calculateMetrics(makeState(bets));
    expect(m.profit).toBe(100);
    expect(m.settledCount).toBe(1);
    expect(m.hitRate).toBe(1.0);
  });

  it("calcula exposição aberta corretamente", () => {
    const bets: Bet[] = [
      makeBet({ id: "1", status: "pending", stake: 150 }),
      makeBet({ id: "2", status: "pending", stake: 100 }),
      makeBet({ id: "3", status: "won", stake: 200, payout: 400 }),
    ];
    const m = calculateMetrics(makeState(bets));
    expect(m.openExposure).toBe(250);
    expect(m.pendingCount).toBe(2);
  });
});

describe("profitFactor", () => {
  it("retorna null sem perdas liquidadas (∞)", () => {
    const bets = [makeBet({ id: "1", status: "won", stake: 100, payout: 250 })];
    expect(profitFactor(makeState(bets))).toBeNull();
  });

  it("calcula ganhos brutos / perdas brutas", () => {
    const bets = [
      makeBet({ id: "1", status: "won", stake: 100, payout: 250 }), // +150
      makeBet({ id: "2", status: "lost", stake: 100, payout: 0 }),  // -100
    ];
    expect(profitFactor(makeState(bets))).toBeCloseTo(1.5);
  });

  it("ignora pendentes e voids", () => {
    const bets = [
      makeBet({ id: "1", status: "won", stake: 100, payout: 200 }), // +100
      makeBet({ id: "2", status: "lost", stake: 50, payout: 0 }),   // -50
      makeBet({ id: "3", status: "pending", stake: 999 }),
      makeBet({ id: "4", status: "void", stake: 999, payout: 999 }),
    ];
    expect(profitFactor(makeState(bets))).toBeCloseTo(2);
  });
});

describe("segmentByOddsBand", () => {
  it("agrupa por faixa de cotação e omite faixas vazias", () => {
    const bets = [
      makeBet({ id: "1", odds: 1.4, status: "won", stake: 100, payout: 140 }),
      makeBet({ id: "2", odds: 1.8, status: "lost", stake: 100, payout: 0 }),
      makeBet({ id: "3", odds: 2.5, status: "won", stake: 100, payout: 250 }),
    ];
    const segments = segmentByOddsBand(makeState(bets));
    expect(segments.map((s) => s.label)).toEqual(["1.00–1.50", "1.50–2.00", "2.00–3.00"]);
    const band = segments.find((s) => s.label === "1.50–2.00");
    expect(band?.bets).toBe(1);
    expect(band?.profit).toBe(-100);
  });

  it("cotação no limite cai na faixa superior (intervalo [min, max))", () => {
    const bets = [makeBet({ id: "1", odds: 2.0, status: "won", stake: 100, payout: 200 })];
    const segments = segmentByOddsBand(makeState(bets));
    expect(segments).toHaveLength(1);
    expect(segments[0].label).toBe("2.00–3.00");
  });
});

describe("segmentByStakeBand", () => {
  it("agrupa por stake relativo à média (150 = média)", () => {
    const bets = [
      makeBet({ id: "1", stake: 50, status: "won", odds: 2, payout: 100 }),  // 0,33×
      makeBet({ id: "2", stake: 100, status: "lost", odds: 2, payout: 0 }),  // 0,66×
      makeBet({ id: "3", stake: 300, status: "won", odds: 2, payout: 600 }), // 2,0×
    ];
    const labels = segmentByStakeBand(makeState(bets)).map((s) => s.label);
    expect(labels).toContain("< 0,5× média");
    expect(labels).toContain("0,5–1× média");
    expect(labels).toContain("≥ 2× média");
    expect(labels).not.toContain("1–2× média");
  });

  it("retorna vazio sem apostas", () => {
    expect(segmentByStakeBand(makeState([]))).toEqual([]);
  });
});

describe("segmentByDayOfWeek", () => {
  it("agrupa por dia da semana e mantém só dias com apostas", () => {
    const mon = new Date(2026, 5, 15, 12).toISOString(); // 15/jun/2026 = segunda
    const tue = new Date(2026, 5, 16, 12).toISOString(); // 16/jun/2026 = terça
    const bets = [
      makeBet({ id: "1", placedAt: mon, status: "won", stake: 100, payout: 200 }),
      makeBet({ id: "2", placedAt: tue, status: "lost", stake: 100, payout: 0 }),
      makeBet({ id: "3", placedAt: tue, status: "won", stake: 100, payout: 150 }),
    ];
    const segments = segmentByDayOfWeek(makeState(bets));
    const labels = segments.map((s) => s.label);
    expect(labels).toContain("Seg");
    expect(labels).toContain("Ter");
    expect(segments.find((s) => s.label === "Ter")?.bets).toBe(2);
    expect(labels.indexOf("Seg")).toBeLessThan(labels.indexOf("Ter")); // ordem Dom→Sáb
  });
});

describe("segmentByMarket", () => {
  it("agrupa por mercado, ordenado por volume apostado", () => {
    const bets = [
      makeBet({ id: "1", market: "Over/Under", stake: 100, status: "won", payout: 180 }),
      makeBet({ id: "2", market: "Over/Under", stake: 100, status: "lost", payout: 0 }),
      makeBet({ id: "3", market: "1x2", stake: 50, status: "won", payout: 120 }),
    ];
    const segments = segmentByMarket(makeState(bets));
    expect(segments[0].label).toBe("Over/Under"); // maior volume (200) primeiro
    expect(segments[0].bets).toBe(2);
    expect(segments[1].label).toBe("1x2");
  });
});

describe("segmentByLeague", () => {
  it("agrupa por liga, ordenado por volume apostado", () => {
    const bets = [
      makeBet({ id: "1", league: "Brasileirão", stake: 100, status: "won", payout: 180 }),
      makeBet({ id: "2", league: "Brasileirão", stake: 100, status: "lost", payout: 0 }),
      makeBet({ id: "3", league: "Premier League", stake: 50, status: "won", payout: 100 }),
    ];
    const segments = segmentByLeague(makeState(bets));
    expect(segments[0].label).toBe("Brasileirão");
    expect(segments[0].bets).toBe(2);
    expect(segments[1].label).toBe("Premier League");
  });
});

describe("bettingStreaks", () => {
  it("calcula maior sequência de green e de red", () => {
    const mk = (id: string, day: number, won: boolean) =>
      makeBet({
        id,
        placedAt: new Date(2026, 5, day, 12).toISOString(),
        status: won ? "won" : "lost",
        stake: 100,
        payout: won ? 200 : 0,
      });
    const bets = [mk("1", 1, true), mk("2", 2, true), mk("3", 3, true), mk("4", 4, false), mk("5", 5, false), mk("6", 6, true)];
    const s = bettingStreaks(makeState(bets));
    expect(s.longestGreen).toBe(3);
    expect(s.longestRed).toBe(2);
    expect(s.greens).toBe(4);
    expect(s.reds).toBe(2);
    expect(s.avgStake).toBe(100);
  });

  it("zera com estado vazio", () => {
    const s = bettingStreaks(makeState([]));
    expect(s.longestGreen).toBe(0);
    expect(s.reds).toBe(0);
    expect(s.avgStake).toBe(0);
  });
});
