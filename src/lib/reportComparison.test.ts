import { describe, it, expect } from "vitest";
import { compareReports } from "./reportComparison";
import type { ReportSnapshot } from "./types";

function snap(o: Partial<ReportSnapshot>): ReportSnapshot {
  return {
    monthKey: "2026-06",
    periodLabel: "Junho de 2026",
    savedAt: null,
    hasData: true,
    profit: 100,
    yield: 0.05,
    hitRate: 0.5,
    staked: 1000,
    settledCount: 20,
    clvAverage: null,
    topEdges: [],
    behaviorAlert: null,
    summary: "",
    ...o,
  };
}

describe("compareReports", () => {
  it("sem anterior: hasPrevious false", () => {
    expect(compareReports(snap({}), null).hasPrevious).toBe(false);
  });

  it("calcula deltas de lucro, yield e acerto", () => {
    const prev = snap({ periodLabel: "Maio de 2026", profit: 50, yield: 0.03, hitRate: 0.45 });
    const cur = snap({ profit: 340, yield: 0.08, hitRate: 0.55 });
    const c = compareReports(cur, prev);
    expect(c.hasPrevious).toBe(true);
    expect(c.previousLabel).toBe("Maio de 2026");
    expect(c.profitDelta).toBe(290);
    expect(c.yieldDeltaPp).toBeCloseTo(5, 5);
    expect(c.hitRateDeltaPp).toBeCloseTo(10, 5);
    expect(c.lines).toHaveLength(3);
  });

  it("detecta melhora de ROI em mercado presente nos dois meses", () => {
    const prev = snap({ topEdges: [{ key: "Escanteios", profit: 80, roi: 0.12, bets: 10 }] });
    const cur = snap({ topEdges: [{ key: "Escanteios", profit: 140, roi: 0.18, bets: 12 }] });
    const c = compareReports(cur, prev);
    expect(c.edgeShifts).toHaveLength(1);
    expect(c.edgeShifts[0].key).toBe("Escanteios");
    expect(c.edgeShifts[0].deltaPp).toBeCloseTo(6, 5);
  });

  it("ignora mercado que só existe em um dos meses", () => {
    const prev = snap({ topEdges: [{ key: "BTTS", profit: 30, roi: 0.05, bets: 8 }] });
    const cur = snap({ topEdges: [{ key: "Escanteios", profit: 100, roi: 0.2, bets: 10 }] });
    expect(compareReports(cur, prev).edgeShifts).toHaveLength(0);
  });
});
