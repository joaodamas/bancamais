import { describe, it, expect } from "vitest";
import { betProfit, potentialReturn, clvPercent, calculateMetrics } from "./metrics";
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

  it("calcula ROI corretamente", () => {
    const bets: Bet[] = [
      makeBet({ id: "1", status: "won", stake: 100, odds: 2.0, payout: 200 }),
      makeBet({ id: "2", status: "lost", stake: 100, odds: 2.0, payout: 0 }),
    ];
    const m = calculateMetrics(makeState(bets));
    // Lucro = 100 - 100 = 0, ROI = 0/200 = 0
    expect(m.profit).toBe(0);
    expect(m.roi).toBe(0);
    expect(m.hitRate).toBe(0.5);
    expect(m.settledCount).toBe(2);
  });

  it("calcula ROI positivo", () => {
    const bets: Bet[] = [
      makeBet({ id: "1", status: "won", stake: 100, odds: 3.0, payout: 300 }),
      makeBet({ id: "2", status: "lost", stake: 100, odds: 2.0, payout: 0 }),
    ];
    const m = calculateMetrics(makeState(bets));
    expect(m.profit).toBe(100); // 200 - 100
    expect(m.roi).toBe(0.5);    // 100 / 200
    expect(m.hitRate).toBe(0.5);
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
