import { describe, it, expect } from "vitest";
import { buildDemoState } from "./demoData";
import { calculateMetrics } from "./metrics";
import { calculateLedgerTotalBalance } from "./ledger";
import { buildBankrollTimeSeries } from "./chartData";

describe("demo data smoke", () => {
  const state = buildDemoState();
  const metrics = calculateMetrics(state);
  const series = buildBankrollTimeSeries(state);

  it("curva fecha com o saldo do ledger", () => {
    const last = series[series.length - 1].balance;
    expect(Math.abs(last - calculateLedgerTotalBalance(state))).toBeLessThan(0.01);
  });

  it("tem amostra, pendentes e CLV", () => {
    expect(metrics.settledCount).toBeGreaterThanOrEqual(20);
    expect(metrics.pendingCount).toBe(2);
    expect(state.bets.filter((b) => b.closingOdds != null).length).toBeGreaterThan(10);
  });

  it("métricas em faixas plausíveis", () => {
    expect(metrics.totalBalance).toBeGreaterThan(0);
    expect(metrics.hitRate).toBeGreaterThan(0);
    expect(metrics.hitRate).toBeLessThan(1);
    expect(Math.abs(metrics.roi)).toBeLessThan(1);
  });
});
