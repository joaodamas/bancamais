import { describe, it, expect } from "vitest";
import { analyzeEdge, edgeConfidence, edgeHighlights, classifyRadar, opportunityRadar } from "./edgeAnalysis";
import type { EdgeSegment } from "./edgeAnalysis";
import { emptyState } from "./storage";
import type { AppState, Bet } from "./types";

function makeBet(o: Partial<Bet>): Bet {
  return {
    id: `b-${Math.random()}`,
    placedAt: "2026-06-01T00:00:00Z",
    eventAt: "2026-06-01T20:00:00Z",
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

describe("edgeConfidence", () => {
  it("escala por tamanho de amostra", () => {
    expect(edgeConfidence(2)).toBe("low");
    expect(edgeConfidence(8)).toBe("medium");
    expect(edgeConfidence(25)).toBe("high");
  });
});

describe("analyzeEdge", () => {
  it("segmenta por mercado com ROI/hit-rate/lucro corretos", () => {
    const bets = [
      makeBet({ market: "Over 2.5", stake: 100, odds: 2, status: "won", payout: 200 }),
      makeBet({ market: "Over 2.5", stake: 100, odds: 2, status: "lost", payout: 0 }),
      makeBet({ market: "BTTS", stake: 100, odds: 1.5, status: "lost", payout: 0 }),
    ];
    const segs = analyzeEdge(state(bets), "market");
    const over = segs.find((s) => s.key === "Over 2.5")!;
    expect(over.bets).toBe(2);
    expect(over.staked).toBe(200);
    expect(over.profit).toBe(0); // +100 / -100
    expect(over.roi).toBe(0);
    expect(over.hitRate).toBe(0.5);
    const btts = segs.find((s) => s.key === "BTTS")!;
    expect(btts.profit).toBe(-100);
    expect(btts.roi).toBe(-1);
  });

  it("ignora pendentes", () => {
    const bets = [makeBet({ status: "pending", payout: undefined }), makeBet({ status: "won" })];
    const segs = analyzeEdge(state(bets), "sport");
    expect(segs[0].bets).toBe(1);
  });

  it("conta uma aposta em cada tag (multi-tag)", () => {
    const bets = [makeBet({ tags: ["value", "ev"] }), makeBet({ tags: ["value"] })];
    const segs = analyzeEdge(state(bets), "tag");
    expect(segs.find((s) => s.key === "value")!.bets).toBe(2);
    expect(segs.find((s) => s.key === "ev")!.bets).toBe(1);
  });

  it("respeita minBets", () => {
    const bets = [makeBet({ league: "UCL" }), makeBet({ league: "Premier" })];
    expect(analyzeEdge(state(bets), "league", 2)).toHaveLength(0);
  });

  it("calcula CLV médio só de quem tem odd de fechamento", () => {
    const bets = [
      makeBet({ market: "X", odds: 2.0, closingOdds: 1.8 }),
      makeBet({ market: "X", odds: 2.0 }),
    ];
    const seg = analyzeEdge(state(bets), "market")[0];
    expect(seg.clvAvg).not.toBeNull();
  });
});

describe("edgeHighlights", () => {
  it("destaca melhor e pior por ROI com amostra >= 3", () => {
    const good = Array.from({ length: 4 }, () => makeBet({ market: "Bom", status: "won", payout: 200 }));
    const bad = Array.from({ length: 4 }, () => makeBet({ market: "Ruim", status: "lost", payout: 0 }));
    const { best, worst } = edgeHighlights(state([...good, ...bad]), "market");
    expect(best?.key).toBe("Bom");
    expect(worst?.key).toBe("Ruim");
  });

  it("não destaca segmento de amostra pequena", () => {
    const bets = [makeBet({ market: "Solo", status: "won", payout: 500 })];
    expect(edgeHighlights(state(bets), "market")).toEqual({ best: null, worst: null });
  });
});

describe("classifyRadar", () => {
  function seg(o: Partial<EdgeSegment>): EdgeSegment {
    return { key: "X", bets: 20, staked: 1000, profit: 0, roi: 0, hitRate: 0.5, clvAvg: null, confidence: "high", ...o };
  }
  it("goldmine: edge positivo + pouca exposição", () => {
    expect(classifyRadar(seg({ roi: 0.12, confidence: "high" }), 0.05)).toBe("goldmine");
  });
  it("drain: prejuízo + muita exposição", () => {
    expect(classifyRadar(seg({ roi: -0.1, confidence: "high" }), 0.30)).toBe("drain");
  });
  it("neutral quando amostra baixa, mesmo com edge alto", () => {
    expect(classifyRadar(seg({ roi: 0.2, confidence: "low" }), 0.02)).toBe("neutral");
  });
  it("neutral: edge bom mas já bem exposto", () => {
    expect(classifyRadar(seg({ roi: 0.12, confidence: "high" }), 0.40)).toBe("neutral");
  });
});

describe("opportunityRadar", () => {
  it("calcula fatia de exposição e marca goldmine sub-alocado", () => {
    // Segmento "Nicho": 4 vitórias (ROI alto), pouca exposição vs o resto
    const nicho = Array.from({ length: 8 }, () => makeBet({ market: "Nicho", stake: 10, status: "won", payout: 25 }));
    const resto = Array.from({ length: 8 }, () => makeBet({ market: "Comum", stake: 200, status: "lost", payout: 0 }));
    const signals = opportunityRadar(state([...nicho, ...resto]), "market");
    const nichoSig = signals.find((s) => s.segment.key === "Nicho")!;
    expect(nichoSig.exposureShare).toBeLessThan(0.15);
    expect(nichoSig.verdict).toBe("goldmine");
  });
});
