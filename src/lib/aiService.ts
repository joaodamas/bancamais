import {
  calculateMetrics,
  groupProfitByStrategy,
  groupProfitByBookmaker,
  riskAlerts,
  money,
  percent,
  isLossResult,
} from "./metrics";
import type { AppState } from "./types";

export interface AIAnalysis {
  summary: string;
  topInsight: string;
  suggestions: AISuggestion[];
  riskWarnings: AIWarning[];
  bestStrategy: string | null;
  worstStrategy: string | null;
  generatedAt: string;
  source: "local" | "api";
}

export interface AISuggestion {
  type: "increase" | "decrease" | "avoid" | "focus" | "review";
  title: string;
  description: string;
  priority: "high" | "medium" | "low";
}

export interface AIWarning {
  severity: "critical" | "warning" | "info";
  title: string;
  detail: string;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function analyzePortfolio(state: AppState): Promise<AIAnalysis> {
  const endpoint = import.meta.env.VITE_AI_ENDPOINT as string | undefined;

  if (endpoint) {
    try {
      return await callAIEndpoint(state);
    } catch {
      // fall through to local analysis
    }
  }

  return analyzePortfolioLocally(state);
}

// ---------------------------------------------------------------------------
// Local rule-based analysis
// ---------------------------------------------------------------------------

function analyzePortfolioLocally(state: AppState): AIAnalysis {
  const metrics = calculateMetrics(state);
  const strategies = groupProfitByStrategy(state);
  const byBook = groupProfitByBookmaker(state);
  const alerts = riskAlerts(state);

  // --- suggestions ---------------------------------------------------------
  const suggestions: AISuggestion[] = [];

  if (metrics.yield > 0.08) {
    suggestions.push({
      type: "increase",
      title: "Banca performando bem",
      description: `Yield de ${percent.format(metrics.yield)} sugere edge real. Considere aumentar stake gradualmente na melhor estratégia.`,
      priority: "medium",
    });
  }

  if (metrics.yield < -0.05) {
    suggestions.push({
      type: "review",
      title: "Revisão de estratégia necessária",
      description: `Yield negativo acima de 5% em ${state.bets.length} apostas. Analise quais mercados contribuem mais para as perdas.`,
      priority: "high",
    });
  }

  if (metrics.hitRate < 0.4) {
    suggestions.push({
      type: "focus",
      title: "Taxa de acerto abaixo de 40%",
      description: "Focar em mercados com maior edge ou revisar critérios de seleção.",
      priority: "high",
    });
  }

  if (metrics.hitRate > 0.65 && metrics.settledCount > 30) {
    suggestions.push({
      type: "review",
      title: "Taxa de acerto elevada — cuidado com regressão",
      description: "Taxas acima de 65% em volume alto tendem a regredir à média. Mantenha disciplina de stake.",
      priority: "medium",
    });
  }

  const streak = currentLossStreak(state.bets);
  if (streak > 5) {
    suggestions.push({
      type: "decrease",
      title: "Sequência negativa detectada",
      description: `${streak} apostas perdidas seguidas. Considere reduzir stake ou pausar até revisão.`,
      priority: "high",
    });
  }

  if (metrics.clvAverage > 0) {
    suggestions.push({
      type: "focus",
      title: "CLV positivo — processo validado",
      description: "Você está batendo a linha de fechamento em média. Continue o processo atual.",
      priority: "low",
    });
  }

  // --- warnings ------------------------------------------------------------
  const riskWarnings: AIWarning[] = [];

  const exposureRatio =
    metrics.totalBalance > 0 ? metrics.openExposure / metrics.totalBalance : 0;

  if (exposureRatio > 0.3) {
    riskWarnings.push({
      severity: "critical",
      title: "Exposição crítica",
      detail: `${percent.format(exposureRatio)} da banca em aberto excede o limite seguro de 30%.`,
    });
  } else if (exposureRatio > 0.2) {
    riskWarnings.push({
      severity: "warning",
      title: "Exposição elevada",
      detail: `${percent.format(exposureRatio)} da banca em aberto. Monitore novas entradas.`,
    });
  }

  if (metrics.settledCount < 20) {
    riskWarnings.push({
      severity: "info",
      title: "Amostra pequena",
      detail: "Menos de 20 apostas liquidadas. Métricas ainda não são estatisticamente confiáveis.",
    });
  }

  for (const alert of alerts) {
    riskWarnings.push({
      severity: alert.level === "danger" ? "critical" : "warning",
      title: alert.title,
      detail: alert.detail,
    });
  }

  // suppress unused variable — byBook is available for future use
  void byBook;

  // --- best / worst strategy -----------------------------------------------
  const sorted = [...strategies].sort((a, b) => b.roi - a.roi);
  const bestStrategy = sorted[0]?.name ?? null;
  const worstStrategy = sorted[sorted.length - 1]?.name ?? null;

  // --- summary -------------------------------------------------------------
  const firstSuggestionDesc =
    suggestions.length > 0 ? suggestions[0].description : "Performance dentro do esperado.";

  const summary = `Banca com ${money.format(metrics.totalBalance)} em ${state.bets.length} apostas registradas. ROI: ${percent.format(metrics.roi)}, yield: ${percent.format(metrics.yield)}, taxa de acerto: ${percent.format(metrics.hitRate)}. ${firstSuggestionDesc}`;

  // --- topInsight ----------------------------------------------------------
  const highSuggestion = suggestions.find((s) => s.priority === "high");
  const criticalWarning = riskWarnings.find((w) => w.severity === "critical");

  let topInsight: string;
  if (highSuggestion) {
    topInsight = `${highSuggestion.title}: ${highSuggestion.description}`;
  } else if (criticalWarning) {
    topInsight = `${criticalWarning.title}: ${criticalWarning.detail}`;
  } else {
    topInsight = "Banca saudável. Continue monitorando as métricas e mantendo disciplina de stake.";
  }

  return {
    summary,
    topInsight,
    suggestions,
    riskWarnings,
    bestStrategy,
    worstStrategy,
    generatedAt: new Date().toISOString(),
    source: "local",
  };
}

// ---------------------------------------------------------------------------
// Prompt builder
// ---------------------------------------------------------------------------

export function buildPortfolioPrompt(state: AppState): string {
  const metrics = calculateMetrics(state);
  const strategies = groupProfitByStrategy(state);
  const byBook = groupProfitByBookmaker(state);

  const top3Strategies = [...strategies]
    .sort((a, b) => b.roi - a.roi)
    .slice(0, 3)
    .map(
      (s) =>
        `  - ${s.name}: ROI ${percent.format(s.roi)}, ${s.bets} apostas, lucro ${money.format(s.profit)}`
    )
    .join("\n");

  const last10Settled = state.bets
    .filter((b) => b.status !== "pending")
    .sort((a, b) => new Date(b.placedAt).getTime() - new Date(a.placedAt).getTime())
    .slice(0, 10)
    .map(
      (b) =>
        `  - ${b.placedAt.slice(0, 10)} | ${b.eventName} | stake: ${money.format(b.stake)} | odds: ${b.odds.toFixed(2)} | resultado: ${b.status}`
    )
    .join("\n");

  const bookmakerLines = byBook
    .map((bk) => `  - ${bk.name}: lucro ${money.format(bk.profit)}, ${bk.bets} apostas`)
    .join("\n");

  const clvLine =
    metrics.clvAverage !== 0
      ? `CLV médio: ${percent.format(metrics.clvAverage)}`
      : "CLV médio: sem dados suficientes";

  return `Você é um analista especialista em apostas esportivas. Analise este portfólio e responda em português.

## Métricas Gerais
- Banca total: ${money.format(metrics.totalBalance)}
- Exposição aberta: ${money.format(metrics.openExposure)}
- Lucro/Prejuízo: ${money.format(metrics.profit)}
- ROI (lucro / banca): ${percent.format(metrics.roi)}
- Yield (lucro / turnover liquidado): ${percent.format(metrics.yield)}
- Taxa de acerto: ${percent.format(metrics.hitRate)}
- ${clvLine}
- Apostas liquidadas: ${metrics.settledCount}
- Apostas pendentes: ${metrics.pendingCount}

## Top 3 Estratégias (por ROI)
${top3Strategies || "  Nenhuma estratégia cadastrada."}

## Últimas 10 Apostas Liquidadas
${last10Settled || "  Nenhuma aposta liquidada."}

## Casas de Apostas
${bookmakerLines || "  Nenhuma casa cadastrada."}

## Solicitação
Analise este portfólio de apostas esportivas. Forneça em português:
1) Resumo executivo (2 frases)
2) Top 3 insights acionáveis
3) Alertas de risco
4) Qual estratégia priorizar e qual revisar.`;
}

// ---------------------------------------------------------------------------
// API call
// ---------------------------------------------------------------------------

async function callAIEndpoint(state: AppState): Promise<AIAnalysis> {
  const endpoint = import.meta.env.VITE_AI_ENDPOINT as string;
  const prompt = buildPortfolioPrompt(state);

  // Não enviamos bearer token daqui: qualquer VITE_* é embarcado no bundle e
  // ficaria público para todos os visitantes. Se o endpoint exigir autenticação,
  // ela deve ficar server-side numa Cloud Function (secret via defineSecret),
  // como já é feito para OCR/odds. O endpoint aqui deve ser público ou protegido
  // por App Check/origem, nunca por um segredo de servidor lido do cliente.
  const headers: Record<string, string> = { "Content-Type": "application/json" };

  const response = await fetch(endpoint, {
    method: "POST",
    headers,
    body: JSON.stringify({ prompt, model: "claude-sonnet-4-6", max_tokens: 1000 }),
    signal: AbortSignal.timeout(15000),
  });

  if (!response.ok) {
    throw new Error(`AI endpoint returned ${response.status}`);
  }

  const data = (await response.json()) as { content?: string; text?: string; output?: string };
  const text = data.content ?? data.text ?? data.output ?? "";

  return parseAIResponse(text, state);
}

// ---------------------------------------------------------------------------
// Response parser
// ---------------------------------------------------------------------------

function parseAIResponse(text: string, state: AppState): AIAnalysis {
  try {
    if (!text || text.trim().length === 0) {
      throw new Error("Empty response");
    }

    // Split by numbered sections: "1)", "2)", "3)", "4)"
    const sectionRegex = /(?=\d+\))/;
    const rawSections = text.split(sectionRegex).filter(Boolean);

    const getSection = (n: number): string => {
      const section = rawSections.find((s) => s.trimStart().startsWith(`${n})`));
      return section ? section.replace(/^\d+\)\s*/, "").trim() : "";
    };

    const summaryRaw = getSection(1);
    const insightsRaw = getSection(2);
    const alertsRaw = getSection(3);

    // Summary: first two sentences or whole section 1
    const sentenceMatch = summaryRaw.match(/[^.!?]+[.!?]+/g);
    const summary = sentenceMatch
      ? sentenceMatch.slice(0, 2).join(" ").trim()
      : summaryRaw.slice(0, 300);

    // Extract bullet points from section 2 as suggestions
    const bulletRegex = /[-•*]\s+(.+)/g;
    const insightMatches = [...insightsRaw.matchAll(bulletRegex)].slice(0, 3);

    const suggestions: AISuggestion[] = insightMatches
      .filter((m) => m[1] !== undefined)
      .map((m) => ({
        type: "focus" as const,
        title: (m[1] as string).slice(0, 60),
        description: m[1] as string,
        priority: "medium" as const,
      }));

    // Extract warnings from section 3
    const alertMatches = [...alertsRaw.matchAll(bulletRegex)].slice(0, 3);
    const riskWarnings: AIWarning[] = alertMatches
      .filter((m) => m[1] !== undefined)
      .map((m) => ({
        severity: "warning" as const,
        title: (m[1] as string).slice(0, 60),
        detail: m[1] as string,
      }));

    // Section 4: strategy recommendation
    const stratRaw = getSection(4);
    const priorMatch = stratRaw.match(/priorizar[:\s]+([^\n.]+)/i);
    const revisarMatch = stratRaw.match(/revisar[:\s]+([^\n.]+)/i);
    const bestStrategy = priorMatch ? priorMatch[1].trim() : null;
    const worstStrategy = revisarMatch ? revisarMatch[1].trim() : null;

    const topInsight =
      suggestions[0]?.description ??
      riskWarnings[0]?.detail ??
      "Consulte o resumo para os principais pontos de atenção.";

    return {
      summary: summary || text.slice(0, 300),
      topInsight,
      suggestions,
      riskWarnings,
      bestStrategy,
      worstStrategy,
      generatedAt: new Date().toISOString(),
      source: "api",
    };
  } catch {
    // Fallback to local analysis if parsing fails
    const local = analyzePortfolioLocally(state);
    return { ...local, source: "api" };
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function currentLossStreak(bets: AppState["bets"]): number {
  const settled = bets
    .filter((b) => b.status !== "pending")
    .sort((a, b) => new Date(b.placedAt).getTime() - new Date(a.placedAt).getTime());
  let streak = 0;
  for (const bet of settled) {
    if (isLossResult(bet)) streak++;
    else break;
  }
  return streak;
}

// Exported for testing convenience
export { currentLossStreak };
