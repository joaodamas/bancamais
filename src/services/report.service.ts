/**
 * Snapshots de relatório — congela a "carta" de um mês como ativo histórico.
 * Persistido no AppState (array), entra de graça no sync e no export/delete LGPD.
 */
import type { AppState, ReportSnapshot } from "../lib/types";

/** Congela (ou re-congela) o snapshot do mês, carimbando savedAt. */
export function saveReportSnapshot(state: AppState, snapshot: ReportSnapshot): AppState {
  const others = (state.reportSnapshots ?? []).filter((s) => s.monthKey !== snapshot.monthKey);
  const frozen: ReportSnapshot = { ...snapshot, savedAt: new Date().toISOString() };
  return {
    ...state,
    reportSnapshots: [...others, frozen].sort((a, b) => b.monthKey.localeCompare(a.monthKey)),
  };
}

export function findReportSnapshot(state: AppState, monthKey: string): ReportSnapshot | null {
  return (state.reportSnapshots ?? []).find((s) => s.monthKey === monthKey) ?? null;
}

export function removeReportSnapshot(state: AppState, monthKey: string): AppState {
  return {
    ...state,
    reportSnapshots: (state.reportSnapshots ?? []).filter((s) => s.monthKey !== monthKey),
  };
}
