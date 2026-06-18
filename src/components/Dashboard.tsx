import { useMemo, useState } from "react";
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
import { AlertTriangle, Clock, Coins, Layers, Gauge } from "lucide-react";
import { calculateMetrics, groupProfitBySport, money, percent, riskAlerts } from "../lib/metrics";
import { resolveUnitValue, exceedsUnitCap } from "../lib/unit";
import { buildBankrollTimeSeries, buildMonthlyData } from "../lib/chartData";
import type { AppState } from "../lib/types";
import { EmptyState } from "./EmptyState";
import { Metric } from "./Metric";
import { RiskAdvisor } from "./RiskAdvisor";

// Cores do design system Banca+ (hex direto — Recharts não lê CSS vars)
const COLORS = {
  accent: "#8B5CF6",
  cyan: "#22D3EE",
  green: "#34D399",
  red: "#FB7185",
  amber: "#FBBF24",
  panel: "#1E2026",
  line: "rgba(255,255,255,0.09)",
  muted: "#A1A1AA",
  bg: "#16171B",
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
  const [chartPeriod, setChartPeriod] = useState<"7d" | "30d" | "90d" | "all">("all");

  const timeSeries = useMemo(() => buildBankrollTimeSeries(state), [state]);
  const monthlyData = useMemo(() => buildMonthlyData(state), [state]);

  const periodCutoff = useMemo(() => {
    if (chartPeriod === "all") return null;
    const days = chartPeriod === "7d" ? 7 : chartPeriod === "30d" ? 30 : 90;
    return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
  }, [chartPeriod]);

  const filteredTimeSeries = useMemo(() => {
    if (!periodCutoff || timeSeries.length === 0) return timeSeries;
    const inRange = timeSeries.filter((p) => p.date && p.date >= periodCutoff);
    if (inRange.length === 0) return [];
    const beforeCutoff = timeSeries.filter((p) => !p.date || p.date < periodCutoff);
    const startBalance = beforeCutoff.length > 0 ? beforeCutoff[beforeCutoff.length - 1].balance : 0;
    return [
      { label: "Início", axisLabel: "Início", tooltipLabel: "Início do período", balance: startBalance, date: "" },
      ...inRange,
    ];
  }, [timeSeries, periodCutoff]);

  const filteredMonthlyData = useMemo(() => {
    if (!periodCutoff) return monthlyData;
    const d = new Date(periodCutoff);
    const cutoffKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    return monthlyData.filter((m) => m.key >= cutoffKey);
  }, [monthlyData, periodCutoff]);

  const monitoredCapital = metrics.totalBalance + metrics.openExposure;
  const alerts = useMemo(() => riskAlerts(state), [state]);

  // Insights baseados na unidade configurada
  const bankroll = monitoredCapital;
  const unitValue = resolveUnitValue(state.riskSettings, bankroll);
  const pendingForUnits = useMemo(() => state.bets.filter((b) => b.status === "pending"), [state.bets]);
  const overStaked = useMemo(
    () => pendingForUnits.filter((b) => exceedsUnitCap(b.stake, state.riskSettings, bankroll)),
    [pendingForUnits, state.riskSettings, bankroll]
  );
  const avgStakeUnits = pendingForUnits.length > 0 && unitValue > 0
    ? pendingForUnits.reduce((s, b) => s + b.stake, 0) / pendingForUnits.length / unitValue
    : 0;
  const exposureCap = bankroll * (state.riskSettings.maxOpenExposurePercent / 100);
  const exposurePct = exposureCap > 0 ? metrics.openExposure / exposureCap : 0;

  const chartStart = filteredTimeSeries[0]?.balance ?? 0;
  const chartEnd = filteredTimeSeries[filteredTimeSeries.length - 1]?.balance ?? 0;

  // Apostas pendentes há mais de 48h
  const stalePendingBets = useMemo(() => {
    const cutoff = Date.now() - 48 * 60 * 60 * 1000;
    return state.bets.filter((b) => b.status === "pending" && new Date(b.eventAt).getTime() < cutoff);
  }, [state.bets]);
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
      <div className="section-head">
        <div>
          <h1>Dashboard</h1>
          <p>{new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" })}</p>
        </div>
        <div style={{ display: "flex", gap: "8px" }}>
          <button className="primary" onClick={onOpenNewBet}>Nova aposta</button>
          <button onClick={onOpenBooks}>Casas</button>
        </div>
      </div>

      <div className="hero">
        <div className="balance-card">
          <span>Saldo</span>
          <strong>{money.format(metrics.totalBalance)}</strong>
          <div className="balance-breakdown">
            <div>
              <small>Livre para apostar</small>
              <b>{money.format(metrics.totalBalance)}</b>
            </div>
            <div>
              <small>Em apostas abertas</small>
              <b>{money.format(metrics.openExposure)}</b>
            </div>
            <div>
              <small>Unidade</small>
              <b className="text-mono">{unitValue > 0 ? money.format(unitValue) : "—"}</b>
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
          <span>Capital total</span>
          <strong>{money.format(monitoredCapital)}</strong>
          <small>saldo + exposição</small>
        </article>
        <article className="panel dashboard-mini-card">
          <span>Lucro realizado</span>
          <strong className={metrics.profit >= 0 ? "pos" : "neg"}>{money.format(metrics.profit)}</strong>
          <small>apostas fechadas</small>
        </article>
        <article className="panel dashboard-mini-card">
          <span>Em aberto</span>
          <strong>{money.format(metrics.openExposure)}</strong>
          <small>{metrics.pendingCount} apostas pendentes</small>
        </article>
        <article className="panel dashboard-mini-card">
          <span>Liquidadas</span>
          <strong>{metrics.settledCount}</strong>
          <small>apostas encerradas</small>
        </article>
      </div>

      {/* Insights de unidade — só quando a unidade está configurada */}
      {unitValue > 0 && (
        <div className="dashboard-unit-grid">
          <article className="panel unit-insight-card">
            <div className="unit-insight-icon"><Coins size={15} /></div>
            <div className="unit-insight-body">
              <span>Unidade</span>
              <strong className="text-mono">{money.format(unitValue)}</strong>
              <small>{state.riskSettings.unitMode === "fixed" ? "valor fixo" : `${state.riskSettings.unitPercent}% da banca`}</small>
            </div>
          </article>
          <article className="panel unit-insight-card">
            <div className="unit-insight-icon"><Layers size={15} /></div>
            <div className="unit-insight-body">
              <span>Stake médio</span>
              <strong className="text-mono">{avgStakeUnits > 0 ? `${avgStakeUnits.toFixed(1)}u` : "—"}</strong>
              <small>nas {pendingForUnits.length} pendentes</small>
            </div>
          </article>
          <article className={`panel unit-insight-card${overStaked.length > 0 ? " unit-insight-warn" : ""}`}>
            <div className="unit-insight-icon"><AlertTriangle size={15} /></div>
            <div className="unit-insight-body">
              <span>Acima do teto</span>
              <strong className="text-mono">{overStaked.length}</strong>
              <small>limite {state.riskSettings.maxStakeUnits}u/aposta</small>
            </div>
          </article>
          <article className={`panel unit-insight-card${exposurePct > 1 ? " unit-insight-warn" : ""}`}>
            <div className="unit-insight-icon"><Gauge size={15} /></div>
            <div className="unit-insight-body">
              <span>Exposição</span>
              <strong className="text-mono">{exposureCap > 0 ? percent.format(exposurePct) : "—"}</strong>
              <small>do limite ({money.format(exposureCap)})</small>
            </div>
          </article>
        </div>
      )}

      {/* Bloco "Atenção hoje" — só aparece quando há itens */}
      {(alerts.length > 0 || stalePendingBets.length > 0) && (
        <div className="dashboard-attention-grid">
          {alerts.map((alert) => (
            <article key={alert.title} className={`dashboard-attention-card dashboard-attention-${alert.level}`}>
              <div className="dashboard-attention-icon">
                <AlertTriangle size={14} />
              </div>
              <div>
                <strong>{alert.title}</strong>
                <p>{alert.detail}</p>
              </div>
            </article>
          ))}
          {stalePendingBets.length > 0 && (
            <article className="dashboard-attention-card dashboard-attention-info">
              <div className="dashboard-attention-icon">
                <Clock size={14} />
              </div>
              <div>
                <strong>{stalePendingBets.length} aposta(s) sem resultado</strong>
                <p>
                  {stalePendingBets.slice(0, 2).map((b) => b.eventName).join(", ")}
                  {stalePendingBets.length > 2 ? ` e mais ${stalePendingBets.length - 2}` : ""} — o evento já passou. Liquide os resultados.
                </p>
              </div>
            </article>
          )}
        </div>
      )}

      {/* Bankroll evolution chart */}
      <article className="panel chart-panel">
        <div className="chart-header">
          <div className="chart-title-block">
            <h2>Evolução da banca</h2>
            {filteredTimeSeries.length > 1 && (
              <span className="chart-subtitle text-mono">
                {money.format(chartStart)} → {money.format(chartEnd)}
              </span>
            )}
          </div>
          <div className="chart-header-right">
            <div className="chart-period-tabs">
              {(["7d", "30d", "90d", "all"] as const).map((p) => (
                <button
                  key={p}
                  className={`chart-period-tab${chartPeriod === p ? " active" : ""}`}
                  onClick={() => setChartPeriod(p)}
                >
                  {p === "all" ? "Tudo" : p}
                </button>
              ))}
            </div>
            <span className={metrics.profit >= 0 ? "pos" : "neg"}>
              {metrics.profit >= 0 ? "+" : ""}
              {money.format(metrics.profit)}
            </span>
          </div>
        </div>
        {filteredTimeSeries.length > 1 ? (
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={filteredTimeSeries} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
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
              <ReferenceLine
                y={chartStart}
                stroke={COLORS.muted}
                strokeDasharray="4 4"
                strokeOpacity={0.5}
                label={{ value: "início", position: "insideTopLeft", fill: COLORS.muted, fontSize: 10 }}
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
          {filteredMonthlyData.length > 0 ? (
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={filteredMonthlyData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
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
                  {filteredMonthlyData.map((entry, index) => (
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

      {/* Risk Advisor */}
      <div className="dashboard-risk-row">
        <article className="panel dashboard-risk-panel">
          <RiskAdvisor state={state} metrics={metrics} />
        </article>
      </div>
    </section>
  );
}
