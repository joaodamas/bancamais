import { describe, it, expect } from "vitest";
import {
  BetSchema,
  RiskSettingsSchema,
  QuickBetFormSchema,
  FullBetFormSchema,
  validateQuickBetForm,
  validateFullBetForm,
  validateAppState,
} from "./schemas";

describe("BetSchema", () => {
  const validBet = {
    id: "bet-1",
    placedAt: "2026-05-01T10:00:00.000Z",
    eventAt: "2026-05-07T20:00:00.000Z",
    sport: "Futebol",
    league: "UCL",
    eventName: "Real x City",
    market: "Resultado",
    selection: "Real vence",
    bookmakerId: "book-1",
    tags: [],
    stake: 100,
    odds: 2.0,
    status: "pending" as const,
    mode: "prelive" as const,
  };

  it("valida aposta correta", () => {
    expect(BetSchema.safeParse(validBet).success).toBe(true);
  });

  it("rejeita stake negativa", () => {
    const result = BetSchema.safeParse({ ...validBet, stake: -10 });
    expect(result.success).toBe(false);
  });

  it("rejeita odd menor que 1.01", () => {
    const result = BetSchema.safeParse({ ...validBet, odds: 1.0 });
    expect(result.success).toBe(false);
  });

  it("aceita tags como array vazio por default", () => {
    const { tags: _, ...rest } = validBet;
    const result = BetSchema.safeParse(rest);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.tags).toEqual([]);
  });
});

describe("RiskSettingsSchema", () => {
  const valid = {
    unitPercent: 1,
    maxStakeUnits: 2,
    maxOpenExposurePercent: 5,
    lossStreakLimit: 3,
    hardStopEnabled: false,
    dailyLossLimitPercent: 10,
    weeklyLossLimitPercent: 20,
    monthlyDrawdownPercent: 30,
  };

  it("valida configurações corretas", () => {
    expect(RiskSettingsSchema.safeParse(valid).success).toBe(true);
  });

  it("rejeita unitPercent menor que 0.1", () => {
    expect(RiskSettingsSchema.safeParse({ ...valid, unitPercent: 0 }).success).toBe(false);
  });

  it("rejeita lossStreakLimit decimal", () => {
    expect(RiskSettingsSchema.safeParse({ ...valid, lossStreakLimit: 2.5 }).success).toBe(false);
  });
});

describe("QuickBetFormSchema", () => {
  it("valida formulário correto", () => {
    const result = validateQuickBetForm({
      eventName: "Real x City",
      eventAt: "2026-05-07T20:00",
      bookmakerId: "book-1",
      stake: "100",
      odds: "2.0",
    });
    expect(result.success).toBe(true);
  });

  it("rejeita evento vazio", () => {
    const result = validateQuickBetForm({
      eventName: "",
      eventAt: "2026-05-07T20:00",
      bookmakerId: "book-1",
      stake: "100",
      odds: "2.0",
    });
    expect(result.success).toBe(false);
  });

  it("converte stake string para number", () => {
    const result = validateQuickBetForm({
      eventName: "Real x City",
      eventAt: "2026-05-07T20:00",
      bookmakerId: "book-1",
      stake: "250.50",
      odds: "1.92",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(typeof result.data.stake).toBe("number");
      expect(result.data.stake).toBeCloseTo(250.5);
    }
  });
});

describe("validateAppState", () => {
  it("aceita estado vazio válido", () => {
    const raw = {
      bankrollName: "Minha Banca",
      currency: "BRL",
      startingBalance: 0,
      riskSettings: {
        unitPercent: 1, maxStakeUnits: 2, maxOpenExposurePercent: 5, lossStreakLimit: 3,
        hardStopEnabled: false, dailyLossLimitPercent: 10,
        weeklyLossLimitPercent: 20, monthlyDrawdownPercent: 30,
      },
      bookmakers: [],
      strategies: [],
      bets: [],
      transactions: [],
    };
    expect(validateAppState(raw)).not.toBeNull();
  });

  it("retorna null para dados completamente inválidos", () => {
    expect(validateAppState(null)).toBeNull();
    expect(validateAppState("string")).toBeNull();
    expect(validateAppState(42)).toBeNull();
  });

  it("retorna null quando currency não é BRL", () => {
    const raw = {
      bankrollName: "Test",
      currency: "USD",
      startingBalance: 0,
      riskSettings: {
        unitPercent: 1, maxStakeUnits: 2, maxOpenExposurePercent: 5, lossStreakLimit: 3,
        hardStopEnabled: false, dailyLossLimitPercent: 10,
        weeklyLossLimitPercent: 20, monthlyDrawdownPercent: 30,
      },
      bookmakers: [], strategies: [], bets: [], transactions: [],
    };
    expect(validateAppState(raw)).toBeNull();
  });
});
