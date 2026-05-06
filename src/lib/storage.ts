import { initialState } from "./mockData";
import type { AppState, Bet } from "./types";

const key = "bancamais.demo.state";

export function loadState(): AppState {
  const raw = localStorage.getItem(key);
  if (!raw) return initialState;

  try {
    return JSON.parse(raw) as AppState;
  } catch {
    return initialState;
  }
}

export function saveState(state: AppState) {
  localStorage.setItem(key, JSON.stringify(state));
}

export function resetState() {
  saveState(initialState);
  return initialState;
}

export function createBetId() {
  return `bet-${crypto.randomUUID()}`;
}

export function createTransactionId() {
  return `tx-${crypto.randomUUID()}`;
}

export type NewBetInput = Omit<Bet, "id" | "placedAt" | "status" | "tags" | "mode"> & {
  tags: string;
  mode: Bet["mode"];
};
