import {
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInAnonymously,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
  type User,
} from "firebase/auth";
import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { getFunctions, httpsCallable } from "firebase/functions";
import { auth, db, firebaseApp } from "./firebase";
import { normalizeState } from "./storage";
import type { AppState } from "./types";

const appStateDocumentId = "default";

export function watchAuth(callback: (user: User | null) => void) {
  return onAuthStateChanged(auth, callback);
}

export async function signInDemoUser() {
  const credential = await signInAnonymously(auth);
  return credential.user;
}

export async function createEmailUser(email: string, password: string, displayName: string) {
  const credential = await createUserWithEmailAndPassword(auth, email, password);
  if (displayName.trim()) {
    await updateProfile(credential.user, { displayName: displayName.trim() });
  }

  return credential.user;
}

export async function signInEmailUser(email: string, password: string) {
  const credential = await signInWithEmailAndPassword(auth, email, password);
  return credential.user;
}

export async function resetEmailPassword(email: string) {
  await sendPasswordResetEmail(auth, email);
}

export async function signInWithGoogle() {
  const provider = new GoogleAuthProvider();
  const credential = await signInWithPopup(auth, provider);
  return credential.user;
}

export async function signOutDemoUser() {
  await signOut(auth);
}

export async function saveCloudState(userId: string, state: AppState) {
  await setDoc(doc(db, "users", userId, "appStates", appStateDocumentId), {
    ...state,
    updatedAt: serverTimestamp(),
    schemaVersion: 1,
  });
}

export async function loadCloudState(userId: string): Promise<AppState | null> {
  const snapshot = await getDoc(doc(db, "users", userId, "appStates", appStateDocumentId));
  if (!snapshot.exists()) return null;

  const data = snapshot.data();
  return normalizeState({
    bankrollName: data.bankrollName,
    currency: data.currency,
    startingBalance: data.startingBalance,
    lastModifiedAt: data.lastModifiedAt ?? null,
    riskSettings: data.riskSettings,
    bookmakers: data.bookmakers,
    strategies: data.strategies,
    bets: data.bets,
    transactions: data.transactions,
    betTemplates: data.betTemplates,
    reportSnapshots: data.reportSnapshots,
  });
}

const functions = getFunctions(firebaseApp, "southamerica-east1");

export async function callExportUserData(): Promise<object> {
  const fn = httpsCallable<void, object>(functions, "exportUserData");
  const result = await fn();
  return result.data;
}

export async function callDeleteUserData(confirmText: string): Promise<void> {
  const fn = httpsCallable<{ confirmText: string }, { deleted: boolean }>(functions, "deleteUserData");
  await fn({ confirmText });
}
