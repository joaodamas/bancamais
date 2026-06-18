import { describe, it, expect } from "vitest";
import { shouldFetchClosing, collectBetsNeedingClosing } from "./closingOdds";
import type { Bet } from "./types";

const NOW = Date.parse("2026-06-18T12:00:00Z");

function makeBet(overrides: Partial<Bet> = {}): Bet {
  return {
    id: "b1",
    placedAt: "2026-06-17T10:00:00Z",
    eventAt: "2026-06-19T12:00:00Z", // 24h no futuro — dentro da janela
    sport: "Futebol",
    league: "Premier League",
    eventName: "Arsenal x Chelsea",
    market: "Moneyline",
    selection: "Arsenal",
    bookmakerId: "bk1",
    tags: [],
    stake: 100,
    odds: 1.9,
    status: "pending",
    mode: "prelive",
    ...overrides,
  };
}

describe("shouldFetchClosing", () => {
  it("busca quando pendente, sem closingOdds e evento na janela pré-kickoff", () => {
    expect(shouldFetchClosing(makeBet(), NOW)).toBe(true);
  });

  it("ignora aposta já liquidada", () => {
    expect(shouldFetchClosing(makeBet({ status: "won" }), NOW)).toBe(false);
  });

  it("ignora aposta que já tem closingOdds (cache imutável)", () => {
    expect(shouldFetchClosing(makeBet({ closingOdds: 1.85 }), NOW)).toBe(false);
  });

  it("ignora evento que já começou (some do feed grátis)", () => {
    expect(shouldFetchClosing(makeBet({ eventAt: "2026-06-18T10:00:00Z" }), NOW)).toBe(false);
  });

  it("ignora evento distante demais (fora da janela de 48h)", () => {
    expect(shouldFetchClosing(makeBet({ eventAt: "2026-06-25T12:00:00Z" }), NOW)).toBe(false);
  });

  it("ignora eventAt inválido", () => {
    expect(shouldFetchClosing(makeBet({ eventAt: "data-invalida" }), NOW)).toBe(false);
  });
});

describe("collectBetsNeedingClosing", () => {
  it("mapeia só as apostas elegíveis para o payload do callable", () => {
    const bets = [
      makeBet({ id: "ok" }),
      makeBet({ id: "settled", status: "lost" }),
      makeBet({ id: "hasclosing", closingOdds: 2.0 }),
      makeBet({ id: "distante", eventAt: "2026-07-01T12:00:00Z" }),
    ];

    const result = collectBetsNeedingClosing(bets, NOW);

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      betId: "ok",
      sport: "Futebol",
      league: "Premier League",
      eventName: "Arsenal x Chelsea",
      selection: "Arsenal",
    });
  });
});
