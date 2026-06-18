/**
 * Comparação temporal entre relatórios (mês atual vs anterior).
 * DETERMINÍSTICA: deltas e frases vêm dos snapshots, não de um LLM. É o
 * "coaching" comparativo ("sua eficiência em X subiu desde maio") com números
 * sempre corretos — uma camada de LLM pode reescrever isto, nunca recalcular.
 */
import type { ReportSnapshot } from "./types";
import { money, percent } from "./metrics";

export interface EdgeShift {
  key: string;
  previousRoi: number;
  currentRoi: number;
  deltaPp: number;
}

export interface ReportComparison {
  hasPrevious: boolean;
  previousLabel: string | null;
  profitDelta: number;
  yieldDeltaPp: number;
  hitRateDeltaPp: number;
  lines: string[];
  edgeShifts: EdgeShift[];
}

function signPp(pp: number): string {
  return `${pp >= 0 ? "+" : ""}${pp.toFixed(1)} pp`;
}

function signMoney(value: number): string {
  return `${value >= 0 ? "+" : ""}${money.format(value)}`;
}

export function compareReports(
  current: ReportSnapshot,
  previous: ReportSnapshot | null,
): ReportComparison {
  if (!previous || !previous.hasData || !current.hasData) {
    return {
      hasPrevious: false,
      previousLabel: previous?.periodLabel ?? null,
      profitDelta: 0,
      yieldDeltaPp: 0,
      hitRateDeltaPp: 0,
      lines: [],
      edgeShifts: [],
    };
  }

  const profitDelta = current.profit - previous.profit;
  const yieldDeltaPp = (current.yield - previous.yield) * 100;
  const hitRateDeltaPp = (current.hitRate - previous.hitRate) * 100;

  const lines = [
    `Lucro: ${money.format(previous.profit)} → ${money.format(current.profit)} (${signMoney(profitDelta)})`,
    `Yield: ${percent.format(previous.yield)} → ${percent.format(current.yield)} (${signPp(yieldDeltaPp)})`,
    `Acerto: ${percent.format(previous.hitRate)} → ${percent.format(current.hitRate)} (${signPp(hitRateDeltaPp)})`,
  ];

  const prevRoi = new Map(previous.topEdges.map((e) => [e.key, e.roi]));
  const edgeShifts = current.topEdges
    .filter((e) => prevRoi.has(e.key))
    .map((e) => ({
      key: e.key,
      previousRoi: prevRoi.get(e.key)!,
      currentRoi: e.roi,
      deltaPp: (e.roi - prevRoi.get(e.key)!) * 100,
    }))
    .sort((a, b) => b.deltaPp - a.deltaPp);

  return {
    hasPrevious: true,
    previousLabel: previous.periodLabel,
    profitDelta,
    yieldDeltaPp,
    hitRateDeltaPp,
    lines,
    edgeShifts,
  };
}
