import type { AppState } from "./types";

export const initialState: AppState = {
  bankrollName: "Minha Banca",
  currency: "BRL",
  startingBalance: 0,
  riskSettings: {
    unitPercent: 1,
    maxStakeUnits: 2,
    maxOpenExposurePercent: 10,
    lossStreakLimit: 3,
  },
  bookmakers: [],
  strategies: [],
  bets: [],
  transactions: [],
};
