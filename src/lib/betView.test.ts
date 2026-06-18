import { describe, it, expect } from "vitest";
import { toBetRowView, bucketForEvent, groupPendingByTime, buildBetRowViews } from "./betView";
import { emptyState } from "./storage";
import type { AppState, Bet } from "./types";

const NOW = new Date("2026-06-18T12:00:00.000Z").getTime();
const iso = (offsetMs: number) => new Date(NOW + offsetMs).toISOString();
const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

const bookmakerById = new Map([["b1", "Bet365"]]);
const strategyById = new Map([["s1", "Value EV"]]);

function makeBet(overrides: Partial<Bet>): Bet {
  return {
    id: `b-${Math.random()}`,
    placedAt: iso(-DAY),
    eventAt: iso(2 * HOUR),
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

describe("toBetRowView", () => {
  it("consolida contexto em uma string e resolve nomes", () => {
    const view = toBetRowView(makeBet({ strategyId: "s1" }), bookmakerById, strategyById, NOW);
    expect(view.context).toBe("Futebol · UCL");
    expect(view.bookmakerName).toBe("Bet365");
    expect(view.strategyName).toBe("Value EV");
  });

  it("usa '—' para casa desconhecida e null para sem estratégia", () => {
    const view = toBetRowView(makeBet({ bookmakerId: "x" }), bookmakerById, strategyById, NOW);
    expect(view.bookmakerName).toBe("—");
    expect(view.strategyName).toBeNull();
  });

  it("calcula retorno e ganho potencial para pendente", () => {
    const view = toBetRowView(makeBet({ stake: 100, odds: 2.5 }), bookmakerById, strategyById, NOW);
    expect(view.returnValue).toBe(250);
    expect(view.gainValue).toBe(150);
  });

  it("usa lucro líquido para liquidada ganha", () => {
    const view = toBetRowView(
      makeBet({ status: "won", stake: 100, odds: 2.0, payout: 200 }),
      bookmakerById, strategyById, NOW,
    );
    expect(view.returnValue).toBe(200);
    expect(view.gainValue).toBe(100);
  });

  it("marca imminent para evento pendente em menos de 1h", () => {
    const view = toBetRowView(makeBet({ eventAt: iso(30 * MIN) }), bookmakerById, strategyById, NOW);
    expect(view.imminent).toBe(true);
    expect(view.delta.state).toBe("imminent");
  });

  it("não marca imminent para aposta já liquidada", () => {
    const view = toBetRowView(
      makeBet({ status: "won", eventAt: iso(30 * MIN) }),
      bookmakerById, strategyById, NOW,
    );
    expect(view.imminent).toBe(false);
  });
});

describe("bucketForEvent", () => {
  it("classifica evento passado como live", () => {
    expect(bucketForEvent(iso(-30 * MIN), NOW)).toBe("live");
  });
  it("classifica evento de hoje à frente como today", () => {
    expect(bucketForEvent(iso(6 * HOUR), NOW)).toBe("today");
  });
  it("classifica amanhã", () => {
    expect(bucketForEvent(iso(DAY), NOW)).toBe("tomorrow");
  });
  it("classifica esta semana", () => {
    expect(bucketForEvent(iso(4 * DAY), NOW)).toBe("thisWeek");
  });
  it("classifica mais tarde", () => {
    expect(bucketForEvent(iso(20 * DAY), NOW)).toBe("later");
  });
});

describe("groupPendingByTime", () => {
  it("agrupa só pendentes, omite grupos vazios e ordena por evento mais próximo", () => {
    const views = [
      toBetRowView(makeBet({ id: "soon", eventAt: iso(40 * MIN) }), bookmakerById, strategyById, NOW),
      toBetRowView(makeBet({ id: "later-today", eventAt: iso(8 * HOUR) }), bookmakerById, strategyById, NOW),
      toBetRowView(makeBet({ id: "tomorrow", eventAt: iso(DAY + HOUR) }), bookmakerById, strategyById, NOW),
      toBetRowView(makeBet({ id: "settled", status: "won", eventAt: iso(2 * HOUR) }), bookmakerById, strategyById, NOW),
    ];
    const groups = groupPendingByTime(views, NOW);
    expect(groups.map((g) => g.bucket)).toEqual(["today", "tomorrow"]);
    expect(groups[0].bets.map((b) => b.id)).toEqual(["soon", "later-today"]);
    expect(groups[0].bets.length).toBe(2);
    expect(groups[1].bets[0].id).toBe("tomorrow");
  });

  it("retorna vazio quando não há pendentes", () => {
    const views = [toBetRowView(makeBet({ status: "lost" }), bookmakerById, strategyById, NOW)];
    expect(groupPendingByTime(views, NOW)).toEqual([]);
  });
});

describe("buildBetRowViews", () => {
  it("constrói views a partir do AppState", () => {
    const state: AppState = {
      ...emptyState(),
      bookmakers: [{ id: "b1", name: "Bet365", balance: 1000, status: "manual", lastSyncLabel: "manual" }],
      bets: [makeBet({ id: "x" })],
    };
    const views = buildBetRowViews(state, NOW);
    expect(views).toHaveLength(1);
    expect(views[0].bookmakerName).toBe("Bet365");
  });
});
