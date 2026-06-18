import type { AppState } from "./types";

export const initialState: AppState = {
  bankrollName: "Minha Banca",
  currency: "BRL",
  startingBalance: 0,
  riskSettings: {
    unitMode: "percent",
    unitFixed: 0,
    unitPercent: 1,
    maxStakeUnits: 2,
    maxOpenExposurePercent: 10,
    lossStreakLimit: 3,
    hardStopEnabled: false,
    dailyLossLimitPercent: 10,
    weeklyLossLimitPercent: 20,
    monthlyDrawdownPercent: 30,
  },
  bookmakers: [],
  strategies: [],
  bets: [],
  transactions: [],
  betTemplates: [],
};
