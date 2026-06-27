import { useMemo } from "react";
import type { User } from "firebase/auth";
import type { GatedFeature, PlanTier } from "./plan";
import { getLimits, isFeatureLocked, isMasterAccount } from "./plan";

const DEV_OVERRIDE_KEY = "bancamais_dev_plan";

/**
 * Resolve o plano atual do usuário.
 *
 * Fundação (sem billing ainda):
 * - Modo demonstração libera tudo (vitrine = Edge).
 * - Conta real cai no plano Free.
 * - Override de dev via localStorage `bancamais_dev_plan` = "free" | "edge".
 *
 * Quando o billing entrar, a fonte de verdade passa a ser o entitlement gravado
 * pelo backend (webhook do Mercado Pago), protegido por firestore.rules — só esta
 * função muda. NUNCA derivar o plano do AppState (editável pelo cliente).
 */
export function usePlan(user: User | null, demoMode: boolean) {
  return useMemo(() => {
    let plan: PlanTier = "free";
    if (demoMode) plan = "edge";
    if (isMasterAccount(user?.uid)) plan = "edge";

    const override = typeof localStorage !== "undefined" ? localStorage.getItem(DEV_OVERRIDE_KEY) : null;
    if (override === "free" || override === "edge") plan = override;

    return {
      plan,
      isEdge: plan === "edge",
      locked: (feature: GatedFeature) => isFeatureLocked(plan, feature),
      limits: getLimits(plan),
    };
  }, [user, demoMode]);
}
