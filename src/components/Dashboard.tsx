import { groupProfitByBookmaker, groupProfitBySport, riskAlerts, money, percent } from "../lib/metrics";
import type { AppState } from "../lib/types";
import type { calculateMetrics } from "../lib/metrics";
import { Metric } from "./Metric";

interface DashboardProps {
  state: AppState;
  metrics: ReturnType<typeof calculateMetrics>;
}

export function Dashboard({ state, metrics }: DashboardProps) {
  const byBook = groupProfitByBookmaker(state);
  const bySport = groupProfitBySport(state);
  const alerts = riskAlerts(state);
  const bestBook = [...byBook].sort((a, b) => b.profit - a.profit)[0];
  const worstSport = [...bySport].sort((a, b) => a.profit - b.profit)[0];

  return (
    <section className="page">
      <div className="hero">
        <div className="balance-card">
          <span>Banca total</span>
          <strong>{money.format(metrics.totalBalance)}</strong>
          <small>{money.format(metrics.profit)} de resultado liquidado · {money.format(metrics.openExposure)} em aberto</small>
        </div>
        <Metric label="ROI" value={percent.format(metrics.roi)} detail="sobre apostas liquidadas" tone={metrics.roi >= 0 ? "good" : "bad"} />
        <Metric label="Taxa de acerto" value={percent.format(metrics.hitRate)} detail={`${metrics.settledCount} apostas liquidadas`} />
        <Metric label="CLV medio" value={percent.format(metrics.clvAverage)} detail="vs linha de fechamento" tone={metrics.clvAverage >= 0 ? "good" : "bad"} />
      </div>

      <div className="grid two">
        <article className="panel">
          <h2>Insights da etapa</h2>
          <p>
            Melhor casa no seed: <b>{bestBook?.name}</b> com {money.format(bestBook?.profit ?? 0)} de resultado.
            O ponto de atencao atual e <b>{worstSport?.sport}</b>, com {money.format(worstSport?.profit ?? 0)}.
          </p>
          <p>
            Esta versao ja calcula saldo total, exposicao aberta, ROI, yield, taxa de acerto,
            odd media e CLV medio a partir do modelo local.
          </p>
        </article>

        <article className="panel">
          <h2>Distribuicao por esporte</h2>
          {bySport.map((row) => (
            <div className="bar-row" key={row.sport}>
              <span>{row.sport}</span>
              <meter min="0" max={Math.max(...bySport.map((sport) => sport.stake))} value={row.stake} />
              <strong className={row.profit >= 0 ? "pos" : "neg"}>{money.format(row.profit)}</strong>
            </div>
          ))}
        </article>
      </div>

      <div className="risk-grid">
        {alerts.length > 0 ? alerts.map((alert) => (
          <article className={`panel risk-card ${alert.level}`} key={alert.title}>
            <span>{alert.level === "danger" ? "Risco alto" : "Atencao"}</span>
            <strong>{alert.title}</strong>
            <p>{alert.detail}</p>
          </article>
        )) : (
          <article className="panel risk-card">
            <span>Risco controlado</span>
            <strong>Nenhum alerta critico</strong>
            <p>A banca nao apresenta exposicao aberta elevada ou sequencia negativa relevante neste momento.</p>
          </article>
        )}
      </div>
    </section>
  );
}
