import { money } from "../lib/metrics";

// Cores do design system Carvão Suave (hex direto — Recharts não lê CSS vars)
export const COLORS = {
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

export type ChartTooltipPayloadEntry = {
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

export function MoneyTooltip(props: { active?: boolean; payload?: ChartTooltipPayloadEntry[]; label?: string }) {
  return <ChartTooltipCard {...props} formatter={(value) => money.format(value)} />;
}

export function PercentTooltip(props: { active?: boolean; payload?: ChartTooltipPayloadEntry[]; label?: string }) {
  return <ChartTooltipCard {...props} formatter={(value) => `${(value * 100).toFixed(1)}%`} />;
}

export function formatCompactMoneyTick(value: number) {
  const absolute = Math.abs(value);
  if (absolute >= 1000) {
    return `R$${(value / 1000).toFixed(absolute >= 10000 ? 0 : 1)}k`;
  }
  return money.format(value);
}
