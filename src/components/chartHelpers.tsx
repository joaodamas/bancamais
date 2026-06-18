import { money } from "../lib/metrics";

// Cores do design system dark + laranja (hex direto — Recharts não lê CSS vars)
export const COLORS = {
  accent: "#F97316",
  cyan: "#22D3EE",
  green: "#22C55E",
  red: "#EF4444",
  amber: "#F59E0B",
  panel: "#161618",
  line: "rgba(255,255,255,0.08)",
  muted: "#8A8A93",
  bg: "#0A0A0B",
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
