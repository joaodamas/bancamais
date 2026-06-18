import { describe, it, expect } from "vitest";
import { saveReportSnapshot, findReportSnapshot, removeReportSnapshot } from "./report.service";
import { emptyState } from "../lib/storage";
import type { ReportSnapshot } from "../lib/types";

function snap(monthKey: string): ReportSnapshot {
  return {
    monthKey,
    periodLabel: monthKey,
    savedAt: null,
    hasData: true,
    profit: 100,
    yield: 0.1,
    hitRate: 0.5,
    staked: 1000,
    settledCount: 10,
    clvAverage: null,
    topEdges: [],
    behaviorAlert: null,
    summary: "resumo",
  };
}

describe("saveReportSnapshot", () => {
  it("congela carimbando savedAt", () => {
    const s = saveReportSnapshot(emptyState(), snap("2026-06"));
    expect(s.reportSnapshots).toHaveLength(1);
    expect(s.reportSnapshots[0].savedAt).not.toBeNull();
  });

  it("substitui o snapshot do mesmo mês (não duplica)", () => {
    let s = saveReportSnapshot(emptyState(), snap("2026-06"));
    s = saveReportSnapshot(s, { ...snap("2026-06"), profit: 999 });
    expect(s.reportSnapshots).toHaveLength(1);
    expect(s.reportSnapshots[0].profit).toBe(999);
  });

  it("mantém meses distintos ordenados (recente primeiro)", () => {
    let s = saveReportSnapshot(emptyState(), snap("2026-05"));
    s = saveReportSnapshot(s, snap("2026-06"));
    expect(s.reportSnapshots.map((x) => x.monthKey)).toEqual(["2026-06", "2026-05"]);
  });
});

describe("findReportSnapshot / removeReportSnapshot", () => {
  it("encontra e remove por mês", () => {
    const s = saveReportSnapshot(emptyState(), snap("2026-06"));
    expect(findReportSnapshot(s, "2026-06")?.monthKey).toBe("2026-06");
    expect(findReportSnapshot(s, "2026-01")).toBeNull();
    expect(removeReportSnapshot(s, "2026-06").reportSnapshots).toHaveLength(0);
  });
});
