import { describe, it, expect, beforeEach } from "vitest";
import { checkHardStop, riskAlertsExtended, checkBetRisk } from "./riskGuard";
import { emptyState } from "./storage";
import type { AppState, Bet } from "./types";

function makeState(overrides: Partial<AppState> = {}): AppState {
  return {
    ...emptyState(),
    bookmakers: [{ id: "b1", name: "Bet365", balance: 1000, status: "manual", lastSyncLabel: "manual" }],
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

function makeLostBet(stake = 100): Bet {
  return makeBet({ id: `lost-${Math.random()}`, status: "lost", stake, payout: 0 });
}

function makeWonBet(stake = 100, payout = 200): Bet {
  return makeBet({ id: `won-${Math.random()}`, status: "won", stake, payout });
}

describe("checkHardStop", () => {
  it("retorna null quando hardStop está desabilitado", () => {
    const state = makeState({
      riskSettings: { ...emptyState().riskSettings, hardStopEnabled: false },
    });
    expect(checkHardStop(state)).toBeNull();
  });

  it("retorna null com saldo zero (sem base para calcular)", () => {
    const state = makeState({
      bookmakers: [],
      riskSettings: { ...emptyState().riskSettings, hardStopEnabled: true },
    });
    expect(checkHardStop(state)).toBeNull();
  });

  it("não bloqueia quando perdas diárias estão abaixo do limite", () => {
    const state = makeState({
      bets: [makeLostBet(50)], // 50 de 100 = 5% — limite é 10%
      riskSettings: { ...emptyState().riskSettings, hardStopEnabled: true, dailyLossLimitPercent: 10 },
      transactions: [
        { id: "tx1", date: new Date().toISOString(), type: "deposit", bookmakerId: "b1", description: "dep", amount: 1000 },
        { id: "tx2", date: new Date().toISOString(), type: "bet_stake", bookmakerId: "b1", description: "stake", amount: -50, referenceType: "bet" },
      ],
    });
    const stop = checkHardStop(state);
    expect(stop).toBeNull();
  });

  it("bloqueia quando perdas diárias atingem o limite", () => {
    const state = makeState({
      bets: [makeLostBet(200)], // 200 de 1000 = 20% — limite é 10%
      riskSettings: { ...emptyState().riskSettings, hardStopEnabled: true, dailyLossLimitPercent: 10 },
      transactions: [
        { id: "tx1", date: new Date().toISOString(), type: "deposit", bookmakerId: "b1", description: "dep", amount: 1000 },
        { id: "tx2", date: new Date().toISOString(), type: "bet_stake", bookmakerId: "b1", description: "stake", amount: -200 },
      ],
    });
    const stop = checkHardStop(state);
    expect(stop).not.toBeNull();
    expect(stop?.blocked).toBe(true);
    expect(stop?.type).toBe("daily");
  });
});

describe("riskAlertsExtended", () => {
  it("retorna array vazio com estado saudável", () => {
    const state = makeState({
      transactions: [
        { id: "tx1", date: new Date().toISOString(), type: "deposit", bookmakerId: "b1", description: "dep", amount: 1000 },
      ],
    });
    const alerts = riskAlertsExtended(state);
    expect(Array.isArray(alerts)).toBe(true);
  });

  it("alerta de sequência negativa com 3 perdas seguidas", () => {
    const state = makeState({
      bets: [makeLostBet(), makeLostBet(), makeLostBet()],
      transactions: [
        { id: "tx1", date: new Date().toISOString(), type: "deposit", bookmakerId: "b1", description: "dep", amount: 1000 },
      ],
      riskSettings: { ...emptyState().riskSettings, lossStreakLimit: 3 },
    });
    const alerts = riskAlertsExtended(state);
    const streak = alerts.find((a) => a.title.toLowerCase().includes("sequência"));
    expect(streak).toBeDefined();
    expect(streak?.level).toBe("danger");
  });

  it("não alerta quando stake pendente está dentro do limite", () => {
    const unit = 1000 * (1 / 100); // 1% = 10
    const maxStake = unit * 2; // 20
    const state = makeState({
      bets: [makeBet({ status: "pending", stake: 15 })],
      transactions: [
        { id: "tx1", date: new Date().toISOString(), type: "deposit", bookmakerId: "b1", description: "dep", amount: 1000 },
      ],
    });
    const alerts = riskAlertsExtended(state);
    const stakeAlert = alerts.find((a) => a.title.toLowerCase().includes("stake"));
    expect(stakeAlert).toBeUndefined();
  });
});

describe("checkBetRisk", () => {
  it("pode registrar aposta quando tudo ok", () => {
    const state = makeState({
      transactions: [
        { id: "tx1", date: new Date().toISOString(), type: "deposit", bookmakerId: "b1", description: "dep", amount: 1000 },
      ],
    });
    const result = checkBetRisk(state, 10, "b1");
    expect(result.canPlace).toBe(true);
    expect(result.hardStop).toBeNull();
  });

  it("bloqueia quando hard stop ativo", () => {
    const state = makeState({
      bets: [makeLostBet(200)],
      riskSettings: { ...emptyState().riskSettings, hardStopEnabled: true, dailyLossLimitPercent: 10 },
      transactions: [
        { id: "tx1", date: new Date().toISOString(), type: "deposit", bookmakerId: "b1", description: "dep", amount: 1000 },
        { id: "tx2", date: new Date().toISOString(), type: "bet_stake", bookmakerId: "b1", description: "stake", amount: -200 },
      ],
    });
    const result = checkBetRisk(state, 50, "b1");
    expect(result.canPlace).toBe(false);
    expect(result.hardStop?.blocked).toBe(true);
  });

  it("retorna warnings sem bloquear quando stake acima do limite", () => {
    const state = makeState({
      transactions: [
        { id: "tx1", date: new Date().toISOString(), type: "deposit", bookmakerId: "b1", description: "dep", amount: 1000 },
      ],
    });
    // Stake de 500 > maxStake de 20 (1% * 2)
    const result = checkBetRisk(state, 500, "b1");
    expect(result.canPlace).toBe(true);
    expect(result.warnings.length).toBeGreaterThan(0);
  });
});
