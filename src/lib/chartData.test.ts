import { describe, it, expect } from "vitest";
import { buildRealizedDrawdown } from "./chartData";
import { emptyState } from "./storage";
import type { AppState, Bet } from "./types";

function bet(p: Partial<Bet>): Bet {
  return {
    id: p.id ?? Math.random().toString(),
    placedAt: "2026-06-01T10:00:00.000Z",
    eventAt: "2026-06-01T16:00:00.000Z",
    sport: "Futebol", league: "L", eventName: "E", market: "M", selection: "S",
    bookmakerId: "b1", tags: [], mode: "prelive",
    stake: 100, odds: 2, status: "pending",
    ...p,
  };
}

function state(bets: Bet[]): AppState {
  return {
    ...emptyState(),
    bookmakers: [{ id: "b1", name: "B", balance: 0, status: "manual", lastSyncLabel: "" }],
    bets,
    transactions: [
      { id: "dep", date: "2026-05-01T00:00:00.000Z", type: "deposit", bookmakerId: "b1", description: "d", amount: 150 },
    ],
  };
}

describe("buildRealizedDrawdown", () => {
  it("aposta ganha que consome toda a banca NÃO gera drawdown fantasma", () => {
    // Antes: a curva de caixa caía a 0 ao apostar 150 → -100% fantasma.
    const dd = buildRealizedDrawdown(state([
      bet({ id: "1", status: "won", stake: 150, odds: 2, payout: 300 }),
    ]));
    expect(dd.worstAbs).toBe(0);
    expect(dd.worstPct).toBe(0);
  });

  it("mede o vale real de resultados liquidados no vermelho", () => {
    const dd = buildRealizedDrawdown(state([
      bet({ id: "1", placedAt: "2026-06-01T10:00:00Z", eventAt: "2026-06-01T10:00:00Z", status: "won", stake: 100, odds: 2, payout: 200 }),  // +100 → pico 100
      bet({ id: "2", placedAt: "2026-06-02T10:00:00Z", eventAt: "2026-06-02T10:00:00Z", status: "lost", stake: 150, odds: 2, payout: 0 }),   // -150 → vale
    ]));
    expect(dd.worstAbs).toBe(150);           // queda de 100 para -50
    expect(dd.worstPct).toBeLessThan(0);     // negativo
    expect(dd.worstPct).toBeGreaterThan(-1); // e NÃO -100%
  });

  it("sem apostas liquidadas, drawdown é zero", () => {
    const dd = buildRealizedDrawdown(state([bet({ id: "1", status: "pending" })]));
    expect(dd.worstAbs).toBe(0);
    expect(dd.series).toHaveLength(0);
  });
});
