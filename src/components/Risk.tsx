import { useMemo } from "react";
import { AlertTriangle, Clock, Layers, Gauge } from "lucide-react";
import { calculateMetrics, money, percent, riskAlerts } from "../lib/metrics";
import { resolveUnitValue, exceedsUnitCap, describeUnit } from "../lib/unit";
import type { AppState } from "../lib/types";
import { RiskAdvisor } from "./RiskAdvisor";

export function Risk({
  state,
  metrics,
}: {
  state: AppState;
  metrics: ReturnType<typeof calculateMetrics>;
}) {
  const bankroll = metrics.totalBalance + metrics.openExposure;
  const unitValue = resolveUnitValue(state.riskSettings, bankroll);

  const pending = useMemo(() => state.bets.filter((b) => b.status === "pending"), [state.bets]);
  const overStaked = useMemo(
    () => pending.filter((b) => exceedsUnitCap(b.stake, state.riskSettings, bankroll)),
    [pending, state.riskSettings, bankroll]
  );
  const avgStakeUnits = pending.length > 0 && unitValue > 0
    ? pending.reduce((s, b) => s + b.stake, 0) / pending.length / unitValue
    : 0;
  const exposureCap = bankroll * (state.riskSettings.maxOpenExposurePercent / 100);
  const exposurePct = exposureCap > 0 ? metrics.openExposure / exposureCap : 0;

  const alerts = useMemo(() => riskAlerts(state), [state]);
  const stalePending = useMemo(() => {
    const cutoff = Date.now() - 48 * 60 * 60 * 1000;
    return state.bets.filter((b) => b.status === "pending" && new Date(b.eventAt).getTime() < cutoff);
  }, [state.bets]);

  return (
    <section className="page">
      <div className="section-head">
        <div>
          <h1>Risco</h1>
          <p>{unitValue > 0 ? describeUnit(state.riskSettings, bankroll) : "Configure a unidade em Configurações para ativar os limites"}</p>
        </div>
      </div>

      {unitValue > 0 && (
        <div className="risk-band">
          <article className="risk-card">
            <div className="risk-card-head"><Layers size={14} /><span>Stake médio</span></div>
            <strong className="text-mono">{avgStakeUnits > 0 ? `${avgStakeUnits.toFixed(1)}u` : "—"}</strong>
            <small>nas {pending.length} pendentes</small>
          </article>
          <article className={`risk-card${overStaked.length > 0 ? " risk-card-warn" : ""}`}>
            <div className="risk-card-head"><AlertTriangle size={14} /><span>Acima do teto</span></div>
            <strong className="text-mono">{overStaked.length}</strong>
            <small>limite {state.riskSettings.maxStakeUnits}u por aposta</small>
          </article>
          <article className={`risk-card risk-card-exposure${exposurePct > 1 ? " risk-card-warn" : ""}`}>
            <div className="risk-card-head"><Gauge size={14} /><span>Exposição aberta</span></div>
            <div className="risk-exposure-figures">
              <strong className="text-mono">{money.format(metrics.openExposure)}</strong>
              <small>de {money.format(exposureCap)}</small>
            </div>
            <div className="risk-bar">
              <div
                className={`risk-bar-fill${exposurePct > 1 ? " over" : ""}`}
                style={{ width: `${Math.min(100, Math.max(2, exposurePct * 100))}%` }}
              />
            </div>
            <small>{exposurePct > 1 ? `${exposurePct.toFixed(1)}× o limite (${state.riskSettings.maxOpenExposurePercent}% da banca)` : `${percent.format(exposurePct)} do limite`}</small>
          </article>
        </div>
      )}

      {(alerts.length > 0 || stalePending.length > 0) ? (
        <div className="dashboard-attention-grid">
          {alerts.map((alert) => (
            <article key={alert.title} className={`dashboard-attention-card dashboard-attention-${alert.level}`}>
              <div className="dashboard-attention-icon"><AlertTriangle size={14} /></div>
              <div>
                <strong>{alert.title}</strong>
                <p>{alert.detail}</p>
              </div>
            </article>
          ))}
          {stalePending.length > 0 && (
            <article className="dashboard-attention-card dashboard-attention-info">
              <div className="dashboard-attention-icon"><Clock size={14} /></div>
              <div>
                <strong>{stalePending.length} aposta(s) sem resultado</strong>
                <p>
                  {stalePending.slice(0, 2).map((b) => b.eventName).join(", ")}
                  {stalePending.length > 2 ? ` e mais ${stalePending.length - 2}` : ""} — o evento já passou. Liquide os resultados.
                </p>
              </div>
            </article>
          )}
        </div>
      ) : (
        <article className="panel risk-clear">
          <span>Nenhum alerta de risco ativo. Disciplina mantida. ✓</span>
        </article>
      )}

      <article className="panel dashboard-risk-panel">
        <RiskAdvisor state={state} metrics={metrics} />
      </article>
    </section>
  );
}
