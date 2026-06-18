import { describe, it, expect } from "vitest";
import { deriveBetSuggestions, leaguesForSport, recentBetDefaults } from "./betSuggestions";
import { emptyState } from "./storage";
import type { AppState, Bet } from "./types";

function makeBet(overrides: Partial<Bet>): Bet {
  return {
    id: `b-${Math.random()}`,
    placedAt: "2026-06-18T12:00:00.000Z",
    eventAt: "2026-06-18T20:00:00.000Z",
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

function makeState(bets: Bet[]): AppState {
  return { ...emptyState(), bets };
}

describe("deriveBetSuggestions", () => {
  it("ranqueia por frequência, mais usado primeiro", () => {
    const state = makeState([
      makeBet({ sport: "Futebol" }),
      makeBet({ sport: "Futebol" }),
      makeBet({ sport: "Basquete" }),
      makeBet({ sport: "Tênis" }),
    ]);
    const s = deriveBetSuggestions(state);
    expect(s.sports[0]).toBe("Futebol");
    expect(s.sports).toContain("Basquete");
    expect(s.sports).toContain("Tênis");
  });

  it("deduplica e ignora valores vazios", () => {
    const state = makeState([
      makeBet({ league: "UCL" }),
      makeBet({ league: "UCL" }),
      makeBet({ league: "" }),
      makeBet({ league: "  " }),
    ]);
    const s = deriveBetSuggestions(state);
    expect(s.leagues).toEqual(["UCL"]);
  });

  it("coleta tags de todas as apostas", () => {
    const state = makeState([
      makeBet({ tags: ["value", "ev"] }),
      makeBet({ tags: ["value"] }),
    ]);
    const s = deriveBetSuggestions(state);
    expect(s.tags[0]).toBe("value");
    expect(s.tags).toContain("ev");
  });

  it("desempata alfabeticamente quando frequência é igual", () => {
    const state = makeState([
      makeBet({ market: "Over 2.5" }),
      makeBet({ market: "BTTS" }),
    ]);
    const s = deriveBetSuggestions(state);
    expect(s.markets).toEqual(["BTTS", "Over 2.5"]);
  });
});

describe("leaguesForSport", () => {
  it("filtra ligas pelo esporte informado", () => {
    const state = makeState([
      makeBet({ sport: "Futebol", league: "UCL" }),
      makeBet({ sport: "Futebol", league: "Premier" }),
      makeBet({ sport: "Basquete", league: "NBA" }),
    ]);
    expect(leaguesForSport(state, "Futebol").sort()).toEqual(["Premier", "UCL"]);
    expect(leaguesForSport(state, "Basquete")).toEqual(["NBA"]);
  });

  it("é case-insensitive e ignora espaços", () => {
    const state = makeState([makeBet({ sport: "Futebol", league: "UCL" })]);
    expect(leaguesForSport(state, "  futebol ")).toEqual(["UCL"]);
  });

  it("retorna todas as ligas quando esporte vazio", () => {
    const state = makeState([
      makeBet({ sport: "Futebol", league: "UCL" }),
      makeBet({ sport: "Basquete", league: "NBA" }),
    ]);
    expect(leaguesForSport(state, "").sort()).toEqual(["NBA", "UCL"]);
  });
});

describe("recentBetDefaults", () => {
  it("usa a última aposta para casa e modo, e o stake mais comum", () => {
    const state = makeState([
      makeBet({ placedAt: "2026-06-10T00:00:00Z", bookmakerId: "b1", stake: 50 }),
      makeBet({ placedAt: "2026-06-15T00:00:00Z", bookmakerId: "b2", mode: "live", stake: 100 }),
      makeBet({ placedAt: "2026-06-12T00:00:00Z", bookmakerId: "b1", stake: 100 }),
    ]);
    const d = recentBetDefaults(state);
    expect(d.bookmakerId).toBe("b2");
    expect(d.mode).toBe("live");
    expect(d.stake).toBe(100);
  });

  it("retorna defaults seguros para estado vazio", () => {
    const d = recentBetDefaults(makeState([]));
    expect(d.bookmakerId).toBeNull();
    expect(d.mode).toBe("prelive");
    expect(d.stake).toBeNull();
  });
});
