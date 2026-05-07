import { useMemo } from "react";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  ReferenceLine,
} from "recharts";
import { calculateMetrics, groupProfitBySport, riskAlerts, money, percent } from "../lib/metrics";
import { buildBankrollTimeSeries, buildMonthlyData } from "../lib/chartData";
import type { AppState } from "../lib/types";
import { Metric } from "./Metric";

// Cores do design system Banca+ (hex direto — Recharts não lê CSS vars)
const COLORS = {
  accent: "#7cffb2",
  cyan: "#5ee0ff",
  green: "#22c597",
  red: "#ff6b81",
  amber: "#ffb547",
  panel: "#10172a",
  line: "rgba(148,163,184,0.16)",
  muted: "#8a95ad",
};

function MoneyTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ name: string; value: number; color: string }>; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="chart-tooltip">
      <span className="chart-tooltip-label">{label}</span>
      {payload.map((entry) => (
        <div key={entry.name} className="chart-tooltip-row">
          <span style={{ color: entry.color }}>{entry.name}</span>
          <strong>{money.format(entry.value)}</strong>
        </div>
      ))}
    </div>
  );
}

export function Dashboard({
  state,
  metrics,
}: {
  state: AppState;
  metrics: ReturnType<typeof calculateMetrics>;
}) {
  const alerts = riskAlerts(state);
  const timeSeries = useMemo(() => buildBankrollTimeSeries(state), [state]);
  const monthlyData = useMemo(() => buildMonthlyData(state), [state]);
  const bySport = useMemo(
    () =>
      groupProfitBySport(state)
        .sort((a, b) => b.profit - a.profit)
        .slice(0, 6),
    [state]
  );

  return (
    <section className="page">
      {/* Hero metrics */}
      <div className="hero">
        <div className="balance-card">
          <span>Banca total</span>
          <strong>{money.format(metrics.totalBalance)}</strong>
          <small>
            {money.format(metrics.profit)} resultado liquidado
            &nbsp;·&nbsp;{money.format(metrics.openExposure)} em aberto
          </small>
        </div>
        <Metric
          label="ROI"
          value={percent.format(metrics.roi)}
          detail={`${metrics.settledCount} apostas liquidadas`}
          tone={metrics.roi >= 0 ? "good" : "bad"}
        />
        <Metric
          label="Taxa de acerto"
          value={percent.format(metrics.hitRate)}
          detail="apostas ganhas / liquidadas"
        />
        <Metric
          label="CLV médio"
          value={percent.format(metrics.clvAverage)}
          detail="vs linha de fechamento"
          tone={metrics.clvAverage >= 0 ? "good" : "bad"}
        />
      </div>

      {/* Bankroll evolution chart */}
      <article className="panel chart-panel">
        <div className="chart-header">
          <h2>Evolução da banca</h2>
          <span className={metrics.profit >= 0 ? "pos" : "neg"}>
            {metrics.profit >= 0 ? "+" : ""}
            {money.format(metrics.profit)} total
          </span>
        </div>
        {timeSeries.length > 1 ? (
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={timeSeries} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
              <defs>
                <linearGradient id="balanceGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={COLORS.accent} stopOpacity={0.18} />
                  <stop offset="95%" stopColor={COLORS.accent} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={COLORS.line} vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fill: COLORS.muted, fontSize: 11 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tickFormatter={(v: number) => `R$${(v / 1000).toFixed(0)}k`}
                tick={{ fill: COLORS.muted, fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                width={52}
              />
              <Tooltip content={<MoneyTooltip />} />
              <Area
                type="monotone"
                dataKey="balance"
                name="Saldo"
                stroke={COLORS.accent}
                strokeWidth={2}
                fill="url(#balanceGrad)"
                dot={false}
                activeDot={{ r: 4, fill: COLORS.accent }}
              />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div className="chart-empty">
            <span>Registre apostas para ver a evolução da banca</span>
          </div>
        )}
      </article>

      <div className="grid two">
        {/* Monthly ROI bar chart */}
        <article className="panel chart-panel">
          <h2>ROI mensal</h2>
          {monthlyData.length > 0 ? (
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={monthlyData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke={COLORS.line}
                  horizontal={true}
                  vertical={false}
                />
                <XAxis
                  dataKey="month"
                  tick={{ fill: COLORS.muted, fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tickFormatter={(v: number) => `${(v * 100).toFixed(0)}%`}
                  tick={{ fill: COLORS.muted, fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  width={44}
                />
                <Tooltip
                  formatter={(value) => [`${(Number(value ?? 0) * 100).toFixed(1)}%`, "ROI"]}
                  contentStyle={{
                    background: COLORS.panel,
                    border: `1px solid ${COLORS.line}`,
                    borderRadius: 8,
                  }}
                  labelStyle={{ color: COLORS.muted }}
                />
                <ReferenceLine y={0} stroke={COLORS.line} />
                <Bar dataKey="roi" name="ROI" radius={[3, 3, 0, 0]}>
                  {monthlyData.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={entry.roi >= 0 ? COLORS.accent : COLORS.red}
                      fillOpacity={0.85}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="chart-empty">
              <span>Sem dados mensais ainda</span>
            </div>
          )}
        </article>

        {/* Sport profit horizontal bar chart */}
        <article className="panel chart-panel">
          <h2>Lucro por esporte</h2>
          {bySport.length > 0 ? (
            <ResponsiveContainer width="100%" height={180}>
              <BarChart
                data={bySport}
                layout="vertical"
                margin={{ top: 0, right: 8, left: 0, bottom: 0 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke={COLORS.line}
                  horizontal={false}
                  vertical={true}
                />
                <XAxis
                  type="number"
                  tickFormatter={(v: number) => money.format(v)}
                  tick={{ fill: COLORS.muted, fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  type="category"
                  dataKey="sport"
                  tick={{ fill: COLORS.muted, fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  width={64}
                />
                <Tooltip content={<MoneyTooltip />} />
                <Bar dataKey="profit" name="Lucro" radius={[0, 3, 3, 0]}>
                  {bySport.map((entry, i) => (
                    <Cell
                      key={i}
                      fill={entry.profit >= 0 ? COLORS.green : COLORS.red}
                      fillOpacity={0.85}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="chart-empty">
              <span>Sem apostas liquidadas por esporte</span>
            </div>
          )}
        </article>
      </div>

      {/* Risk alerts */}
      <div className="risk-grid">
        {alerts.length > 0 ? (
          alerts.map((alert) => (
            <article className={`panel risk-card ${alert.level}`} key={alert.title}>
              <span>{alert.level === "danger" ? "Risco alto" : "Atenção"}</span>
              <strong>{alert.title}</strong>
              <p>{alert.detail}</p>
            </article>
          ))
        ) : (
          <article className="panel risk-card">
            <span>Status</span>
            <strong>Risco controlado</strong>
            <p>
              Nenhum alerta crítico. A banca está dentro dos parâmetros configurados.
            </p>
          </article>
        )}
      </div>
    </section>
  );
}
