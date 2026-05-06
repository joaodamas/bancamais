import type { FC } from "react";

interface MetricProps {
  label: string;
  value: string;
  detail: string;
  tone?: "good" | "bad";
}

export const Metric: FC<MetricProps> = ({ label, value, detail, tone }) => {
  return (
    <div className="metric">
      <span>{label}</span>
      <strong className={tone === "good" ? "pos" : tone === "bad" ? "neg" : ""}>{value}</strong>
      <small>{detail}</small>
    </div>
  );
};
