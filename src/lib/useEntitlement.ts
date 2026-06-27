import { useEffect, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import type { User } from "firebase/auth";
import { db } from "./firebase";
import type { PlanTier } from "./plan";

/**
 * Lê o entitlement do usuário (fonte de verdade do backend) em tempo real.
 * Doc: `entitlements/{uid}` — gravado só pelo backend (webhook do Mercado Pago).
 * Retorna o plano ou null quando não há entitlement (cai pro Free).
 */
export function useEntitlement(user: User | null): PlanTier | null {
  const [plan, setPlan] = useState<PlanTier | null>(null);

  useEffect(() => {
    if (!user || user.isAnonymous) {
      setPlan(null);
      return;
    }
    const ref = doc(db, "entitlements", user.uid);
    const unsubscribe = onSnapshot(
      ref,
      (snap) => {
        const value = snap.exists() ? (snap.data().plan as string | undefined) : undefined;
        setPlan(value === "edge" || value === "free" ? value : null);
      },
      () => setPlan(null),
    );
    return unsubscribe;
  }, [user]);

  return plan;
}
