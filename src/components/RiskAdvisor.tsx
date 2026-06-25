import { useMemo } from "react";
import { AlertTriangle, ShieldCheck, ShieldAlert, Activity, TrendingDown, Zap } from "lucide-react";
import type { AppState, DashboardMetrics } from "../lib/types";
import { calculateHealthScore, healthGradeColor } from "../lib/healthScore";
import { detectTilt, tiltLevelColor, tiltLevelLabel } from "../lib/tiltDetection";
import { riskAlertsExtended, checkHardStop, getHardStopProgress } from "../lib/riskGuard";
import { money } from "../lib/metrics";

interface RiskAdvisorProps {
  state: AppState;
  metrics: DashboardMetrics;
}

function ScoreDot({ score }: { score: number }) {
  const color =
    score >= 75 ? "var(--positive)" :
    score >= 55 ? "var(--warning)" :
    "var(--negative)";
  return (
    <span
      className="risk-score-dot"
      style={{
        display: "inline-block",
        width: 8,
        height: 8,
        borderRadius: "50%",
        background: color,
        marginRight: 6,
        flexShrink: 0,
      }}
    />
  );
}

function ProgressBar({ value, color }: { value: number; color: string }) {
  return (
    <div className="risk-progress-track">
      <div
        className="risk-progress-fill"
        style={{ width: `${Math.min(value, 100)}%`, background: color }}
      />
    </div>
  );
}

export function RiskAdvisor({ state, metrics }: RiskAdvisorProps) {
  const health = useMemo(() => calculateHealthScore(state, metrics), [state, metrics]);
  const tilt = useMemo(() => detectTilt(state), [state]);
  const alerts = useMemo(() => riskAlertsExtended(state), [state]);
  const hardStop = useMemo(() => checkHardStop(state), [state]);
  const hardStopProgress = useMemo(() => getHardStopProgress(state), [state]);

  const gradeColor = healthGradeColor(health.grade);
  const tiltColor = tiltLevelColor(tilt.level);
  const hasIssues = alerts.length > 0 || hardStop?.blocked || tilt.level !== "none";

  return (
    <div className="risk-advisor">
      {/* Header */}
      <div className="risk-advisor-header">
        <div className="risk-advisor-title">
          {hasIssues
            ? <ShieldAlert size={16} style={{ color: "var(--negative)" }} />
            : <ShieldCheck size={16} style={{ color: "var(--positive)" }} />}
          <span>Risk Advisor</span>
        </div>
        <div className="risk-advisor-grade" style={{ color: gradeColor }}>
          <span className="risk-grade-letter">{health.grade}</span>
          <span className="risk-grade-score">{health.overall}/100</span>
        </div>
      </div>

      {/* Hard Stop Banner */}
      {hardStop?.blocked && (
        <div className="risk-hard-stop-banner">
          <AlertTriangle size={14} />
          <div>
            <strong>Hard Stop ativado</strong>
            <p>{hardStop.reason}</p>
          </div>
        </div>
      )}

      {/* Alertas ativos */}
      {alerts.length > 0 && (
        <div className="risk-alerts-list">
          {alerts.map((alert, i) => (
            <div key={i} className={`risk-alert risk-alert-${alert.level}`}>
              <AlertTriangle size={12} />
              <div>
                <strong>{alert.title}</strong>
                {alert.metric && <span className="risk-alert-metric">{alert.metric}</span>}
                <p>{alert.detail}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Dimensões do Health Score */}
      <div className="risk-dimensions">
        {Object.entries(health.dimensions).map(([key, dim]) => (
          <div key={key} className="risk-dimension-row">
            <div className="risk-dimension-label">
              <ScoreDot score={dim.score} />
              <span>{dim.label}</span>
            </div>
            <div className="risk-dimension-bar">
              <ProgressBar
                value={dim.score}
                color={
                  dim.score >= 75 ? "var(--positive)" :
                  dim.score >= 55 ? "var(--warning)" :
                  "var(--negative)"
                }
              />
            </div>
            <span className="risk-dimension-score">{dim.score}</span>
          </div>
        ))}
      </div>

      {/* Tilt Score */}
      {tilt.level !== "none" && (
        <div className="risk-tilt-card" style={{ borderColor: `${tiltColor}33` }}>
          <div className="risk-tilt-header">
            <Activity size={13} style={{ color: tiltColor }} />
            <strong style={{ color: tiltColor }}>Tilt: {tiltLevelLabel(tilt.level)}</strong>
            <span className="risk-tilt-score" style={{ color: tiltColor }}>{Math.round(tilt.score)}/100</span>
          </div>
          <p className="risk-tilt-recommendation">{tilt.recommendation}</p>
          {tilt.signals.length > 0 && (
            <ul className="risk-tilt-signals">
              {tilt.signals.map((sig, i) => (
                <li key={i}>{sig.description}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Hard Stop Progress */}
      {state.riskSettings.hardStopEnabled && hardStopProgress.length > 0 && (
        <div className="risk-hardstop-progress">
          <div className="risk-section-label">
            <TrendingDown size={12} />
            <span>Limites de perda</span>
          </div>
          {hardStopProgress.map((window) => (
            <div key={window.type} className="risk-hardstop-row">
              <div className="risk-hardstop-meta">
                <span>{window.label}</span>
                <span className={window.triggered ? "neg" : ""}>
                  {window.currentPercent.toFixed(0)}% / {window.limitPercent}%
                </span>
              </div>
              <ProgressBar
                value={window.currentPercent}
                color={
                  window.triggered ? "var(--negative)" :
                  window.currentPercent >= 70 ? "var(--warning)" :
                  "var(--positive)"
                }
              />
              <small>
                {money.format(window.currentAmount)} de {money.format(window.limitAmount)}
              </small>
            </div>
          ))}
        </div>
      )}

      {/* Tip de melhoria */}
      <div className="risk-tip">
        <Zap size={12} />
        <span>{health.improvementTip}</span>
      </div>

      {health.overall >= 85 && alerts.length === 0 && tilt.level === "none" && (
        <p className="risk-ok-message">{health.interpretation}</p>
      )}
    </div>
  );
}
