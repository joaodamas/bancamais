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
  const isFirstSnapshot = useRef(true);
  const localTimestampRef = useRef(0);
  const lastAppliedRemoteTimestampRef = useRef(0);

  useEffect(() => {
    const time = localState.lastModifiedAt ? new Date(localState.lastModifiedAt).getTime() : 0;
    localTimestampRef.current = Number.isFinite(time) ? time : 0;
  }, [localState]);

  useEffect(() => {
    if (!user || user.isAnonymous) {
      setStatus("offline");
      return;
    }

    setStatus("syncing");
    isFirstSnapshot.current = true;
    lastAppliedRemoteTimestampRef.current = 0;

    const docRef = doc(db, "users", user.uid, "appStates", "default");

    const unsubscribe = onSnapshot(
      docRef,
      (snapshot) => {
        if (!snapshot.exists()) {
          setStatus("synced");
          isFirstSnapshot.current = false;
          return;
        }

        const data = snapshot.data();
        if (snapshot.metadata.hasPendingWrites) return; // ignorar writes locais

        const remoteState = normalizeState({
          bankrollName: data["bankrollName"],
          currency: data["currency"],
          lastModifiedAt: data["lastModifiedAt"],
          startingBalance: data["startingBalance"],
          riskSettings: data["riskSettings"],
          bookmakers: data["bookmakers"],
          strategies: data["strategies"],
          bets: data["bets"],
          transactions: data["transactions"],
        });

        const remoteTimestamp = remoteState.lastModifiedAt
          ? new Date(remoteState.lastModifiedAt).getTime()
          : 0;
        const safeRemoteTimestamp = Number.isFinite(remoteTimestamp) ? remoteTimestamp : 0;

        if (isFirstSnapshot.current) {
          isFirstSnapshot.current = false;
          lastAppliedRemoteTimestampRef.current = safeRemoteTimestamp;
          setStatus("synced");
          setLastSyncAt(new Date());
          return;
        }

        if (
          safeRemoteTimestamp === 0 ||
          safeRemoteTimestamp <= localTimestampRef.current ||
          safeRemoteTimestamp <= lastAppliedRemoteTimestampRef.current
        ) {
          setStatus("synced");
          setLastSyncAt(new Date());
          return;
        }

        onRemoteUpdate(remoteState);
        lastAppliedRemoteTimestampRef.current = safeRemoteTimestamp;
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
      isFirstSnapshot.current = true;
    };
  }, [user?.uid]);

  return { status, lastSyncAt, error };
}
