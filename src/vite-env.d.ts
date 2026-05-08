/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_FIREBASE_API_KEY: string;
  readonly VITE_FIREBASE_AUTH_DOMAIN: string;
  readonly VITE_FIREBASE_PROJECT_ID: string;
  readonly VITE_FIREBASE_STORAGE_BUCKET: string;
  readonly VITE_FIREBASE_MESSAGING_SENDER_ID: string;
  readonly VITE_FIREBASE_APP_ID: string;
  readonly VITE_FIREBASE_MEASUREMENT_ID?: string;
  readonly VITE_FIREBASE_APP_CHECK_PROVIDER?: "recaptcha-v3" | "enterprise";
  readonly VITE_FIREBASE_APP_CHECK_SITE_KEY?: string;
  readonly VITE_FIREBASE_APP_CHECK_DEBUG_TOKEN?: string;
  readonly VITE_FIREBASE_APP_CHECK_AUTO_REFRESH?: "true" | "false";
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
