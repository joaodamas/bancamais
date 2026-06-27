/**
 * Enforcement de plano no backend — fonte de verdade real do paywall.
 *
 * O gating do cliente (src/lib/plan.ts) é só UX: pode ser burlado. As callables
 * que custam dinheiro (OCR, IA, odds, closing line) PRECISAM validar o plano aqui
 * antes de chamar qualquer API externa paga.
 *
 * Fonte do plano: `entitlements/{uid}.plan` (gravado pelo webhook do Mercado Pago,
 * protegido por firestore.rules contra escrita do cliente) + allowlist master.
 *
 * IMPORTANTE: mantenha a allowlist master espelhada com src/lib/plan.ts.
 */
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { HttpsError } from "firebase-functions/v2/https";
import { logger } from "firebase-functions";

export type Plan = "free" | "edge";

const MASTER_UIDS: ReadonlySet<string> = new Set<string>([
  "W7Cln1scw6YH6EebJeeQRr0qUCw1", // zfluush@gmail.com
]);

const MASTER_EMAILS: ReadonlySet<string> = new Set<string>([
  "joaodamasit@gmail.com", // conta principal (dono do produto)
]);

async function isMasterAccount(uid: string): Promise<boolean> {
  if (MASTER_UIDS.has(uid)) return true;
  if (MASTER_EMAILS.size === 0) return false;
  try {
    const user = await getAuth().getUser(uid);
    const email = user.email?.trim().toLowerCase();
    return !!email && MASTER_EMAILS.has(email);
  } catch (error) {
    logger.warn("Failed to resolve user for master check", { uid, error });
    return false;
  }
}

/** Resolve o plano efetivo do usuário: master → edge; senão o entitlement gravado. */
export async function resolvePlan(uid: string): Promise<Plan> {
  if (await isMasterAccount(uid)) return "edge";
  try {
    const snap = await getFirestore().doc(`entitlements/${uid}`).get();
    return snap.exists && snap.get("plan") === "edge" ? "edge" : "free";
  } catch (error) {
    logger.warn("Failed to read entitlement; defaulting to free", { uid, error });
    return "free";
  }
}

/**
 * Garante que o usuário tem plano Edge. Lança permission-denied caso contrário.
 * Chamar ANTES de qualquer fetch externo que gere custo.
 */
export async function ensureEdge(uid: string): Promise<void> {
  const plan = await resolvePlan(uid);
  if (plan !== "edge") {
    throw new HttpsError(
      "permission-denied",
      "Este recurso é exclusivo do plano Edge.",
    );
  }
}
