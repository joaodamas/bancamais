import { initializeApp } from "firebase/app";
import { getAnalytics, isSupported } from "firebase/analytics";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY ?? "AIzaSyDF4frls3J71tLQxRvVUavKbHsVtLsHIIY",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN ?? "bancamais-12778.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID ?? "bancamais-12778",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET ?? "bancamais-12778.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID ?? "902164362191",
  appId: import.meta.env.VITE_FIREBASE_APP_ID ?? "1:902164362191:web:f475390da5e0a6be5b58ba",
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID ?? "G-0M6W10Y4L6",
};

export const firebaseApp = initializeApp(firebaseConfig);
export const auth = getAuth(firebaseApp);
export const db = getFirestore(firebaseApp);
export const storage = getStorage(firebaseApp);

export async function initAnalytics() {
  if (await isSupported()) {
    return getAnalytics(firebaseApp);
  }

  return null;
}
