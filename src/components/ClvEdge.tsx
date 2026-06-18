import { useMemo } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  BarChart,
  Bar,
  Cell,
} from "recharts";
import { calculateMetrics, groupProfitByBookmaker, clvPercent, percent } from "../lib/metrics";
import { buildClvTimeSeries } from "../lib/chartData";
import type { AppState } from "../lib/types";

const COLORS = {
  accent: "#8B5CF6",
  red: "#FB7185",
  cyan: "#22D3EE",
  panel: "#1E2026",
  line: "rgba(255,255,255,0.09)",
  muted: "#A1A1AA",
};

export function ClvEdge({
  state,
  metrics,
}: {
  state: AppState;
  metrics: ReturnType<typeof calculateMetrics>;
}) {
  const clvSeries = useMemo(() => buildClvTimeSeries(state), [state]);

  const byBook = useMemo(() => {
    return groupProfitByBookmaker(state)
      .map((book) => {
        const bets = state.bets.filter((b) => b.bookmakerId === book.id);
        const clvs = bets.map(clvPercent).filter((v): v is number => v !== null);
        const clvAvg =
          clvs.length > 0 ? clvs.reduce((s, v) => s + v, 0) / clvs.length : 0;
        return { ...book, clvAvg, sampleSize: clvs.length };
      })
      .filter((b) => b.sampleSize > 0);
  }, [state]);

  return (
    <section className="page">
      <div className="section-head">
        <div>
          <h1>CLV & Edge</h1>
          <p>
            Mede se você está batendo a linha de fechamento — o melhor sinal de edge antes
            do resultado.
          </p>
        </div>
      </div>

      <div className="grid two">
        <article className="panel clv-hero">
          <span>CLV médio geral</span>
          <strong className={metrics.clvAverage >= 0 ? "pos" : "neg"}>
            {percent.format(metrics.clvAverage)}
          </strong>
          <p>
            {clvSeries.length} apostas com odd de fechamento registrada.
            {metrics.clvAverage > 0
              ? " CLV positivo indica edge real de longo prazo."
              : " CLV negativo sugere revisão no timing das apostas."}
          </p>
        </article>

        <article className="panel chart-panel">
          <h2>CLV por aposta (cronológico)</h2>
          {clvSeries.length > 1 ? (
            <ResponsiveContainer width="100%" height={180}>
              <AreaChart data={clvSeries} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="clvGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={COLORS.accent} stopOpacity={0.2} />
                    <stop offset="95%" stopColor={COLORS.accent} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={COLORS.line} vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fill: COLORS.muted, fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tickFormatter={(v: number) => `${v}%`}
                  tick={{ fill: COLORS.muted, fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                  width={36}
                />
                <ReferenceLine y={0} stroke={COLORS.line} strokeDasharray="4 4" />
                <Tooltip
                  formatter={(v) => [`${Number(v ?? 0)}%`, "CLV"]}
                  contentStyle={{
                    background: COLORS.panel,
                    border: `1px solid ${COLORS.line}`,
                    borderRadius: 8,
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="clv"
                  name="CLV"
                  stroke={COLORS.accent}
                  strokeWidth={2}
                  fill="url(#clvGrad)"
                  dot={false}
                  activeDot={{ r: 3, fill: COLORS.accent }}
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="chart-empty">
              <span>Registre odds de fechamento nas apostas para ver o CLV</span>
            </div>
          )}
        </article>
      </div>

      <article className="panel" style={{ marginTop: 14 }}>
        <h2>CLV por casa de apostas</h2>
        {byBook.length > 0 ? (
          <ResponsiveContainer width="100%" height={160}>
            <BarChart
              data={byBook}
              layout="vertical"
              margin={{ top: 0, right: 16, left: 0, bottom: 0 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                stroke={COLORS.line}
                horizontal={false}
              />
              <XAxis
                type="number"
                tickFormatter={(v: number) => `${(v * 100).toFixed(1)}%`}
                tick={{ fill: COLORS.muted, fontSize: 10 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                type="category"
                dataKey="name"
                tick={{ fill: COLORS.muted, fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                width={80}
              />
              <ReferenceLine x={0} stroke={COLORS.line} />
              <Tooltip
                formatter={(v) => [`${(Number(v ?? 0) * 100).toFixed(2)}%`, "CLV médio"]}
                contentStyle={{
                  background: COLORS.panel,
                  border: `1px solid ${COLORS.line}`,
                  borderRadius: 8,
                }}
              />
              <Bar dataKey="clvAvg" name="CLV médio" radius={[0, 3, 3, 0]}>
                {byBook.map((entry, i) => (
                  <Cell
                    key={i}
                    fill={entry.clvAvg >= 0 ? COLORS.accent : COLORS.red}
                    fillOpacity={0.85}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <p style={{ color: "var(--muted)", padding: "16px 0" }}>
            Nenhuma aposta com odd de fechamento registrada ainda.
          </p>
        )}
      </article>
    </section>
  );
}
