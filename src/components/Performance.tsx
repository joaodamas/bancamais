import { useMemo } from "react";
import {
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
import { BarChart3 } from "lucide-react";
import { calculateMetrics, groupProfitBySport, money, percent, profitFactor, segmentByOddsBand, segmentByStakeBand, segmentByDayOfWeek, segmentByMarket, segmentByLeague, type SegmentStats } from "../lib/metrics";
import { buildMonthlyData } from "../lib/chartData";
import type { AppState } from "../lib/types";
import { COLORS, MoneyTooltip, PercentTooltip } from "./chartHelpers";
import { EmptyState } from "./EmptyState";

export function Performance({
  state,
  metrics,
}: {
  state: AppState;
  metrics: ReturnType<typeof calculateMetrics>;
}) {
  const monthlyData = useMemo(() => buildMonthlyData(state), [state]);
  const bySport = useMemo(
    () => groupProfitBySport(state).sort((a, b) => b.profit - a.profit).slice(0, 8),
    [state]
  );
  const pf = useMemo(() => profitFactor(state), [state]);
  const byOdds = useMemo(() => segmentByOddsBand(state), [state]);
  const byStake = useMemo(() => segmentByStakeBand(state), [state]);
  const byDay = useMemo(() => segmentByDayOfWeek(state), [state]);
  const byMarket = useMemo(() => segmentByMarket(state), [state]);
  const byLeague = useMemo(() => segmentByLeague(state), [state]);
  const pfLabel = metrics.settledCount === 0 ? "—" : pf === null ? "∞" : pf.toFixed(2);
  const pfPositive = pf === null ? metrics.settledCount > 0 : pf >= 1;

  const hasData = state.bets.some((b) => b.status !== "pending");

  return (
    <section className="page">
      <div className="section-head">
        <div>
          <h1>Performance</h1>
          <p>Desempenho por período e por esporte</p>
        </div>
      </div>

      {/* Recap de KPIs */}
      <div className="stat-band">
        <article className="stat-card">
          <span className="stat-label">ROI</span>
          <strong className={`stat-value text-mono ${metrics.roi >= 0 ? "pos" : "neg"}`}>{percent.format(metrics.roi)}</strong>
          <span className="stat-foot">{metrics.settledCount} liquidadas</span>
        </article>
        <article className="stat-card">
          <span className="stat-label">Yield</span>
          <strong className={`stat-value text-mono ${metrics.yield >= 0 ? "pos" : "neg"}`}>{percent.format(metrics.yield)}</strong>
          <span className="stat-foot">lucro / volume</span>
        </article>
        <article className="stat-card">
          <span className="stat-label">Taxa de acerto</span>
          <strong className="stat-value text-mono">{percent.format(metrics.hitRate)}</strong>
          <span className="stat-foot">ganhas / liquidadas</span>
        </article>
        <article className="stat-card">
          <span className="stat-label">Odd média</span>
          <strong className="stat-value text-mono">{metrics.averageOdds.toFixed(2)}</strong>
          <span className="stat-foot">execução média</span>
        </article>
        <article className="stat-card">
          <span className="stat-label">Fator de lucro</span>
          <strong className={`stat-value text-mono ${pfPositive ? "pos" : "neg"}`}>{pfLabel}</strong>
          <span className="stat-foot">ganhos / perdas</span>
        </article>
      </div>

      {!hasData ? (
        <article className="panel">
          <EmptyState
            icon={<BarChart3 size={24} />}
            title="Sem desempenho consolidado ainda"
            description="Liquide suas primeiras apostas (ganha/perdida) para liberar o ROI mensal, o yield e o comparativo de lucro por esporte."
          />
        </article>
      ) : (
        <>
        <div className="grid two">
          <article className="panel chart-panel">
            <h2>ROI mensal</h2>
            {monthlyData.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={monthlyData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={COLORS.line} horizontal vertical={false} />
                  <XAxis dataKey="month" tick={{ fill: COLORS.muted, fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis
                    tickFormatter={(v: number) => `${(v * 100).toFixed(0)}%`}
                    tick={{ fill: COLORS.muted, fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                    width={44}
                  />
                  <Tooltip content={<PercentTooltip />} cursor={{ fill: "rgba(249, 115, 22, 0.08)" }} />
                  <ReferenceLine y={0} stroke={COLORS.line} />
                  <Bar dataKey="roi" name="ROI" radius={[3, 3, 0, 0]}>
                    {monthlyData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.roi >= 0 ? COLORS.accent : COLORS.red} fillOpacity={0.85} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="chart-empty"><span>Sem volume suficiente para consolidar o ROI mensal</span></div>
            )}
          </article>

          <article className="panel chart-panel">
            <h2>Lucro por esporte</h2>
            {bySport.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={bySport} layout="vertical" margin={{ top: 0, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={COLORS.line} horizontal={false} vertical />
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
                      <Cell key={i} fill={entry.profit >= 0 ? COLORS.green : COLORS.red} fillOpacity={0.85} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="chart-empty"><span>Sem apostas liquidadas o bastante para comparar esportes</span></div>
            )}
          </article>
        </div>

        <div className="segment-masonry">
          <article className="panel">
            <h2>Desempenho por faixa de cotação</h2>
            <SegmentTable rows={byOdds} />
          </article>
          <article className="panel">
            <h2>Desempenho por tamanho de stake</h2>
            <SegmentTable rows={byStake} />
          </article>
          <article className="panel">
            <h2>Desempenho por dia da semana</h2>
            <SegmentTable rows={byDay} />
          </article>
          <article className="panel">
            <h2>Desempenho por mercado</h2>
            <SegmentTable rows={byMarket} />
          </article>
          <article className="panel">
            <h2>Desempenho por liga / campeonato</h2>
            <SegmentTable rows={byLeague} />
          </article>
        </div>
        </>
      )}
    </section>
  );
}

function SegmentTable({ rows }: { rows: SegmentStats[] }) {
  if (rows.length === 0) {
    return <p className="edge-empty">Sem apostas suficientes para este corte.</p>;
  }
  return (
    <table className="edge-table">
      <thead>
        <tr>
          <th>Faixa</th>
          <th className="num">Apostas</th>
          <th className="num">ROI</th>
          <th className="num">Lucro</th>
          <th className="num">Acerto</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.label}>
            <td>{row.label}</td>
            <td className="num text-mono">{row.bets}</td>
            <td className={`num ${row.roi >= 0 ? "pos" : "neg"}`}>{percent.format(row.roi)}</td>
            <td className={`num ${row.profit >= 0 ? "pos" : "neg"}`}>{money.format(row.profit)}</td>
            <td className="num text-mono">{percent.format(row.hitRate)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
