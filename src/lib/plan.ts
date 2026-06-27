/**
 * Monetização — tipos de plano, features e limites.
 * IMPORTANTE: o plano do usuário NÃO vive no AppState (que é editável pelo
 * cliente — viraria bypass de paywall). Hoje a fonte é o `usePlan` (demo = edge,
 * conta real = free, override de dev). Quando o billing entrar, a fonte de verdade
 * passa a ser o entitlement gravado pelo backend (webhook do Mercado Pago),
 * protegido por firestore.rules — só o `usePlan` muda.
 */
export type PlanTier = "free" | "edge";

/** Recursos que exigem o plano Edge. Alinhados às telas/funcionalidades reais. */
export type GatedFeature = "intelligence" | "odds" | "clv" | "ocr" | "advanced_reports";

/** Master switch do paywall. false = nada é bloqueado (modo observe-only). */
export const PAYWALL_ENABLED = true;

const EDGE_FEATURES: GatedFeature[] = ["intelligence", "odds", "clv", "ocr", "advanced_reports"];

const PLAN_FEATURES: Record<PlanTier, GatedFeature[]> = {
  free: [],
  edge: EDGE_FEATURES,
};

export interface PlanLimits {
  maxBookmakers: number;
  maxBetsPerMonth: number;
  historyDays: number;
}

export const PLAN_LIMITS: Record<PlanTier, PlanLimits> = {
  free: { maxBookmakers: 2, maxBetsPerMonth: 50, historyDays: 90 },
  edge: { maxBookmakers: Infinity, maxBetsPerMonth: Infinity, historyDays: Infinity },
};

export function planHasFeature(plan: PlanTier, feature: GatedFeature): boolean {
  return PLAN_FEATURES[plan].includes(feature);
}

/** true quando o recurso está bloqueado para o plano atual (respeita o master switch). */
export function isFeatureLocked(plan: PlanTier, feature: GatedFeature): boolean {
  if (!PAYWALL_ENABLED) return false;
  return !planHasFeature(plan, feature);
}

export function getLimits(plan: PlanTier): PlanLimits {
  return PLAN_LIMITS[plan];
}

/** Copy de paywall por recurso. */
export const FEATURE_PAYWALL: Record<GatedFeature, { title: string; benefits: string[] }> = {
  intelligence: {
    title: "Inteligência por IA é do Edge",
    benefits: [
      "Análise automática do seu portfólio",
      "Detecção de tilt e padrões de risco",
      "Sugestões acionáveis pra corrigir o rumo",
    ],
  },
  odds: {
    title: "Odds ao vivo são do Edge",
    benefits: [
      "Compare o melhor preço entre casas",
      "Veja o edge vs. linha justa",
      "Registre a aposta direto da cotação",
    ],
  },
  clv: {
    title: "CLV & Edge é do Edge",
    benefits: [
      "Meça se você bate a linha de fechamento",
      "Acompanhe seu valor esperado no tempo",
      "Separe skill de sorte com dados",
    ],
  },
  ocr: {
    title: "Escanear bilhete é do Edge",
    benefits: [
      "Preencha a aposta a partir do print",
      "Sem digitar evento, stake e odd",
      "Registro em segundos",
    ],
  },
  advanced_reports: {
    title: "Relatórios avançados são do Edge",
    benefits: [
      "Export em PDF e CSV",
      "Base fiscal e DRE por mês",
      "Snapshots de relatório",
    ],
  },
};
