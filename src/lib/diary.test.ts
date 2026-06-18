import { describe, it, expect } from "vitest";
import { buildDiary } from "./diary";
import { emptyState } from "./storage";
import type { AppState, Bet } from "./types";

function makeBet(overrides: Partial<Bet>): Bet {
  return {
    id: "b",
    placedAt: new Date(2026, 5, 27, 18, 0).toISOString(),
    eventAt: new Date(2026, 5, 27, 21, 0).toISOString(),
    sport: "Futebol",
    league: "Copa do Mundo",
    eventName: "Brasil x Haiti",
    market: "Moneyline",
    selection: "Brasil",
    bookmakerId: "bk",
    tags: [],
    stake: 100,
    odds: 1.5,
    status: "pending",
    mode: "prelive",
    ...overrides,
  };
}

function makeState(bets: Bet[]): AppState {
  return { ...emptyState(), bets };
}

describe("buildDiary", () => {
  it("retorna vazio sem apostas", () => {
    expect(buildDiary(makeState([]))).toEqual([]);
  });

  it("agrupa por mês e dia com subtotais de P&L", () => {
    const bets = [
      makeBet({ id: "1", placedAt: new Date(2026, 5, 27, 18).toISOString(), status: "won", stake: 100, payout: 250 }), // +150
      makeBet({ id: "2", placedAt: new Date(2026, 5, 27, 20).toISOString(), status: "lost", stake: 100, payout: 0 }),  // -100
      makeBet({ id: "3", placedAt: new Date(2026, 5, 26, 12).toISOString(), status: "won", stake: 50, payout: 100 }),  // +50, outro dia
    ];
    const months = buildDiary(makeState(bets));
    expect(months).toHaveLength(1);
    expect(months[0].betCount).toBe(3);
    expect(months[0].profit).toBeCloseTo(100); // 150 - 100 + 50
    expect(months[0].days).toHaveLength(2);
    // dia mais recente primeiro
    expect(months[0].days[0].key).toBe("2026-06-27");
    expect(months[0].days[0].profit).toBeCloseTo(50); // 150 - 100
    expect(months[0].days[0].bets).toHaveLength(2);
  });

  it("ordena meses do mais recente para o mais antigo", () => {
    const bets = [
      makeBet({ id: "jun", placedAt: new Date(2026, 5, 10).toISOString() }),
      makeBet({ id: "mai", placedAt: new Date(2026, 4, 10).toISOString() }),
    ];
    const months = buildDiary(makeState(bets));
    expect(months.map((m) => m.key)).toEqual(["2026-06", "2026-05"]);
  });
});
