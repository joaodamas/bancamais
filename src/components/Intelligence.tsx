import { useMemo } from "react";
import { useAIAnalysis } from "../lib/useAIAnalysis";
import { groupProfitByStrategy, riskAlerts, money, percent } from "../lib/metrics";
import type { AppState } from "../lib/types";
import type { calculateMetrics } from "../lib/metrics";
import { EmptyState } from "./EmptyState";
import { LoadingSkeleton } from "./LoadingSkeleton";
import { extractTeamsFromBets, isNewsApiConfigured } from "../lib/newsApi";
import { TeamNewsWidget } from "./TeamNewsWidget";

// Gera heatmap data-driven dos últimos 21 dias
function buildHeatmapData(state: AppState) {
  const today = new Date();
  const days: Array<{ date: Date; profit: number; bets: number }> = [];

  for (let i = 20; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const dateStr = d.toISOString().slice(0, 10);

    const dayBets = state.bets.filter(b => {
      return b.eventAt.slice(0, 10) === dateStr && b.status !== "pending";
    });

    const profit = dayBets.reduce((sum, bet) => {
      const payout = bet.status === "won"
        ? bet.odds * bet.stake
        : bet.status === "void" ? bet.stake : 0;
      return sum + payout - bet.stake;
    }, 0);

    days.push({ date: d, profit, bets: dayBets.length });
  }

  return days;
}

const DAY_LABELS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

export function Intelligence({
  state,
  metrics,
}: {
  state: AppState;
  metrics: ReturnType<typeof calculateMetrics>;
}) {
  const { analysis, loading, error, refresh } = useAIAnalysis(state);
  const strategies = useMemo(() => groupProfitByStrategy(state), [state]);
  const heatmapData = useMemo(() => buildHeatmapData(state), [state]);
  const alerts = useMemo(() => riskAlerts(state), [state]);
  const pending = state.bets.filter(b => b.status === "pending");
  const exposure = pending.reduce((sum, b) => sum + b.stake, 0);
  const pendingTeams = useMemo(() => extractTeamsFromBets(state.bets), [state.bets]);

  return (
    <section className="page">
      <div className="section-head">
        <div>
          <h1>Inteligência · IA</h1>
          <p>Análise automática do portfólio com base nos dados reais das suas apostas.</p>
        </div>
        <button onClick={refresh} disabled={loading} className="btn-refresh">
          {loading ? "Analisando..." : "Atualizar análise"}
        </button>
      </div>

      <div className="grid two">
        {/* AI Analysis Panel */}
        <article className="panel intelligence-summary">
          <span>Análise de IA</span>
          {loading ? (
            <div style={{ marginTop: 12 }}>
              <LoadingSkeleton lines={4} height={16} />
            </div>
          ) : error ? (
            <div className="ai-error">
              <p>{error}</p>
              <button onClick={refresh}>Tentar novamente</button>
            </div>
          ) : analysis ? (
            <>
              <p className="ai-summary">{analysis.summary}</p>
              {analysis.topInsight && (
                <div className="ai-insight">
                  <span>Principal insight</span>
                  <strong>{analysis.topInsight}</strong>
                </div>
              )}
              <div className="summary-list compact">
                <div>
                  <span>Melhor estratégia</span>
                  <strong className="pos">{analysis.bestStrategy ?? "-"}</strong>
                </div>
                <div>
                  <span>Revisar estratégia</span>
                  <strong className="neg">{analysis.worstStrategy ?? "-"}</strong>
                </div>
                <div>
                  <span>Exposição aberta</span>
                  <strong>{money.format(exposure)}</strong>
                </div>
              </div>
              {analysis.suggestions.length > 0 && (
                <div className="ai-suggestions">
                  {analysis.suggestions.slice(0, 3).map((s, i) => (
                    <div key={i} className={`ai-suggestion priority-${s.priority}`}>
                      <strong>{s.title}</strong>
                      <p>{s.description}</p>
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : (
            <div style={{ marginTop: 12 }}>
              <p style={{ color: "var(--muted)" }}>Clique em "Atualizar análise" para gerar insights sobre o seu portfólio.</p>
              <button onClick={refresh} className="primary" style={{ marginTop: 12 }}>
                Analisar agora
              </button>
            </div>
          )}
        </article>

        {/* Heatmap data-driven */}
        <article className="panel heatmap-card">
          <h2>Heatmap — últimos 21 dias</h2>
          <div className="heatmap">
            {DAY_LABELS.map(day => <span key={day}>{day}</span>)}
            {heatmapData.map((day, index) => {
              const hasData = day.bets > 0;
              const cls = !hasData ? "" : day.profit > 0 ? "hm-pos" : "hm-neg";
              const label = hasData
                ? (day.profit > 0 ? `+${day.profit.toFixed(0)}` : day.profit.toFixed(0))
                : "–";
              return (
                <b
                  key={index}
                  className={cls}
                  title={`${day.date.toLocaleDateString("pt-BR")}: ${day.bets} aposta(s), ${money.format(day.profit)}`}
                >
                  {label}
                </b>
              );
            })}
          </div>
        </article>
      </div>

      {/* Risk warnings from AI */}
      {analysis && analysis.riskWarnings.length > 0 && (
        <div className="risk-grid" style={{ marginTop: 14 }}>
          {analysis.riskWarnings.map((w, i) => (
            <article key={i} className={`panel risk-card ${w.severity === "critical" ? "danger" : w.severity === "warning" ? "warning" : ""}`}>
              <span>{w.severity === "critical" ? "Crítico" : w.severity === "warning" ? "Atenção" : "Info"}</span>
              <strong>{w.title}</strong>
              <p>{w.detail}</p>
            </article>
          ))}
        </div>
      )}

      {/* Strategy performance */}
      <div className="insight-grid" style={{ marginTop: 14 }}>
        <article className="panel">
          <h2>Performance por estratégia</h2>
          {strategies.length > 0 ? (
            <div className="insight-list">
              {strategies.slice(0, 5).map(s => (
                <div key={s.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: "1px solid var(--line)" }}>
                  <div>
                    <strong style={{ fontSize: 14 }}>{s.name}</strong>
                    <small style={{ display: "block", color: "var(--muted)" }}>{s.bets} apostas · {percent.format(s.hitRate)} acerto</small>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <strong className={s.profit >= 0 ? "pos" : "neg"}>{money.format(s.profit)}</strong>
                    <small style={{ display: "block", color: "var(--muted)" }}>ROI {percent.format(s.roi)}</small>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              title="Nenhuma estratégia com dados"
              description="Apostas liquidadas associadas a estratégias aparecerão aqui."
            />
          )}
        </article>

        <article className="panel">
          <h2>Apostas em aberto</h2>
          <p>
            <strong>{pending.length}</strong> apostas pendentes com
            exposição total de <strong>{money.format(exposure)}</strong>.
          </p>
          {alerts.length > 0 && (
            <div className="insight-list">
              {alerts.map(a => <p key={a.title} style={{ color: "var(--amber)", margin: "6px 0", fontSize: 13 }}>{a.detail}</p>)}
            </div>
          )}
        </article>

        <article className="panel">
          <h2>Estatísticas</h2>
          <div className="summary-list">
            <div><span>Total apostado</span><strong>{money.format(state.bets.reduce((s, b) => s + b.stake, 0))}</strong></div>
            <div><span>Odd média</span><strong style={{ fontFamily: "var(--font-mono)" }}>{metrics.averageOdds.toFixed(2)}</strong></div>
            <div><span>CLV médio</span><strong className={metrics.clvAverage >= 0 ? "pos" : "neg"}>{percent.format(metrics.clvAverage)}</strong></div>
          </div>
        </article>
      </div>

      {isNewsApiConfigured() && pendingTeams.length > 0 && (
        <article className="panel" style={{ marginTop: 14 }}>
          <h2>Notícias recentes — apostas pendentes</h2>
          <div className="news-grid">
            {pendingTeams.map(team => (
              <div key={team} className="news-team-section">
                <span className="news-team-label">{team}</span>
                <TeamNewsWidget teamName={team} compact />
              </div>
            ))}
          </div>
        </article>
      )}
    </section>
  );
}
