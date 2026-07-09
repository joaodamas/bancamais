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
  | "waitlist_joined"
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

/**
 * Camada de tracking de aquisição — Meta Pixel + GA4 + captura de UTM.
 * Env-gated: só carrega os scripts se os IDs existirem nas envs Vite.
 * Sem IDs, tudo é no-op silencioso (nada carrega, nada quebra).
 */
declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void;
    gtag?: (...args: unknown[]) => void;
    dataLayer?: unknown[];
  }
}

const META_PIXEL_ID = (import.meta.env.VITE_META_PIXEL_ID ?? "").trim();
const GA4_ID = (import.meta.env.VITE_GA4_ID ?? "").trim();

const PIXEL_STANDARD_EVENTS = new Set([
  "Lead",
  "InitiateCheckout",
  "Purchase",
  "CompleteRegistration",
  "ViewContent",
]);

const UTM_STORAGE_KEY = "bancamais.utm";
const UTM_KEYS = ["source", "medium", "campaign", "content", "term"] as const;
type UtmKey = (typeof UTM_KEYS)[number];
type StoredUtm = Partial<Record<UtmKey, string>>;

let initialized = false;

function hasWindow(): boolean {
  return typeof window !== "undefined";
}

function loadMetaPixel(id: string) {
  if (window.fbq) return;
  const fbq: Window["fbq"] & { queue?: unknown[]; loaded?: boolean } = (...args: unknown[]) => {
    (fbq.queue ??= []).push(args);
  };
  fbq.queue = [];
  fbq.loaded = true;
  window.fbq = fbq;

  const script = document.createElement("script");
  script.async = true;
  script.src = "https://connect.facebook.net/en_US/fbevents.js";
  document.head.appendChild(script);

  window.fbq("init", id);
  window.fbq("track", "PageView");
}

function loadGa4(id: string) {
  if (window.gtag) return;
  window.dataLayer = window.dataLayer ?? [];
  const gtag: Window["gtag"] = (...args: unknown[]) => {
    window.dataLayer?.push(args);
  };
  window.gtag = gtag;

  const script = document.createElement("script");
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(id)}`;
  document.head.appendChild(script);

  window.gtag("js", new Date());
  window.gtag("config", id);
}

export function initAnalytics(): void {
  if (initialized || !hasWindow()) return;
  if (!META_PIXEL_ID && !GA4_ID) return;
  initialized = true;
  if (META_PIXEL_ID) loadMetaPixel(META_PIXEL_ID);
  if (GA4_ID) loadGa4(GA4_ID);
}

export function trackPageView(path?: string): void {
  if (!hasWindow()) return;
  if (META_PIXEL_ID && window.fbq) window.fbq("track", "PageView");
  if (GA4_ID && window.gtag) {
    window.gtag("event", "page_view", path ? { page_path: path } : undefined);
  }
}

export function trackEvent(name: string, params?: Record<string, unknown>): void {
  if (!hasWindow()) return;
  if (META_PIXEL_ID && window.fbq) {
    const method = PIXEL_STANDARD_EVENTS.has(name) ? "track" : "trackCustom";
    window.fbq(method, name, params);
  }
  if (GA4_ID && window.gtag) window.gtag("event", name, params);
}

export function captureUtmParams(): void {
  if (!hasWindow()) return;
  const params = new URLSearchParams(window.location.search);
  const captured: StoredUtm = {};
  for (const key of UTM_KEYS) {
    const value = params.get(`utm_${key}`);
    if (value) captured[key] = value;
  }
  // Navegação interna sem UTM não sobrescreve a atribuição já salva.
  if (Object.keys(captured).length === 0) return;
  try {
    const payload = { ...captured, capturedAt: new Date().toISOString() };
    window.localStorage.setItem(UTM_STORAGE_KEY, JSON.stringify(payload));
  } catch {
    /* tracking nunca deve quebrar o app */
  }
}

export function getStoredUtm(): StoredUtm | null {
  if (!hasWindow()) return null;
  try {
    const raw = window.localStorage.getItem(UTM_STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return null;
    const record = parsed as Record<string, unknown>;
    const result: StoredUtm = {};
    for (const key of UTM_KEYS) {
      const value = record[key];
      if (typeof value === "string") result[key] = value;
    }
    return result;
  } catch {
    return null;
  }
}
