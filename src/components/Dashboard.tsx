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
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
} from "recharts";
import { calculateMetrics, money, percent, bettingStreaks, MIN_RELIABLE_SAMPLE } from "../lib/metrics";
import { buildBankrollTimeSeries, buildDailyProfitSeries, buildRealizedDrawdown } from "../lib/chartData";
import { resolveUnitValue } from "../lib/unit";
import type { AppState } from "../lib/types";
import { EmptyState } from "./EmptyState";
import { COLORS, MoneyTooltip, PercentTooltip, formatCompactMoneyTick } from "./chartHelpers";

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
  const dailyProfit = useMemo(() => buildDailyProfitSeries(state), [state]);

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

  // Drawdown sobre o lucro REALIZADO (não o caixa) — placing/churn de apostas
  // não gera vale fantasma. Mesma base do Relatório.
  const realizedDrawdown = useMemo(() => buildRealizedDrawdown(state), [state]);
  const drawdownData = realizedDrawdown.series;
  const drawdownStats = { worstPct: realizedDrawdown.worstPct, worstAbs: realizedDrawdown.worstAbs };
  const maxDrawdown = drawdownStats.worstPct;

  const monitoredCapital = metrics.totalBalance + metrics.openExposure;
  const unitValue = resolveUnitValue(state.riskSettings, monitoredCapital);
  const pending = state.bets.filter((bet) => bet.status === "pending");
  const streaks = bettingStreaks(state);
  const lowSample = metrics.settledCount > 0 && metrics.settledCount < MIN_RELIABLE_SAMPLE;
  const voidCount = state.bets.filter((bet) => bet.status === "void").length;
  const resultMix = [
    { name: "Green", value: streaks.greens, color: COLORS.green },
    { name: "Red", value: streaks.reds, color: COLORS.red },
    { name: "Anuladas", value: voidCount, color: COLORS.muted },
  ].filter((slice) => slice.value > 0);
  const resultTotal = resultMix.reduce((sum, slice) => sum + slice.value, 0);

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
    <section className="page page-dash">
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
          <span className="stat-label">
            ROI
            {lowSample && <span className="stat-badge-low" title={`Amostra baixa: ${metrics.settledCount} liquidadas. ROI só vira sinal confiável a partir de ~${MIN_RELIABLE_SAMPLE}.`}>amostra baixa</span>}
          </span>
          <strong className={`stat-value text-mono ${metrics.roi >= 0 ? "pos" : "neg"}`}>{percent.format(metrics.roi)}</strong>
          <span className="stat-foot">lucro / capital depositado</span>
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
        <article className="stat-card">
          <span className="stat-label">Máx. drawdown</span>
          <strong className={`stat-value text-mono ${drawdownStats.worstAbs > 0 ? "neg" : ""}`}>
            {drawdownStats.worstAbs > 0 ? `−${money.format(drawdownStats.worstAbs)}` : "—"}
          </strong>
          <span className="stat-foot">
            {drawdownStats.worstAbs > 0 ? `${percent.format(drawdownStats.worstPct)} do pico` : "sem queda registrada"}
          </span>
        </article>
      </div>

      <div className="stat-band">
        <article className="stat-card">
          <span className="stat-label">Maior seq. green</span>
          <strong className="stat-value text-mono pos">{streaks.longestGreen}</strong>
          <span className="stat-foot">greens seguidos</span>
        </article>
        <article className="stat-card">
          <span className="stat-label">Maior seq. red</span>
          <strong className="stat-value text-mono neg">{streaks.longestRed}</strong>
          <span className="stat-foot">reds seguidos</span>
        </article>
        <article className="stat-card">
          <span className="stat-label">Green × Red</span>
          <strong className="stat-value text-mono">{streaks.greens} × {streaks.reds}</strong>
          <span className="stat-foot">acertos × erros</span>
        </article>
        <article className="stat-card">
          <span className="stat-label">Stake média</span>
          <strong className="stat-value text-mono">{money.format(streaks.avgStake)}</strong>
          <span className="stat-foot">por aposta</span>
        </article>
      </div>

      {pending.length > 0 && (
        <article className="panel dash-pending">
          <div className="dash-pending-head">
            <h2>Em aberto agora</h2>
            <span>{pending.length} aposta{pending.length !== 1 ? "s" : ""} · {money.format(metrics.openExposure)} em risco</span>
          </div>
          <div className="dash-pending-list">
            {pending.slice(0, 6).map((bet) => (
              <div key={bet.id} className="dash-pending-row">
                <div className="dash-pending-info">
                  <span className="dash-pending-event">{bet.eventName}</span>
                  <span className="dash-pending-sub">{bet.selection} · @{bet.odds.toFixed(2)}</span>
                </div>
                <span className="dash-pending-money text-mono">{money.format(bet.stake)} → {money.format(bet.stake * bet.odds)}</span>
              </div>
            ))}
          </div>
          {pending.length > 6 && (
            <span className="dash-pending-foot">+{pending.length - 6} aposta(s) em aberto</span>
          )}
        </article>
      )}

      {/* Curva da banca — herói */}
      <article className="panel chart-panel dash-hero">
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
          <ResponsiveContainer width="100%" height={300}>
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
                type="stepAfter"
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

      <div className="grid two">
        {/* Underwater — queda abaixo do pico */}
        <article className="panel chart-panel">
          <div className="chart-header">
            <div className="chart-title-block">
              <h2>Drawdown</h2>
              <span className="chart-subtitle text-mono">
                {maxDrawdown < 0 ? `pior: ${percent.format(maxDrawdown)}` : "sem queda registrada"}
              </span>
            </div>
          </div>
          {drawdownData.length > 1 ? (
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={drawdownData} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
                <defs>
                  <linearGradient id="ddGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={COLORS.red} stopOpacity={0} />
                    <stop offset="95%" stopColor={COLORS.red} stopOpacity={0.25} />
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
                  tickFormatter={(v: number) => `${(v * 100).toFixed(0)}%`}
                  tick={{ fill: COLORS.muted, fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  width={48}
                />
                <Tooltip content={<PercentTooltip />} cursor={{ stroke: COLORS.red, strokeDasharray: "4 4", strokeOpacity: 0.45 }} />
                <ReferenceLine y={0} stroke={COLORS.line} />
                <Area type="stepAfter" dataKey="drawdown" name="Drawdown" stroke={COLORS.red} strokeWidth={2} fill="url(#ddGrad)" dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="chart-empty"><span>Liquide apostas para acompanhar o drawdown</span></div>
          )}
        </article>

        {/* Distribuição de resultados */}
        <article className="panel chart-panel">
          <div className="chart-header">
            <div className="chart-title-block">
              <h2>Resultados</h2>
              <span className="chart-subtitle text-mono">{resultTotal} liquidadas</span>
            </div>
          </div>
          {resultTotal > 0 ? (
            <div className="result-mix">
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={resultMix}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={52}
                    outerRadius={80}
                    paddingAngle={2}
                    stroke="none"
                  >
                    {resultMix.map((slice) => (
                      <Cell key={slice.name} fill={slice.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    content={({ active, payload }) =>
                      active && payload?.length ? (
                        <div className="chart-tooltip">
                          <span className="chart-tooltip-label">{payload[0].name}</span>
                          <div className="chart-tooltip-row">
                            <strong>{payload[0].value} ({percent.format((payload[0].value as number) / resultTotal)})</strong>
                          </div>
                        </div>
                      ) : null
                    }
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="result-mix-legend">
                {resultMix.map((slice) => (
                  <div key={slice.name} className="result-mix-legend-item">
                    <span className="result-mix-dot" style={{ background: slice.color }} />
                    <span>{slice.name}</span>
                    <strong className="text-mono">{slice.value}</strong>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="chart-empty"><span>Sem apostas liquidadas ainda</span></div>
          )}
        </article>
      </div>

      {dailyProfit.length > 0 && (
        <div className="grid two">
          {/* Lucro acumulado (só apostas — distinto da banca) */}
          <article className="panel chart-panel">
            <div className="chart-header">
              <div className="chart-title-block">
                <h2>Lucro acumulado</h2>
                <span className="chart-subtitle text-mono">desde a 1ª aposta · só apostas</span>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={dailyProfit} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
                <defs>
                  <linearGradient id="cumGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={COLORS.accent} stopOpacity={0.2} />
                    <stop offset="95%" stopColor={COLORS.accent} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={COLORS.line} vertical={false} />
                <XAxis dataKey="axisLabel" tick={{ fill: COLORS.muted, fontSize: 11 }} axisLine={false} tickLine={false} minTickGap={28} interval="preserveStartEnd" tickMargin={10} />
                <YAxis tickFormatter={(v: number) => formatCompactMoneyTick(v)} tick={{ fill: COLORS.muted, fontSize: 11 }} axisLine={false} tickLine={false} width={64} />
                <Tooltip content={<MoneyTooltip />} cursor={{ stroke: COLORS.accent, strokeDasharray: "4 4", strokeOpacity: 0.45 }} />
                <ReferenceLine y={0} stroke={COLORS.muted} strokeDasharray="4 4" strokeOpacity={0.5} />
                <Area type="stepAfter" dataKey="cumulative" name="Lucro acumulado" stroke={COLORS.accent} strokeWidth={2.5} fill="url(#cumGrad)" dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </article>

          {/* Lucro por dia */}
          <article className="panel chart-panel">
            <div className="chart-header">
              <div className="chart-title-block">
                <h2>Lucro por dia</h2>
                <span className="chart-subtitle text-mono">resultado diário</span>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={dailyProfit} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={COLORS.line} vertical={false} />
                <XAxis dataKey="axisLabel" tick={{ fill: COLORS.muted, fontSize: 11 }} axisLine={false} tickLine={false} minTickGap={20} interval="preserveStartEnd" tickMargin={10} />
                <YAxis tickFormatter={(v: number) => formatCompactMoneyTick(v)} tick={{ fill: COLORS.muted, fontSize: 11 }} axisLine={false} tickLine={false} width={64} />
                <Tooltip content={<MoneyTooltip />} cursor={{ fill: "rgba(249, 115, 22, 0.06)" }} />
                <ReferenceLine y={0} stroke={COLORS.line} />
                <Bar dataKey="profit" name="Lucro do dia" radius={[3, 3, 0, 0]}>
                  {dailyProfit.map((d, i) => (
                    <Cell key={i} fill={d.profit >= 0 ? COLORS.green : COLORS.red} fillOpacity={0.85} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </article>
        </div>
      )}
    </section>
  );
}
