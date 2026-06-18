import { describe, it, expect } from "vitest";
import { buildExecutiveReport, availableReportMonths } from "./executiveReport";
import { emptyState } from "./storage";
import type { AppState, Bet } from "./types";

function makeBet(o: Partial<Bet>): Bet {
  return {
    id: `b-${Math.random()}`,
    placedAt: "2026-06-01T00:00:00Z",
    eventAt: "2026-06-10T20:00:00Z",
    sport: "Futebol",
    league: "UCL",
    eventName: "A x B",
    market: "Resultado",
    selection: "Casa",
    bookmakerId: "b1",
    tags: [],
    stake: 100,
    odds: 2,
    status: "won",
    payout: 200,
    mode: "prelive",
    ...o,
  };
}

function state(bets: Bet[]): AppState {
  return { ...emptyState(), bets };
}

describe("availableReportMonths", () => {
  it("lista meses com liquidadas, mais recentes primeiro", () => {
    const s = state([
      makeBet({ eventAt: "2026-05-10T20:00:00Z" }),
      makeBet({ eventAt: "2026-06-10T20:00:00Z" }),
      makeBet({ eventAt: "2026-06-15T20:00:00Z", status: "pending", payout: undefined }),
    ]);
    expect(availableReportMonths(s)).toEqual(["2026-06", "2026-05"]);
  });
});

describe("buildExecutiveReport", () => {
  it("calcula performance do mês e o resumo", () => {
    const s = state([
      makeBet({ eventAt: "2026-06-05T20:00:00Z", stake: 100, status: "won", payout: 200 }),
      makeBet({ eventAt: "2026-06-08T20:00:00Z", stake: 100, status: "lost", payout: 0 }),
    ]);
    const r = buildExecutiveReport(s, "2026-06");
    expect(r.performance.settledCount).toBe(2);
    expect(r.performance.staked).toBe(200);
    expect(r.performance.profit).toBe(0);
    expect(r.verdict).toBe("neutro");
    expect(r.periodLabel).toMatch(/2026/);
    expect(r.summary).toContain("2 apostas");
    expect(r.hasData).toBe(true);
  });

  it("isola o mês (não mistura apostas de outros meses)", () => {
    const s = state([
      makeBet({ eventAt: "2026-06-05T20:00:00Z", status: "won", payout: 200 }),
      makeBet({ eventAt: "2026-05-05T20:00:00Z", status: "won", payout: 500 }),
    ]);
    const r = buildExecutiveReport(s, "2026-06");
    expect(r.performance.settledCount).toBe(1);
    expect(r.performance.profit).toBe(100);
  });

  it("lista top mercados lucrativos", () => {
    const s = state([
      makeBet({ eventAt: "2026-06-01T20:00:00Z", market: "Escanteios", status: "won", payout: 300 }),
      makeBet({ eventAt: "2026-06-02T20:00:00Z", market: "Resultado", status: "lost", payout: 0 }),
    ]);
    const r = buildExecutiveReport(s, "2026-06");
    expect(r.topEdges[0].key).toBe("Escanteios");
    expect(r.topEdges.every((e) => e.profit > 0)).toBe(true);
  });

  it("retorna hasData false e resumo de vazio para mês sem apostas", () => {
    const r = buildExecutiveReport(state([]), "2026-06");
    expect(r.hasData).toBe(false);
    expect(r.summary).toContain("Nenhuma aposta");
  });
});
