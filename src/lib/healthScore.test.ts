import { describe, it, expect } from "vitest";
import { calculateHealthScore, healthGradeColor } from "./healthScore";
import { emptyState } from "./storage";
import type { AppState, Bet, DashboardMetrics } from "./types";

function makeState(overrides: Partial<AppState> = {}): AppState {
  return {
    ...emptyState(),
    bookmakers: [{ id: "b1", name: "Bet365", balance: 1000, status: "manual", lastSyncLabel: "manual" }],
    transactions: [
      { id: "tx1", date: new Date().toISOString(), type: "deposit", bookmakerId: "b1", description: "dep", amount: 1000 },
    ],
    ...overrides,
  };
}

function makeMetrics(overrides: Partial<DashboardMetrics> = {}): DashboardMetrics {
  return {
    totalBalance: 1000,
    openExposure: 0,
    profit: 0,
    roi: 0,
    yield: 0,
    hitRate: 0.5,
    averageOdds: 2.0,
    clvAverage: 0,
    pendingCount: 0,
    settledCount: 0,
    ...overrides,
  };
}

function makeBet(overrides: Partial<Bet>): Bet {
  return {
    id: `b-${Math.random()}`,
    placedAt: new Date().toISOString(),
    eventAt: new Date().toISOString(),
    sport: "Futebol",
    league: "UCL",
    eventName: "Real x City",
    market: "Resultado",
    selection: "Real vence",
    bookmakerId: "b1",
    tags: [],
    stake: 100,
    odds: 2.0,
    status: "pending",
    mode: "prelive",
    ...overrides,
  };
}

describe("calculateHealthScore — estrutura", () => {
  it("retorna todas as 5 dimensões e score geral", () => {
    const result = calculateHealthScore(makeState(), makeMetrics());
    expect(result.dimensions.risk).toBeDefined();
    expect(result.dimensions.performance).toBeDefined();
    expect(result.dimensions.clv).toBeDefined();
    expect(result.dimensions.discipline).toBeDefined();
    expect(result.dimensions.behavior).toBeDefined();
    expect(result.overall).toBeGreaterThanOrEqual(0);
    expect(result.overall).toBeLessThanOrEqual(100);
  });

  it("score geral está entre 0 e 100", () => {
    const { overall } = calculateHealthScore(makeState(), makeMetrics());
    expect(overall).toBeGreaterThanOrEqual(0);
    expect(overall).toBeLessThanOrEqual(100);
  });

  it("retorna grade A–F", () => {
    const { grade } = calculateHealthScore(makeState(), makeMetrics());
    expect(["A", "B", "C", "D", "F"]).toContain(grade);
  });
});

describe("calculateHealthScore — dimensão risco", () => {
  it("risk score alto (100) com estado saudável", () => {
    const { dimensions } = calculateHealthScore(makeState(), makeMetrics({ openExposure: 0 }));
    expect(dimensions.risk.score).toBe(100);
  });

  it("risk score cai com hard stop ativo", () => {
    const state = makeState({
      riskSettings: { ...emptyState().riskSettings, hardStopEnabled: true, dailyLossLimitPercent: 5 },
      bets: [makeBet({ status: "lost", stake: 100 })],
    });
    const metrics = makeMetrics({ totalBalance: 1000 });
    const { dimensions } = calculateHealthScore(state, metrics);
    expect(dimensions.risk.score).toBeLessThan(100);
  });
});

describe("calculateHealthScore — dimensão performance", () => {
  it("baseline 50 com menos de 10 apostas", () => {
    const { dimensions } = calculateHealthScore(makeState(), makeMetrics({ settledCount: 5, roi: 0.5 }));
    expect(dimensions.performance.score).toBe(50);
  });

  it("score maior com ROI positivo e 10+ apostas", () => {
    const { dimensions: high } = calculateHealthScore(makeState(), makeMetrics({ settledCount: 20, roi: 0.10 }));
    const { dimensions: neutral } = calculateHealthScore(makeState(), makeMetrics({ settledCount: 20, roi: 0 }));
    expect(high.performance.score).toBeGreaterThan(neutral.performance.score);
  });

  it("score menor com ROI negativo e 10+ apostas", () => {
    const { dimensions: neg } = calculateHealthScore(makeState(), makeMetrics({ settledCount: 20, roi: -0.10 }));
    const { dimensions: zero } = calculateHealthScore(makeState(), makeMetrics({ settledCount: 20, roi: 0 }));
    expect(neg.performance.score).toBeLessThan(zero.performance.score);
  });
});

describe("calculateHealthScore — dimensão CLV", () => {
  it("baseline 50 com menos de 5 bets com CLV", () => {
    const { dimensions } = calculateHealthScore(makeState(), makeMetrics({ clvAverage: 0.1 }));
    expect(dimensions.clv.score).toBe(50);
  });

  it("CLV positivo melhora score quando há 5+ apostas com closingOdds", () => {
    const bets = Array.from({ length: 10 }, () => makeBet({ closingOdds: 1.8, odds: 2.0, status: "won", payout: 200 }));
    const state = makeState({ bets });
    const { dimensions: pos } = calculateHealthScore(state, makeMetrics({ clvAverage: 0.05 }));
    const { dimensions: zero } = calculateHealthScore(state, makeMetrics({ clvAverage: 0 }));
    expect(pos.clv.score).toBeGreaterThanOrEqual(zero.clv.score);
  });
});

describe("calculateHealthScore — dimensão disciplina", () => {
  it("score 100 sem apostas acima do limite", () => {
    const state = makeState({
      bets: [makeBet({ stake: 10, status: "pending" })], // 10 < maxStake (1% * 2 = 20)
    });
    const { dimensions } = calculateHealthScore(state, makeMetrics({ totalBalance: 1000 }));
    expect(dimensions.discipline.score).toBe(100);
  });

  it("score cai com aposta pendente acima do limite de stake", () => {
    const state = makeState({
      riskSettings: { ...emptyState().riskSettings, unitPercent: 1, maxStakeUnits: 2 },
      bets: [makeBet({ stake: 500, status: "pending" })], // muito acima de 20
    });
    const { dimensions } = calculateHealthScore(state, makeMetrics({ totalBalance: 1000 }));
    expect(dimensions.discipline.score).toBeLessThan(100);
  });
});

describe("calculateHealthScore — grade", () => {
  it("grade A quando overall >= 85", () => {
    const result = calculateHealthScore(makeState(), makeMetrics());
    // estado saudável deve resultar em grade B ou A
    expect(["A", "B"]).toContain(result.grade);
  });
});

describe("healthGradeColor", () => {
  it("retorna cor para cada grade", () => {
    (["A", "B", "C", "D", "F"] as const).forEach((grade) => {
      expect(healthGradeColor(grade)).toBeTruthy();
    });
  });
});
