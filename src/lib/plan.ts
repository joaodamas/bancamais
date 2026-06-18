/**
 * Esqueleto de monetização — tipos de plano e features.
 * IMPORTANTE: o plano do usuário NÃO vive no AppState (que é editável pelo
 * cliente — viraria bypass de paywall). Em produção virá de custom claims do
 * Firebase Auth ou de um doc de billing protegido por firestore.rules.
 * Hoje tudo é observe-only: PAYWALL_ENABLED = false → nada é bloqueado.
 */
export type PlanTier = "free" | "pro";

export type GatedFeature = "pro_analysis" | "pro_reports" | "unlimited_bets" | "ai_polish";

/** A chave mestra. Vire true (e troque a fonte do plano p/ o backend) para ligar o paywall. */
export const PAYWALL_ENABLED = false;

const PLAN_FEATURES: Record<PlanTier, GatedFeature[]> = {
  free: [],
  pro: ["pro_analysis", "pro_reports", "unlimited_bets", "ai_polish"],
};

/** Limites do plano free (para gates de uso). Hoje só referência — não aplicados. */
export const FREE_LIMITS = {
  bets: 50,
  reportSnapshots: 1,
};

export function planHasFeature(plan: PlanTier, feature: GatedFeature): boolean {
  return PLAN_FEATURES[plan].includes(feature);
}
