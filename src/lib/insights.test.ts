import { describe, it, expect } from "vitest";
import { buildInsights } from "./insights";
import { emptyState } from "./storage";
import type { AppState, Bet } from "./types";

function makeBet(overrides: Partial<Bet>): Bet {
  return {
    id: "b",
    placedAt: new Date(2026, 5, 10, 12).toISOString(),
    eventAt: new Date(2026, 5, 10, 21).toISOString(),
    sport: "Futebol",
    league: "Brasileirão",
    eventName: "A x B",
    market: "Over 2.5",
    selection: "Over",
    bookmakerId: "bk",
    tags: [],
    stake: 100,
    odds: 1.9,
    status: "pending",
    mode: "prelive",
    ...overrides,
  };
}

function makeState(bets: Bet[]): AppState {
  return { ...emptyState(), bets };
}

describe("buildInsights", () => {
  it("retorna vazio sem amostra mínima", () => {
    expect(buildInsights(makeState([makeBet({ status: "won", payout: 190 })]))).toEqual([]);
  });

  it("destaca o mercado mais lucrativo quando há amostra e edge", () => {
    const bets = [
      makeBet({ id: "1", market: "Over 2.5", status: "won", stake: 100, payout: 200 }),
      makeBet({ id: "2", market: "Over 2.5", status: "won", stake: 100, payout: 200 }),
      makeBet({ id: "3", market: "Over 2.5", status: "won", stake: 100, payout: 200 }),
      makeBet({ id: "4", market: "Over 2.5", status: "lost", stake: 100, payout: 0 }),
    ];
    const insights = buildInsights(makeState(bets));
    expect(insights.some((i) => i.tone === "positive" && i.title.includes("Over 2.5"))).toBe(true);
  });
});
