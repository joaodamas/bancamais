import { useMemo, useState } from "react";
import { TrendingUp, AlertTriangle, Lock } from "lucide-react";
import { buildExecutiveReport, availableReportMonths, toSnapshot, currentMonthKey } from "../lib/executiveReport";
import { findReportSnapshot } from "../services/report.service";
import { money, percent } from "../lib/metrics";
import type { AppState, ReportSnapshot } from "../lib/types";

function monthLabel(key: string): string {
  const [y, m] = key.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, 1).toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
}

export function ExecutiveReport({
  state,
  onSaveSnapshot,
}: {
  state: AppState;
  onSaveSnapshot: (snapshot: ReportSnapshot) => void;
}) {
  const liveMonths = useMemo(() => availableReportMonths(state), [state]);
  const savedMonths = useMemo(() => new Set((state.reportSnapshots ?? []).map((s) => s.monthKey)), [state]);
  const months = useMemo(
    () => [...new Set([...liveMonths, ...savedMonths, currentMonthKey()])].sort().reverse(),
    [liveMonths, savedMonths],
  );

  const [month, setMonth] = useState<string | undefined>(undefined);
  const activeMonth = month ?? months[0];
  const isCurrent = activeMonth === currentMonthKey();

  const frozen = useMemo(() => findReportSnapshot(state, activeMonth), [state, activeMonth]);
  const liveSnapshot = useMemo(() => toSnapshot(buildExecutiveReport(state, activeMonth)), [state, activeMonth]);

  // Mês corrente sempre ao vivo; mês fechado usa o snapshot congelado se existir.
  const view: ReportSnapshot = frozen && !isCurrent ? frozen : liveSnapshot;
  const isFrozen = view.savedAt !== null;

  return (
    <article className="panel exec-report">
      <header className="exec-report-head">
        <div>
          <span className="exec-report-eyebrow">Relatório executivo</span>
          <h2 className="exec-report-title">{view.periodLabel}</h2>
        </div>
        <div className="exec-report-controls">
          {months.length > 1 && (
            <select className="exec-report-month" value={activeMonth} onChange={(e) => setMonth(e.target.value)}>
              {months.map((m) => (
                <option key={m} value={m}>{monthLabel(m)}{savedMonths.has(m) ? " ✓" : ""}</option>
              ))}
            </select>
          )}
          {isFrozen && (
            <span className="exec-report-frozen" title={`Congelado em ${new Date(view.savedAt!).toLocaleString("pt-BR")}`}>
              <Lock size={12} /> Congelado
            </span>
          )}
          {liveSnapshot.hasData && (
            <button className="exec-report-save" onClick={() => onSaveSnapshot(liveSnapshot)}>
              {isFrozen ? "Atualizar snapshot" : "Salvar snapshot"}
            </button>
          )}
        </div>
      </header>

      <p className="exec-report-summary">{view.summary}</p>

      {view.hasData && (
        <>
          <div className="exec-report-perf">
            <div className="exec-perf-item">
              <span>Lucro líquido</span>
              <strong className={`text-mono ${view.profit >= 0 ? "pos" : "neg"}`}>{money.format(view.profit)}</strong>
            </div>
            <div className="exec-perf-item">
              <span>Yield</span>
              <strong className={`text-mono ${view.yield >= 0 ? "pos" : "neg"}`}>{percent.format(view.yield)}</strong>
            </div>
            <div className="exec-perf-item">
              <span>Taxa de acerto</span>
              <strong className="text-mono">{percent.format(view.hitRate)}</strong>
            </div>
            <div className="exec-perf-item">
              <span>Volume</span>
              <strong className="text-mono">{money.format(view.staked)}</strong>
            </div>
            <div className="exec-perf-item">
              <span>Apostas</span>
              <strong className="text-mono">{view.settledCount}</strong>
            </div>
          </div>

          {view.topEdges.length > 0 && (
            <section className="exec-report-section">
              <h3><TrendingUp size={15} /> Onde você ganhou</h3>
              <ul className="exec-edges">
                {view.topEdges.map((e) => (
                  <li key={e.key}>
                    <span className="exec-edge-key">{e.key}</span>
                    <span className="text-mono exec-edge-meta">
                      +{money.format(e.profit)} · {percent.format(e.roi)} ROI · {e.bets} apostas
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {view.behaviorAlert && (
            <section className="exec-report-alert">
              <h3><AlertTriangle size={15} /> Alerta de comportamento</h3>
              <p>{view.behaviorAlert}</p>
            </section>
          )}
        </>
      )}

      <footer className="exec-report-footer">
        {isFrozen
          ? `Snapshot congelado em ${new Date(view.savedAt!).toLocaleDateString("pt-BR")} — preserva o fechamento do mês mesmo que apostas antigas mudem.`
          : "Gerado do seu ledger em tempo real. Salve um snapshot para congelar o fechamento do mês como ativo histórico."}
      </footer>
    </article>
  );
}
