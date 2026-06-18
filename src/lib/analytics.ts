/**
 * Funil de Analytics — wrapper fino sobre Firebase Analytics.
 * Só dispara se o Analytics foi inicializado (consentimento de cookie dado);
 * caso contrário é no-op silencioso — respeita LGPD sem espalhar checagens.
 */
import { logEvent, type Analytics } from "firebase/analytics";

let analyticsInstance: Analytics | null = null;

/** Chamado por initAnalytics() após o consentimento. */
export function setAnalyticsInstance(instance: Analytics | null) {
  analyticsInstance = instance;
}

export type FunnelEvent =
  // Aquisição
  | "demo_start"
  | "signup_success"
  | "login_success"
  | "onboarding_complete"
  // Retenção / captura
  | "first_bet_recorded"
  | "bet_recorded"
  | "ocr_used"
  | "template_saved"
  // Conversão (blindagem demo → conta)
  | "demo_migration_offered"
  | "demo_data_imported"
  | "demo_migration_declined"
  // Engajamento profundo
  | "report_snapshot_saved"
  | "tour_completed";

export function track(event: FunnelEvent, params?: Record<string, string | number | boolean>) {
  if (!analyticsInstance) return;
  try {
    logEvent(analyticsInstance, event, params);
  } catch {
    /* analytics nunca deve quebrar o app */
  }
}
