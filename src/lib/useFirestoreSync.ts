import { useEffect, useRef, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import type { User } from "firebase/auth";
import { db } from "./firebase";
import { normalizeState } from "./storage";
import type { AppState } from "./types";

export type SyncStatus = "idle" | "syncing" | "synced" | "error" | "offline";

export interface FirestoreSyncResult {
  status: SyncStatus;
  lastSyncAt: Date | null;
  error: string | null;
}

/** Observa mudanças no Firestore e chama onRemoteUpdate quando o snapshot mudar externamente */
export function useFirestoreSync(
  user: User | null,
  localState: AppState,
  onRemoteUpdate: (state: AppState) => void
): FirestoreSyncResult {
  const [status, setStatus] = useState<SyncStatus>("idle");
  const [lastSyncAt, setLastSyncAt] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);
  const isFirstLoad = useRef(true);

  useEffect(() => {
    if (!user || user.isAnonymous) {
      setStatus("offline");
      return;
    }

    setStatus("syncing");
    isFirstLoad.current = true;

    const docRef = doc(db, "users", user.uid, "appStates", "default");

    const unsubscribe = onSnapshot(
      docRef,
      (snapshot) => {
        if (!snapshot.exists()) {
          setStatus("synced");
          isFirstLoad.current = false;
          return;
        }

        const data = snapshot.data();

        // Na primeira carga, oferece ao App.tsx para carregar do Firestore
        if (isFirstLoad.current) {
          isFirstLoad.current = false;
          const remoteState = normalizeState({
            bankrollName: data["bankrollName"],
            currency: data["currency"],
            startingBalance: data["startingBalance"],
            riskSettings: data["riskSettings"],
            bookmakers: data["bookmakers"],
            strategies: data["strategies"],
            bets: data["bets"],
            transactions: data["transactions"],
          });
          onRemoteUpdate(remoteState);
          setStatus("synced");
          setLastSyncAt(new Date());
          return;
        }

        // Mudança vinda de outro dispositivo — atualiza
        if (snapshot.metadata.hasPendingWrites) return; // ignorar writes locais

        const remoteState = normalizeState({
          bankrollName: data["bankrollName"],
          currency: data["currency"],
          startingBalance: data["startingBalance"],
          riskSettings: data["riskSettings"],
          bookmakers: data["bookmakers"],
          strategies: data["strategies"],
          bets: data["bets"],
          transactions: data["transactions"],
        });

        onRemoteUpdate(remoteState);
        setStatus("synced");
        setLastSyncAt(new Date());
      },
      (err) => {
        console.error("Firestore sync error:", err);
        setStatus("error");
        setError(err.message);
      }
    );

    return () => {
      unsubscribe();
      isFirstLoad.current = true;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.uid]);

  return { status, lastSyncAt, error };
}
