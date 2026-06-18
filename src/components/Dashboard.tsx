import { useMemo, useState } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import { calculateMetrics, money, percent } from "../lib/metrics";
import { buildBankrollTimeSeries } from "../lib/chartData";
import { resolveUnitValue } from "../lib/unit";
import type { AppState } from "../lib/types";
import { EmptyState } from "./EmptyState";
import { COLORS, MoneyTooltip, formatCompactMoneyTick } from "./chartHelpers";

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

  // Colapsa para um ponto por dia (saldo de fechamento) — eixo limpo, curva crível.
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

  const monitoredCapital = metrics.totalBalance + metrics.openExposure;
  const unitValue = resolveUnitValue(state.riskSettings, monitoredCapital);

  const isEmpty = state.bets.length === 0;
  const hasBookmakers = state.bookmakers.length > 0;

  const today = new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" });

  if (isEmpty) {
    return (
      <section className="page">
        <div className="section-head">
          <div>
            <h1>Dashboard</h1>
            <p>Visão geral da banca · {today}</p>
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
          <p>{today}</p>
        </div>
        <div style={{ display: "flex", gap: "8px" }}>
          <button className="primary" onClick={onOpenNewBet}>Nova aposta</button>
          <button onClick={onOpenBooks}>Casas</button>
        </div>
      </div>

      {/* Banda 1 — Capital */}
      <div className="stat-band">
        <article className="stat-card stat-card-primary stat-card-spark">
          <div className="stat-spark-copy">
            <span className="stat-label">Saldo</span>
            <strong className="stat-value text-mono">{money.format(metrics.totalBalance)}</strong>
            <span className="stat-foot">livre para apostar</span>
          </div>
          {chartData.length > 1 && (
            <div className="stat-sparkline">
              <ResponsiveContainer width="100%" height={36}>
                <AreaChart data={chartData} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="sparkGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={COLORS.green} stopOpacity={0.22} />
                      <stop offset="100%" stopColor={COLORS.green} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <Area type="monotone" dataKey="balance" stroke={COLORS.green} strokeWidth={1.6} fill="url(#sparkGrad)" dot={false} isAnimationActive={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
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

      {/* Curva da banca */}
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
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={chartData} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
              <defs>
                <linearGradient id="balanceGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={COLORS.accent} stopOpacity={0.2} />
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
            <span>Liquide as primeiras apostas para visualizar a evolução da banca</span>
          </div>
        )}
      </article>
    </section>
  );
}
