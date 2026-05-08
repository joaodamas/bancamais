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
import { EmptyState } from "./EmptyState";
import { Metric } from "./Metric";

// Cores do design system Banca+ (hex direto — Recharts não lê CSS vars)
const COLORS = {
  accent: "#6366F1",
  cyan: "#818CF8",
  green: "#10B981",
  red: "#BE123C",
  amber: "#FBBF24",
  panel: "#18181B",
  line: "#27272A",
  muted: "#94A3B8",
  bg: "#09090B",
};

type ChartTooltipPayloadEntry = {
  name: string;
  value: number;
  color: string;
  payload?: { tooltipLabel?: string };
};

function ChartTooltipCard({
  active,
  payload,
  label,
  formatter,
}: {
  active?: boolean;
  payload?: ChartTooltipPayloadEntry[];
  label?: string;
  formatter: (value: number) => string;
}) {
  if (!active || !payload?.length) return null;
  const displayLabel = payload[0]?.payload?.tooltipLabel ?? label;
  return (
    <div className="chart-tooltip">
      <span className="chart-tooltip-label">{displayLabel}</span>
      {payload.map((entry) => (
        <div key={entry.name} className="chart-tooltip-row">
          <span style={{ color: entry.color }}>{entry.name}</span>
          <strong>{formatter(entry.value)}</strong>
        </div>
      ))}
    </div>
  );
}

function MoneyTooltip(props: { active?: boolean; payload?: ChartTooltipPayloadEntry[]; label?: string }) {
  return <ChartTooltipCard {...props} formatter={(value) => money.format(value)} />;
}

function PercentTooltip(props: { active?: boolean; payload?: ChartTooltipPayloadEntry[]; label?: string }) {
  return <ChartTooltipCard {...props} formatter={(value) => `${(value * 100).toFixed(1)}%`} />;
}

function formatCompactMoneyTick(value: number) {
  const absolute = Math.abs(value);
  if (absolute >= 1000) {
    return `R$${(value / 1000).toFixed(absolute >= 10000 ? 0 : 1)}k`;
  }
  return money.format(value);
}

export function Dashboard({
  state,
  metrics,
  onOpenNewBet,
  onOpenBooks,
}: {
  state: AppState;
  metrics: ReturnType<typeof calculateMetrics>;
  onOpenNewBet: () => void;
  onOpenBooks: () => void;
}) {
  const alerts = riskAlerts(state);
  const timeSeries = useMemo(() => buildBankrollTimeSeries(state), [state]);
  const monthlyData = useMemo(() => buildMonthlyData(state), [state]);
  const monitoredCapital = metrics.totalBalance + metrics.openExposure;
  const bySport = useMemo(
    () =>
      groupProfitBySport(state)
        .sort((a, b) => b.profit - a.profit)
        .slice(0, 6),
    [state]
  );
  const isEmpty = state.bets.length === 0;
  const hasBookmakers = state.bookmakers.length > 0;

  if (isEmpty) {
    return (
      <section className="page">
        <div className="section-head">
          <div>
            <h1>Dashboard</h1>
            <p>Visão geral da banca · {new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" })}</p>
          </div>
        </div>

        <article className="panel">
          <EmptyState
            title="Nenhuma aposta registrada ainda"
            description={
              hasBookmakers
                ? "Registre sua primeira aposta para ativar os gráficos, curva de banca e métricas de desempenho."
                : "Cadastre uma casa de apostas e registre sua primeira operação para liberar o painel completo."
            }
            action={{
              label: hasBookmakers ? "Registrar primeira aposta" : "Configurar casas",
              onClick: hasBookmakers ? onOpenNewBet : onOpenBooks,
            }}
          />
        </article>
      </section>
    );
  }

  return (
    <section className="page">
      <div className="dashboard-command panel">
        <div className="dashboard-command-copy">
          <span className="dashboard-kicker">Centro de controle</span>
          <h1>Visão operacional da banca</h1>
          <p>Monitore saldo, ritmo de execução, eficiência de preço e alertas de risco em uma única superfície.</p>
        </div>
        <div className="dashboard-command-actions">
          <button className="primary" onClick={onOpenNewBet}>Nova entrada</button>
          <button onClick={onOpenBooks}>Gerir casas</button>
        </div>
      </div>

      <div className="hero">
        <div className="balance-card">
          <span>Saldo</span>
          <strong>{money.format(metrics.totalBalance)}</strong>
          <div className="balance-breakdown">
            <div>
              <small>Disponivel para apostar</small>
              <b>{money.format(metrics.totalBalance)}</b>
            </div>
            <div>
              <small>Disponivel para saque</small>
              <b>{money.format(metrics.totalBalance)}</b>
            </div>
            <div>
              <small>Apostas abertas</small>
              <b>{money.format(metrics.openExposure)}</b>
            </div>
          </div>
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

      <div className="dashboard-mini-grid">
        <article className="panel dashboard-mini-card">
          <span>Capital monitorado</span>
          <strong>{money.format(monitoredCapital)}</strong>
          <small>Saldo atual somado ao capital ainda exposto em apostas pendentes.</small>
        </article>
        <article className="panel dashboard-mini-card">
          <span>Resultado liquidado</span>
          <strong className={metrics.profit >= 0 ? "pos" : "neg"}>{money.format(metrics.profit)}</strong>
          <small>Lucro acumulado ja fechado na base atual.</small>
        </article>
        <article className="panel dashboard-mini-card">
          <span>Apostas abertas</span>
          <strong>{money.format(metrics.openExposure)}</strong>
          <small>{metrics.pendingCount} apostas ainda em monitoramento.</small>
        </article>
        <article className="panel dashboard-mini-card">
          <span>Liquidadas</span>
          <strong>{metrics.settledCount}</strong>
          <small>Base pronta para revisar resultado e performance.</small>
        </article>
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
                dataKey="axisLabel"
                tick={{ fill: COLORS.muted, fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                minTickGap={28}
                interval="preserveStartEnd"
                tickMargin={10}
              />
              <YAxis
                tickFormatter={(v: number) => formatCompactMoneyTick(v)}
                tick={{ fill: COLORS.muted, fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                width={72}
              />
              <Tooltip
                content={<MoneyTooltip />}
                cursor={{ stroke: COLORS.accent, strokeDasharray: "4 4", strokeOpacity: 0.45 }}
              />
              <Area
                type="monotone"
                dataKey="balance"
                name="Saldo"
                stroke={COLORS.accent}
                strokeWidth={3}
                fill="url(#balanceGrad)"
                dot={false}
                activeDot={{ r: 5, fill: COLORS.accent, stroke: COLORS.bg, strokeWidth: 3 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div className="chart-empty">
            <span>Liquide as primeiras apostas para visualizar a evolucao da banca</span>
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
                  content={<PercentTooltip />}
                  cursor={{ fill: "rgba(99, 102, 241, 0.08)" }}
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
              <span>Sem volume suficiente para consolidar o ROI mensal</span>
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
              <span>Sem apostas liquidadas o bastante para comparar esportes</span>
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
