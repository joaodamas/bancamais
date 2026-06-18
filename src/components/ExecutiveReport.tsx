import { useMemo, useState } from "react";
import { TrendingUp, AlertTriangle } from "lucide-react";
import { buildExecutiveReport, availableReportMonths } from "../lib/executiveReport";
import { money, percent } from "../lib/metrics";
import type { AppState } from "../lib/types";

function monthLabel(key: string): string {
  const [y, m] = key.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, 1).toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
}

export function ExecutiveReport({ state }: { state: AppState }) {
  const months = useMemo(() => availableReportMonths(state), [state]);
  const [month, setMonth] = useState<string | undefined>(undefined);
  const report = useMemo(() => buildExecutiveReport(state, month), [state, month]);
  const { performance: p } = report;

  return (
    <article className="panel exec-report">
      <header className="exec-report-head">
        <div>
          <span className="exec-report-eyebrow">Relatório executivo</span>
          <h2 className="exec-report-title">{report.periodLabel}</h2>
        </div>
        {months.length > 1 && (
          <select className="exec-report-month" value={report.monthKey} onChange={(e) => setMonth(e.target.value)}>
            {months.map((m) => <option key={m} value={m}>{monthLabel(m)}</option>)}
          </select>
        )}
      </header>

      <p className="exec-report-summary">{report.summary}</p>

      {report.hasData && (
        <>
          <div className="exec-report-perf">
            <div className="exec-perf-item">
              <span>Lucro líquido</span>
              <strong className={`text-mono ${p.profit >= 0 ? "pos" : "neg"}`}>{money.format(p.profit)}</strong>
            </div>
            <div className="exec-perf-item">
              <span>Yield</span>
              <strong className={`text-mono ${p.yield >= 0 ? "pos" : "neg"}`}>{percent.format(p.yield)}</strong>
            </div>
            <div className="exec-perf-item">
              <span>Taxa de acerto</span>
              <strong className="text-mono">{percent.format(p.hitRate)}</strong>
            </div>
            <div className="exec-perf-item">
              <span>Volume</span>
              <strong className="text-mono">{money.format(p.staked)}</strong>
            </div>
            <div className="exec-perf-item">
              <span>Apostas</span>
              <strong className="text-mono">{p.settledCount}</strong>
            </div>
          </div>

          {report.topEdges.length > 0 && (
            <section className="exec-report-section">
              <h3><TrendingUp size={15} /> Onde você ganhou</h3>
              <ul className="exec-edges">
                {report.topEdges.map((e) => (
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

          {report.behaviorAlert && (
            <section className="exec-report-alert">
              <h3><AlertTriangle size={15} /> Alerta de comportamento</h3>
              <p>{report.behaviorAlert}</p>
            </section>
          )}
        </>
      )}

      <footer className="exec-report-footer">
        Gerado a partir do seu ledger — todos os valores são determinísticos, sem estimativa de IA.
      </footer>
    </article>
  );
}
