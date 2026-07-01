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
  const localMarkRef = useRef<string>("");
  // Ordena os snapshots pelo relógio do SERVIDOR (updatedAt), imune à diferença
  // de relógio entre celular e PC — a causa do "não reflete nos dois sentidos".
  const lastAppliedServerTsRef = useRef(0);

  useEffect(() => {
    const time = localState.lastModifiedAt ? new Date(localState.lastModifiedAt).getTime() : 0;
    localTimestampRef.current = Number.isFinite(time) ? time : 0;
    localMarkRef.current = localState.lastModifiedAt ?? "";
  }, [localState]);

  useEffect(() => {
    if (!user || user.isAnonymous) {
      setStatus("offline");
      return;
    }

    setStatus("syncing");
    isFirstSnapshot.current = true;
    lastAppliedServerTsRef.current = 0;

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

        const remoteMark = remoteState.lastModifiedAt ?? "";
        const updatedAtField = data["updatedAt"];
        const serverTs = updatedAtField && typeof updatedAtField.toMillis === "function"
          ? updatedAtField.toMillis()
          : 0;

        // Eco da nossa própria escrita (mesma marca de edição do cliente) →
        // nunca reaplica, evita loop de re-save.
        if (remoteMark && remoteMark === localMarkRef.current) {
          isFirstSnapshot.current = false;
          lastAppliedServerTsRef.current = Math.max(lastAppliedServerTsRef.current, serverTs);
          setStatus("synced");
          setLastSyncAt(new Date());
          return;
        }

        if (isFirstSnapshot.current) {
          // Cold start: reconcilia por marca de tempo do cliente (preserva edição
          // offline deste aparelho). O tempo real abaixo cobre o resto.
          isFirstSnapshot.current = false;
          const remoteTs = remoteMark ? new Date(remoteMark).getTime() : 0;
          const safeRemoteTs = Number.isFinite(remoteTs) ? remoteTs : 0;
          if (safeRemoteTs === 0 || safeRemoteTs <= localTimestampRef.current) {
            lastAppliedServerTsRef.current = Math.max(lastAppliedServerTsRef.current, serverTs);
            setStatus("synced");
            setLastSyncAt(new Date());
            return;
          }
          onRemoteUpdate(remoteState);
          lastAppliedServerTsRef.current = serverTs;
          setStatus("synced");
          setLastSyncAt(new Date());
          return;
        }

        // Mudança em tempo real de OUTRO dispositivo: ordena pelo relógio do
        // servidor (updatedAt), não pelo do cliente — assim a diferença de
        // relógio entre celular e PC não bloqueia mais a atualização.
        if (serverTs !== 0 && serverTs <= lastAppliedServerTsRef.current) {
          setStatus("synced");
          return;
        }
        onRemoteUpdate(remoteState);
        lastAppliedServerTsRef.current = serverTs;
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
