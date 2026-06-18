import { describe, it, expect } from "vitest";
import { detectTilt } from "./tiltDetection";
import { emptyState } from "./storage";
import type { AppState, Bet } from "./types";

function makeState(bets: Bet[]): AppState {
  return { ...emptyState(), bets };
}

function makeBet(overrides: Partial<Bet> & { hoursAgo?: number } = {}): Bet {
  const { hoursAgo = 1, ...rest } = overrides;
  const placedAt = new Date(Date.now() - hoursAgo * 3600 * 1000).toISOString();
  return {
    id: `b-${Math.random()}`,
    placedAt,
    eventAt: placedAt,
    sport: "Futebol",
    league: "UCL",
    eventName: `Evento ${Math.random()}`,
    market: "Resultado",
    selection: "Casa",
    bookmakerId: "b1",
    tags: [],
    stake: 100,
    odds: 2.0,
    status: "pending",
    mode: "prelive",
    ...rest,
  };
}

describe("detectTilt — volume insuficiente", () => {
  it("retorna none com menos de 3 apostas", () => {
    const tilt = detectTilt(makeState([makeBet(), makeBet()]));
    expect(tilt.level).toBe("none");
    expect(tilt.score).toBe(0);
    expect(tilt.signals).toHaveLength(0);
  });
});

describe("detectTilt — histórico saudável", () => {
  it("score zero com apostas antigas distribuídas", () => {
    const bets = Array.from({ length: 10 }, (_, i) =>
      makeBet({ status: "won", hoursAgo: (i + 1) * 48 }),
    );
    const tilt = detectTilt(makeState(bets));
    expect(tilt.score).toBe(0);
    expect(tilt.level).toBe("none");
  });
});

describe("detectTilt — loss_chasing", () => {
  it("detecta 4 perdas consecutivas no topo da lista", () => {
    const bets = [
      makeBet({ status: "lost", hoursAgo: 0.5 }),
      makeBet({ status: "lost", hoursAgo: 1 }),
      makeBet({ status: "lost", hoursAgo: 2 }),
      makeBet({ status: "lost", hoursAgo: 3 }),
      ...Array.from({ length: 8 }, (_, i) => makeBet({ status: "won", hoursAgo: (i + 2) * 24 })),
    ];
    const tilt = detectTilt(makeState(bets));
    const signal = tilt.signals.find((s) => s.type === "loss_chasing");
    expect(signal).toBeDefined();
    expect(tilt.score).toBeGreaterThanOrEqual(40);
  });

  it("não dispara com 2 perdas consecutivas (abaixo do threshold)", () => {
    const bets = [
      makeBet({ status: "lost", hoursAgo: 1 }),
      makeBet({ status: "lost", hoursAgo: 2 }),
      makeBet({ status: "won",  hoursAgo: 3 }),
      ...Array.from({ length: 8 }, (_, i) => makeBet({ status: "won", hoursAgo: (i + 4) * 24 })),
    ];
    const tilt = detectTilt(makeState(bets));
    const signal = tilt.signals.find((s) => s.type === "loss_chasing");
    expect(signal).toBeUndefined();
  });
});

describe("detectTilt — stake_escalation", () => {
  it("detecta quando stake recente é 1.8× a histórica", () => {
    const historical = Array.from({ length: 15 }, (_, i) =>
      makeBet({ stake: 50, status: "won", hoursAgo: (i + 3) * 48 }),
    );
    const recent = Array.from({ length: 5 }, (_, i) =>
      makeBet({ stake: 100, status: "pending", hoursAgo: i * 0.5 }),
    );
    const tilt = detectTilt(makeState([...recent, ...historical]));
    const signal = tilt.signals.find((s) => s.type === "stake_escalation");
    expect(signal).toBeDefined();
  });

  it("não dispara com variação menor que 1.4×", () => {
    const bets = Array.from({ length: 15 }, (_, i) =>
      makeBet({ stake: 100, status: "won", hoursAgo: i * 12 }),
    );
    const tilt = detectTilt(makeState(bets));
    const signal = tilt.signals.find((s) => s.type === "stake_escalation");
    expect(signal).toBeUndefined();
  });
});

describe("detectTilt — rapid_sequence", () => {
  it("detecta 4+ apostas nas últimas 2h com 2+ perdas", () => {
    const bets = [
      makeBet({ status: "lost", hoursAgo: 0.2 }),
      makeBet({ status: "lost", hoursAgo: 0.5 }),
      makeBet({ status: "pending", hoursAgo: 0.8 }),
      makeBet({ status: "pending", hoursAgo: 1.0 }),
      ...Array.from({ length: 8 }, (_, i) => makeBet({ status: "won", hoursAgo: (i + 3) * 24 })),
    ];
    const tilt = detectTilt(makeState(bets));
    const signal = tilt.signals.find((s) => s.type === "rapid_sequence");
    expect(signal).toBeDefined();
  });
});

describe("detectTilt — níveis", () => {
  it("level none quando score = 0", () => {
    const bets = Array.from({ length: 5 }, () => makeBet({ status: "won", hoursAgo: 72 }));
    expect(detectTilt(makeState(bets)).level).toBe("none");
  });

  it("recentLossAmount acumula perdas das últimas 24h", () => {
    const bets = [
      makeBet({ status: "lost", stake: 100, hoursAgo: 1 }),
      makeBet({ status: "lost", stake: 200, hoursAgo: 2 }),
      makeBet({ status: "lost", stake: 50,  hoursAgo: 25 }), // fora da janela
      ...Array.from({ length: 7 }, () => makeBet({ status: "won", hoursAgo: 72 })),
    ];
    const tilt = detectTilt(makeState(bets));
    expect(tilt.recentLossAmount).toBe(300);
  });
});
