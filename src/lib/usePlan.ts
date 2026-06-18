import type { PlanTier } from "./plan";

/**
 * Fonte do plano do usuário. ESQUELETO: hoje retorna "free" (ou "pro" via
 * VITE_DEFAULT_PLAN para testar o estado liberado localmente).
 * Em produção, trocar por custom claims do Firebase Auth ou doc de billing
 * protegido por firestore.rules — NUNCA do AppState (que é editável pelo cliente).
 */
export function usePlan(): PlanTier {
  const override = (import.meta.env.VITE_DEFAULT_PLAN as string | undefined)?.toLowerCase();
  return override === "pro" ? "pro" : "free";
}
