import { groupProfitByStrategy, riskAlerts, money, percent } from "../lib/metrics";
import type { AppState } from "../lib/types";
import type { calculateMetrics } from "../lib/metrics";

interface IntelligenceProps {
  state: AppState;
  metrics: ReturnType<typeof calculateMetrics>;
}

export function Intelligence({ state, metrics }: IntelligenceProps) {
  const strategies = groupProfitByStrategy(state);
  const best = [...strategies].sort((a, b) => b.profit - a.profit)[0];
  const worst = [...strategies].sort((a, b) => a.profit - b.profit)[0];
  const alerts = riskAlerts(state);
  const pending = state.bets.filter((bet) => bet.status === "pending");
  const exposure = pending.reduce((sum, bet) => sum + bet.stake, 0);

  return (
    <section className="page">
      <div className="section-head">
        <div>
          <h1>Inteligencia · IA</h1>
          <p>Analise automatica do historico. Nesta etapa, as recomendacoes usam regras locais e metricas reais.</p>
        </div>
        <button>Gerar relatorio semanal</button>
      </div>

      <div className="grid two">
        <article className="panel intelligence-summary">
          <span>Resumo do mes</span>
          <p>
            Sua banca esta com ROI de <b>{percent.format(metrics.roi)}</b> em {state.bets.length} apostas.
            A melhor estrategia e <b>{best?.name ?? "sem dados"}</b>, com resultado de <b>{money.format(best?.profit ?? 0)}</b>.
            O principal ponto de atencao e <b>{worst?.name ?? "sem dados"}</b>, com {money.format(worst?.profit ?? 0)}.
          </p>
          <div className="summary-list compact">
            <div><span>Top estrategia</span><strong>{best?.name ?? "-"}</strong></div>
            <div><span>Pior estrategia</span><strong>{worst?.name ?? "-"}</strong></div>
            <div><span>Exposicao aberta</span><strong>{money.format(exposure)}</strong></div>
          </div>
        </article>

        <article className="panel heatmap-card">
          <h2>Heatmap de performance</h2>
          <div className="heatmap">
            {["Seg", "Ter", "Qua", "Qui", "Sex", "Sab", "Dom"].map((day) => <span key={day}>{day}</span>)}
            {[8, 22, 12, 34, 41, 5, 0, 2, -4, -12, 0, -21, -9, -7, 15, 0, 7, 19, 4, 24, 9].map((value, index) => (
              <b className={value > 0 ? "hm-pos" : value < 0 ? "hm-neg" : ""} key={index}>{value > 0 ? `+${value}` : value}</b>
            ))}
          </div>
        </article>
      </div>

      <div className="insight-grid">
        <article className="panel">
          <h2>Sugestoes</h2>
          <div className="insight-list">
            <p>Aumente foco em <b>{best?.name ?? "estrategias lucrativas"}</b> se o CLV continuar positivo.</p>
            {alerts.map((alert) => <p key={alert.title}>{alert.detail}</p>)}
            <p>Revise odds de fechamento antes de subir stake em estrategias com pouca amostra.</p>
          </div>
        </article>

        <article className="panel">
          <h2>Conflitos & exposicao</h2>
          <p>Voce tem <b>{pending.length} apostas pendentes</b> com exposicao total de <b>{money.format(exposure)}</b>.</p>
        </article>

        <article className="panel">
          <h2>Comparador de odds</h2>
          <div className="odds-list">
            <div><span>Pinnacle</span><strong>1.95</strong></div>
            <div className="highlight"><span>Bet365</span><strong>1.92</strong></div>
            <div><span>Betano</span><strong>1.88</strong></div>
            <div><span>KTO</span><strong>1.85</strong></div>
          </div>
        </article>
      </div>
    </section>
  );
}
