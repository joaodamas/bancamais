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
import { AlertTriangle, Clock, Layers, Gauge } from "lucide-react";
import { calculateMetrics, groupProfitBySport, money, percent, riskAlerts } from "../lib/metrics";
import { resolveUnitValue, exceedsUnitCap } from "../lib/unit";
import { buildBankrollTimeSeries, buildMonthlyData } from "../lib/chartData";
import type { AppState } from "../lib/types";
import { EmptyState } from "./EmptyState";
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

  // Colapsa a série para um ponto por dia (saldo de fechamento do dia):
  // evita labels de eixo repetidos e deixa a curva mais legível/crível.
  const chartData = useMemo(() => {
    if (filteredTimeSeries.length === 0) return filteredTimeSeries;
    const byDay = new Map<string, (typeof filteredTimeSeries)[number]>();
    const order: string[] = [];
    filteredTimeSeries.forEach((point, i) => {
      const key = point.date ? point.date.slice(0, 10) : `__start_${i}`;
      if (!byDay.has(key)) order.push(key);
      byDay.set(key, point);
    });
    return order.map((key) => byDay.get(key)!);
  }, [filteredTimeSeries]);

  const chartStart = chartData[0]?.balance ?? 0;
  const chartEnd = chartData[chartData.length - 1]?.balance ?? 0;

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

      {/* Banda 1 — Capital */}
      <div className="stat-band">
        <article className="stat-card stat-card-primary">
          <span className="stat-label">Saldo</span>
          <strong className="stat-value text-mono">{money.format(metrics.totalBalance)}</strong>
          <span className="stat-foot">livre para apostar</span>
        </article>
        <article className="stat-card">
          <span className="stat-label">Em aberto</span>
          <strong className="stat-value text-mono">{money.format(metrics.openExposure)}</strong>
          <span className="stat-foot">{metrics.pendingCount} pendentes</span>
        </article>
        <article className="stat-card">
          <span className="stat-label">Capital total</span>
          <strong className="stat-value text-mono">{money.format(monitoredCapital)}</strong>
          <span className="stat-foot">saldo + exposição</span>
        </article>
        <article className="stat-card">
          <span className="stat-label">Unidade</span>
          <strong className="stat-value text-mono">{unitValue > 0 ? money.format(unitValue) : "—"}</strong>
          <span className="stat-foot">{state.riskSettings.unitMode === "fixed" ? "valor fixo" : `${state.riskSettings.unitPercent}% da banca`}</span>
        </article>
      </div>

      {/* Banda 2 — Performance */}
      <div className="stat-band">
        <article className="stat-card">
          <span className="stat-label">ROI</span>
          <strong className={`stat-value text-mono ${metrics.roi >= 0 ? "pos" : "neg"}`}>{percent.format(metrics.roi)}</strong>
          <span className="stat-foot">{metrics.settledCount} liquidadas</span>
        </article>
        <article className="stat-card">
          <span className="stat-label">Taxa de acerto</span>
          <strong className="stat-value text-mono">{percent.format(metrics.hitRate)}</strong>
          <span className="stat-foot">ganhas / liquidadas</span>
        </article>
        <article className="stat-card">
          <span className="stat-label">CLV médio</span>
          <strong className={`stat-value text-mono ${metrics.clvAverage >= 0 ? "pos" : "neg"}`}>{percent.format(metrics.clvAverage)}</strong>
          <span className="stat-foot">vs linha de fechamento</span>
        </article>
        <article className="stat-card">
          <span className="stat-label">Lucro realizado</span>
          <strong className={`stat-value text-mono ${metrics.profit >= 0 ? "pos" : "neg"}`}>{money.format(metrics.profit)}</strong>
          <span className="stat-foot">apostas fechadas</span>
        </article>
      </div>

      {/* Banda 3 — Gestão de risco (só com unidade configurada) */}
      {unitValue > 0 && (
        <div className="risk-band">
          <article className="risk-card">
            <div className="risk-card-head"><Layers size={14} /><span>Stake médio</span></div>
            <strong className="text-mono">{avgStakeUnits > 0 ? `${avgStakeUnits.toFixed(1)}u` : "—"}</strong>
            <small>nas {pendingForUnits.length} pendentes</small>
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
            {chartData.length > 1 && (
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
        {chartData.length > 1 ? (
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={chartData} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
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
