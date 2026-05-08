import { initializeApp } from "firebase/app";
import { getAnalytics, isSupported } from "firebase/analytics";
import {
  AppCheck,
  initializeAppCheck,
  ReCaptchaEnterpriseProvider,
  ReCaptchaV3Provider,
  setTokenAutoRefreshEnabled,
} from "firebase/app-check";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY as string,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN as string,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID as string,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET as string,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID as string,
  appId: import.meta.env.VITE_FIREBASE_APP_ID as string,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID as string | undefined,
};

export const firebaseApp = initializeApp(firebaseConfig);
export const auth = getAuth(firebaseApp);
export const db = getFirestore(firebaseApp);
export const storage = getStorage(firebaseApp);

type AppCheckProviderMode = "recaptcha-v3" | "enterprise";

const appCheckProviderMode = (
  import.meta.env.VITE_FIREBASE_APP_CHECK_PROVIDER ?? ""
).toLowerCase() as AppCheckProviderMode | "";
const appCheckSiteKey = import.meta.env.VITE_FIREBASE_APP_CHECK_SITE_KEY?.trim();
const appCheckDebugToken = import.meta.env.VITE_FIREBASE_APP_CHECK_DEBUG_TOKEN?.trim();
const appCheckAutoRefresh =
  import.meta.env.VITE_FIREBASE_APP_CHECK_AUTO_REFRESH !== "false";

let appCheckInstance: AppCheck | null = null;
let appCheckInitAttempted = false;

function canInitAppCheck() {
  return (
    typeof window !== "undefined" &&
    typeof document !== "undefined" &&
    Boolean(appCheckSiteKey) &&
    (appCheckProviderMode === "recaptcha-v3" ||
      appCheckProviderMode === "enterprise")
  );
}

function resolveAppCheckProvider() {
  if (!appCheckSiteKey) {
    return null;
  }

  if (appCheckProviderMode === "enterprise") {
    return new ReCaptchaEnterpriseProvider(appCheckSiteKey);
  }

  if (appCheckProviderMode === "recaptcha-v3") {
    return new ReCaptchaV3Provider(appCheckSiteKey);
  }

  console.warn(
    "[firebase] App Check provider invalido. Use VITE_FIREBASE_APP_CHECK_PROVIDER=recaptcha-v3 ou enterprise.",
  );
  return null;
}

export function isAppCheckConfigured() {
  return canInitAppCheck();
}

export function initAppCheck() {
  if (appCheckInitAttempted) {
    return appCheckInstance;
  }

  appCheckInitAttempted = true;

  if (!canInitAppCheck()) {
    return null;
  }

  if (appCheckDebugToken) {
    (self as typeof globalThis & { FIREBASE_APPCHECK_DEBUG_TOKEN?: boolean | string })
      .FIREBASE_APPCHECK_DEBUG_TOKEN =
      appCheckDebugToken === "true" ? true : appCheckDebugToken;
  }

  const provider = resolveAppCheckProvider();

  if (!provider) {
    return null;
  }

  try {
    appCheckInstance = initializeAppCheck(firebaseApp, {
      provider,
      isTokenAutoRefreshEnabled: appCheckAutoRefresh,
    });
    setTokenAutoRefreshEnabled(appCheckInstance, appCheckAutoRefresh);
    return appCheckInstance;
  } catch (error) {
    console.warn("[firebase] Nao foi possivel inicializar App Check.", error);
    appCheckInstance = null;
    return null;
  }
}

initAppCheck();

export async function initAnalytics() {
  if (await isSupported()) {
    return getAnalytics(firebaseApp);
  }

  return null;
}
