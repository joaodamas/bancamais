import { useMemo, useState } from "react";
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
import { BarChart3, Lightbulb } from "lucide-react";
import { calculateMetrics, groupProfitBySport, money, percent, profitFactor, segmentByOddsBand, segmentByStakeBand, segmentByDayOfWeek, segmentByMarket, segmentByLeague, type SegmentStats } from "../lib/metrics";
import { buildMonthlyData } from "../lib/chartData";
import { buildInsights } from "../lib/insights";
import type { AppState } from "../lib/types";
import { COLORS, MoneyTooltip, PercentTooltip } from "./chartHelpers";
import { EmptyState } from "./EmptyState";

const SEGMENT_DIMS = [
  { id: "odds", label: "Cotação" },
  { id: "stake", label: "Stake" },
  { id: "day", label: "Dia" },
  { id: "market", label: "Mercado" },
  { id: "league", label: "Liga" },
] as const;

type SegmentDim = (typeof SEGMENT_DIMS)[number]["id"];

export function Performance({
  state,
  metrics,
}: {
  state: AppState;
  metrics: ReturnType<typeof calculateMetrics>;
}) {
  const [segDim, setSegDim] = useState<SegmentDim>("odds");
  const monthlyData = useMemo(() => buildMonthlyData(state), [state]);
  const bySport = useMemo(
    () => groupProfitBySport(state).sort((a, b) => b.profit - a.profit).slice(0, 8),
    [state]
  );
  const pf = useMemo(() => profitFactor(state), [state]);
  const insights = useMemo(() => buildInsights(state), [state]);
  const byOdds = useMemo(() => segmentByOddsBand(state), [state]);
  const byStake = useMemo(() => segmentByStakeBand(state), [state]);
  const byDay = useMemo(() => segmentByDayOfWeek(state), [state]);
  const byMarket = useMemo(() => segmentByMarket(state), [state]);
  const byLeague = useMemo(() => segmentByLeague(state), [state]);
  const pfLabel = metrics.settledCount === 0 ? "—" : pf === null ? "∞" : pf.toFixed(2);
  const pfPositive = pf === null ? metrics.settledCount > 0 : pf >= 1;

  const hasData = state.bets.some((b) => b.status !== "pending");
  const lowSample = metrics.settledCount > 0 && metrics.settledCount < 30;
  const segmentRows: Record<SegmentDim, SegmentStats[]> = {
    odds: byOdds,
    stake: byStake,
    day: byDay,
    market: byMarket,
    league: byLeague,
  };
  const activeDimLabel = SEGMENT_DIMS.find((d) => d.id === segDim)?.label.toLowerCase() ?? "";

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

      {lowSample && (
        <p className="sample-note">
          Amostra pequena: {metrics.settledCount} aposta{metrics.settledCount > 1 ? "s" : ""} liquidada{metrics.settledCount > 1 ? "s" : ""}. ROI e yield ainda carregam muito ruído de variância — trate como indicativo, não como verdade estatística (o sinal começa a valer na casa das centenas de apostas).
        </p>
      )}

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

        {insights.length > 0 && (
          <article className="panel">
            <div className="section-head section-head-inline">
              <div>
                <h2><Lightbulb size={16} className="inline-head-icon" /> Leitura automática</h2>
                <p>Onde você ganha e onde sangra — derivado dos segmentos abaixo.</p>
              </div>
            </div>
            <div className="insights-list">
              {insights.map((insight, index) => (
                <article key={index} className={`insight-card insight-${insight.tone}`}>
                  <span className="insight-dot" />
                  <div className="insight-body">
                    <strong className="insight-title">{insight.title}</strong>
                    <span className="insight-detail">{insight.detail}</span>
                  </div>
                </article>
              ))}
            </div>
          </article>
        )}

        <article className="panel">
          <div className="edge-head">
            <div className="edge-head-copy">
              <h2>Desempenho por segmento</h2>
              <p>O mesmo recorte de ROI e lucro, por {activeDimLabel}. Troque a aba para dissecar onde o resultado se concentra.</p>
            </div>
            <div className="edge-dims">
              {SEGMENT_DIMS.map((d) => (
                <button
                  key={d.id}
                  type="button"
                  className={segDim === d.id ? "edge-dim active" : "edge-dim"}
                  onClick={() => setSegDim(d.id)}
                >
                  {d.label}
                </button>
              ))}
            </div>
          </div>
          <SegmentTable rows={segmentRows[segDim]} />
        </article>
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
