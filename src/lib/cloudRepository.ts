import { onAuthStateChanged, signInAnonymously, signOut, type User } from "firebase/auth";
import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { auth, db } from "./firebase";
import type { AppState } from "./types";

const appStateDocumentId = "default";

export function watchAuth(callback: (user: User | null) => void) {
  return onAuthStateChanged(auth, callback);
}

export async function signInDemoUser() {
  const credential = await signInAnonymously(auth);
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
  return {
    bankrollName: data.bankrollName,
    currency: data.currency,
    startingBalance: data.startingBalance,
    bookmakers: data.bookmakers,
    strategies: data.strategies,
    bets: data.bets,
    transactions: data.transactions,
  } satisfies AppState;
}
