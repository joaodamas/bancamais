import type { AppState, DashboardMetrics } from "./types";
import { clvPercent } from "./metrics";
import { detectTilt } from "./tiltDetection";
import { checkHardStop, riskAlertsExtended } from "./riskGuard";

export type HealthGrade = "A" | "B" | "C" | "D" | "F";

export interface HealthDimension {
  score: number;
  label: string;
  detail: string;
}

export interface HealthScore {
  overall: number;
  grade: HealthGrade;
  interpretation: string;
  dimensions: {
    risk: HealthDimension;
    performance: HealthDimension;
    clv: HealthDimension;
    discipline: HealthDimension;
    behavior: HealthDimension;
  };
  improvementTip: string;
}

function toGrade(score: number): HealthGrade {
  if (score >= 85) return "A";
  if (score >= 70) return "B";
  if (score >= 55) return "C";
  if (score >= 40) return "D";
  return "F";
}

function clamp(v: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, v));
}

export function calculateHealthScore(state: AppState, metrics: DashboardMetrics): HealthScore {
  const { totalBalance, roi, hitRate, clvAverage, openExposure, settledCount } = metrics;
  const rs = state.riskSettings;

  // ── Dimensão 1: Risco ──────────────────────────────────────
  const exposurePct = totalBalance > 0 ? (openExposure / totalBalance) * 100 : 0;
  const maxExposure = rs.maxOpenExposurePercent;
  const hardStop = checkHardStop(state);
  const riskAlertList = riskAlertsExtended(state);
  const dangerAlerts = riskAlertList.filter((a) => a.level === "danger").length;
  const warnAlerts = riskAlertList.filter((a) => a.level === "warning").length;

  let riskScore = 100;
  if (hardStop?.blocked) riskScore -= 50;
  riskScore -= dangerAlerts * 25;
  riskScore -= warnAlerts * 10;
  if (exposurePct > maxExposure) riskScore -= clamp((exposurePct - maxExposure) * 2, 0, 30);
  riskScore = clamp(riskScore);

  const riskDetail = hardStop?.blocked
    ? "Hard stop ativado."
    : dangerAlerts > 0
      ? `${dangerAlerts} alerta(s) crítico(s) ativo(s).`
      : warnAlerts > 0
        ? `${warnAlerts} aviso(s) de risco.`
        : exposurePct <= maxExposure
          ? "Exposição dentro do limite."
          : "Exposição elevada.";

  // ── Dimensão 2: Performance ────────────────────────────────
  let perfScore = 50;
  if (settledCount < 10) {
    perfScore = 50;
  } else {
    // ROI: 0% = 50pts, +10% = 80pts, -10% = 20pts
    perfScore += clamp(roi * 300, -50, 50);
    // Hit rate: 50% = baseline, +10% acima = +10pts
    const hrDelta = hitRate - 0.5;
    perfScore += clamp(hrDelta * 100, -20, 20);
  }
  perfScore = clamp(perfScore);

  const perfDetail = settledCount < 10
    ? "Volume insuficiente para avaliação precisa."
    : roi > 0.05
      ? `ROI de ${(roi * 100).toFixed(1)}% — acima da média.`
      : roi < -0.05
        ? `ROI de ${(roi * 100).toFixed(1)}% — abaixo de zero.`
        : `ROI de ${(roi * 100).toFixed(1)}% — próximo do neutro.`;

  // ── Dimensão 3: CLV ────────────────────────────────────────
  const betsWithCLV = state.bets.filter((b) => b.closingOdds != null).length;
  let clvScore = 50;

  if (betsWithCLV < 5) {
    clvScore = 50;
  } else {
    // CLV > 0 = beating the market
    clvScore += clamp(clvAverage * 500, -50, 50);
    const clvCoverage = betsWithCLV / Math.max(state.bets.length, 1);
    clvScore += clamp((clvCoverage - 0.3) * 40, -10, 10);
  }
  clvScore = clamp(clvScore);

  const clvDetail = betsWithCLV < 5
    ? "Registre odds de fechamento para ativar análise de CLV."
    : clvAverage > 0.01
      ? `CLV médio de +${(clvAverage * 100).toFixed(1)}% — edge real demonstrado.`
      : clvAverage < -0.01
        ? `CLV médio de ${(clvAverage * 100).toFixed(1)}% — entradas a desfavor.`
        : "CLV próximo de zero — sem edge claro.";

  // ── Dimensão 4: Disciplina ─────────────────────────────────
  const unit = totalBalance * (rs.unitPercent / 100);
  const maxStake = unit * rs.maxStakeUnits;
  const pending = state.bets.filter((b) => b.status === "pending");
  const oversizedBets = pending.filter((b) => b.stake > maxStake && maxStake > 0).length;
  const recentBets = [...state.bets]
    .sort((a, b) => new Date(b.placedAt).getTime() - new Date(a.placedAt).getTime())
    .slice(0, 20);
  const oversizedRecent = recentBets.filter((b) => b.stake > maxStake && maxStake > 0).length;

  let discScore = 100;
  discScore -= oversizedBets * 15;
  discScore -= oversizedRecent * 5;
  if (exposurePct > maxExposure * 1.5) discScore -= 20;
  discScore = clamp(discScore);

  const discDetail = oversizedBets > 0
    ? `${oversizedBets} aposta(s) pendente(s) acima do limite de stake.`
    : oversizedRecent > 0
      ? `${oversizedRecent} aposta(s) recente(s) acima do limite (histórico).`
      : "Stakes dentro das unidades configuradas.";

  // ── Dimensão 5: Comportamento (Tilt) ──────────────────────
  const tilt = detectTilt(state);
  const behaviorScore = clamp(100 - tilt.score);

  const behaviorDetail = tilt.level === "none"
    ? "Comportamento dentro do padrão."
    : tilt.level === "low"
      ? "Sinais leves de comportamento alterado."
      : tilt.level === "medium"
        ? "Padrão moderado de risco — considere pausa."
        : tilt.level === "high"
          ? "Risco de tilt elevado detectado."
          : "Tilt provável — interrompa as operações.";

  // ── Score geral (ponderado) ────────────────────────────────
  const weights = { risk: 0.30, performance: 0.25, clv: 0.20, discipline: 0.15, behavior: 0.10 };
  const overall = clamp(
    Math.round(
      riskScore * weights.risk +
      perfScore * weights.performance +
      clvScore * weights.clv +
      discScore * weights.discipline +
      behaviorScore * weights.behavior,
    ),
  );

  const grade = toGrade(overall);

  const interpretations: Record<HealthGrade, string> = {
    A: "Banca saudável. Gestão de risco e desempenho dentro do ideal.",
    B: "Boa saúde geral, com espaço para ajustes pontuais.",
    C: "Situação moderada. Revise as dimensões amarelas antes de escalar volume.",
    D: "Banca em risco. Reduza exposição e volume antes de continuar.",
    F: "Banca crítica. Pause operações, revise configurações e recomece com disciplina.",
  };

  const worstDimension = Object.entries({
    risk: riskScore,
    performance: perfScore,
    clv: clvScore,
    discipline: discScore,
    behavior: behaviorScore,
  }).sort(([, a], [, b]) => a - b)[0];

  const tips: Record<string, string> = {
    risk: "Resolva os alertas de risco ativos e reduza a exposição aberta.",
    performance: "Revise as estratégias com ROI negativo e foque nos mercados com edge.",
    clv: "Registre odds de fechamento em mais apostas para medir seu edge real.",
    discipline: "Ajuste suas stakes para ficarem dentro das unidades configuradas.",
    behavior: "Faça uma pausa — o padrão de apostas recente sugere decisões emocionais.",
  };

  return {
    overall,
    grade,
    interpretation: interpretations[grade],
    dimensions: {
      risk: { score: riskScore, label: "Risco", detail: riskDetail },
      performance: { score: perfScore, label: "Performance", detail: perfDetail },
      clv: { score: clvScore, label: "CLV", detail: clvDetail },
      discipline: { score: discScore, label: "Disciplina", detail: discDetail },
      behavior: { score: behaviorScore, label: "Comportamento", detail: behaviorDetail },
    },
    improvementTip: tips[worstDimension[0]] ?? "Continue monitorando as métricas regularmente.",
  };
}

export function healthGradeColor(grade: HealthGrade): string {
  const map: Record<HealthGrade, string> = {
    A: "var(--positive)",
    B: "#86efac",
    C: "var(--warning)",
    D: "#fb923c",
    F: "var(--negative)",
  };
  return map[grade];
}
