import { z } from "zod";

// ── Enums ─────────────────────────────────────────────────────────────────────

export const BetStatusSchema = z.enum(["pending", "won", "lost", "cashout", "void", "half_won", "half_lost"]);
export const BetModeSchema = z.enum(["prelive", "live"]);
export const BetSourceSchema = z.enum(["manual", "ocr", "ai_suggestion"]).optional();
export const TransactionTypeSchema = z.enum([
  "deposit", "withdrawal", "transfer", "adjustment",
  "bet_stake", "bet_payout", "bet_refund", "void_entry",
]);

// ── Bet ───────────────────────────────────────────────────────────────────────

export const BetSchema = z.object({
  id: z.string().min(1),
  placedAt: z.string().datetime({ offset: true }).or(z.string().min(1)),
  eventAt: z.string().min(1),
  sport: z.string().min(1),
  league: z.string().min(1),
  eventName: z.string().min(1),
  market: z.string().min(1),
  selection: z.string().min(1),
  bookmakerId: z.string().min(1),
  source: BetSourceSchema,
  suggestionId: z.string().optional(),
  fixtureId: z.union([z.number(), z.string()]).optional(),
  strategyId: z.string().optional(),
  tags: z.array(z.string()).default([]),
  stake: z.number().positive("Stake deve ser positiva"),
  odds: z.number().min(1.01, "Odd mínima é 1.01"),
  status: BetStatusSchema,
  payout: z.number().nonnegative().optional(),
  closingOdds: z.number().min(1.01).optional(),
  settlementSource: z.enum(["manual", "api"]).optional(),
  estimatedProbability: z.number().min(0).max(1).optional(),
  estimatedEdge: z.number().optional(),
  confidenceScore: z.number().min(0).max(1).optional(),
  mode: BetModeSchema,
  slipImageUrl: z.string().optional(),
  slipImagePath: z.string().optional(),
  ocrMetadata: z.unknown().optional(),
});

// ── Quick Bet Form ─────────────────────────────────────────────────────────────

export const QuickBetFormSchema = z.object({
  eventName: z.string().min(1, "Nome do evento é obrigatório"),
  eventAt: z.string().min(1, "Data do evento é obrigatória"),
  bookmakerId: z.string().min(1, "Selecione uma casa de apostas"),
  stake: z.coerce.number().min(1, "Stake mínima é R$1"),
  odds: z.coerce.number().min(1.01, "Odd mínima é 1.01"),
});

// ── Full Bet Form ──────────────────────────────────────────────────────────────

export const FullBetFormSchema = z.object({
  eventName: z.string().min(1, "Nome do evento é obrigatório"),
  eventAt: z.string().min(1, "Data do evento é obrigatória"),
  sport: z.string().min(1, "Esporte é obrigatório"),
  league: z.string().min(1, "Liga é obrigatória"),
  market: z.string().min(1, "Mercado é obrigatório"),
  selection: z.string().min(1, "Seleção é obrigatória"),
  bookmakerId: z.string().min(1, "Selecione uma casa de apostas"),
  stake: z.coerce.number().min(1, "Stake mínima é R$1"),
  odds: z.coerce.number().min(1.01, "Odd mínima é 1.01"),
  closingOdds: z.coerce.number().min(1.01).optional().or(z.literal("")),
  mode: BetModeSchema,
});

// ── Settlement ────────────────────────────────────────────────────────────────

export const SettlementSchema = z.object({
  betId: z.string().min(1),
  status: z.enum(["won", "lost", "cashout", "void", "half_won", "half_lost"]),
  cashoutAmount: z.number().positive().optional(),
}).refine(
  (data) => data.status !== "cashout" || (data.cashoutAmount !== undefined && data.cashoutAmount > 0),
  { message: "Informe o valor do cashout", path: ["cashoutAmount"] },
);

// ── Risk Settings ─────────────────────────────────────────────────────────────

export const RiskSettingsSchema = z.object({
  unitPercent: z.number().min(0.1).max(100),
  maxStakeUnits: z.number().min(0.5).max(100),
  maxOpenExposurePercent: z.number().min(1).max(100),
  lossStreakLimit: z.number().int().min(1).max(20),
  hardStopEnabled: z.boolean(),
  dailyLossLimitPercent: z.number().min(1).max(100),
  weeklyLossLimitPercent: z.number().min(1).max(100),
  monthlyDrawdownPercent: z.number().min(1).max(100),
  pausedUntil: z.string().optional(),
});

// ── Transaction ───────────────────────────────────────────────────────────────

export const TransactionSchema = z.object({
  id: z.string().min(1),
  date: z.string().min(1),
  type: TransactionTypeSchema,
  bookmakerId: z.string().min(1),
  targetBookmakerId: z.string().optional(),
  description: z.string(),
  amount: z.number(),
  referenceType: z.enum(["bet", "bookmaker", "manual"]).optional(),
  referenceId: z.string().optional(),
  voidedById: z.string().optional(),
  voidsCancelledId: z.string().optional(),
});

// ── Bookmaker ─────────────────────────────────────────────────────────────────

export const BookmakerSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  balance: z.number().nonnegative(),
  status: z.enum(["synced", "manual", "reconnect"]),
  lastSyncLabel: z.string(),
});

// ── Strategy ──────────────────────────────────────────────────────────────────

export const StrategySchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string(),
  status: z.enum(["active", "paused"]),
});

// ── AppState (para validação de dados do Firestore) ───────────────────────────

export const AppStateSchema = z.object({
  bankrollName: z.string().min(1).default("Minha Banca"),
  currency: z.literal("BRL"),
  startingBalance: z.number().nonnegative().default(0),
  lastModifiedAt: z.string().nullable().optional(),
  riskSettings: RiskSettingsSchema,
  bookmakers: z.array(BookmakerSchema).default([]),
  strategies: z.array(StrategySchema).default([]),
  bets: z.array(BetSchema).default([]),
  transactions: z.array(TransactionSchema).default([]),
});

// ── Helpers ───────────────────────────────────────────────────────────────────

export type BetFormData = z.infer<typeof FullBetFormSchema>;
export type QuickBetFormData = z.infer<typeof QuickBetFormSchema>;
export type ValidatedAppState = z.infer<typeof AppStateSchema>;

/** Valida e normaliza estado vindo do Firestore — retorna null se inválido */
export function validateAppState(raw: unknown): ValidatedAppState | null {
  const result = AppStateSchema.safeParse(raw);
  if (result.success) return result.data;
  console.warn("[schemas] AppState inválido do Firestore:", result.error.flatten());
  return null;
}

/** Valida formulário de nova aposta completo */
export function validateFullBetForm(data: Record<string, unknown>) {
  return FullBetFormSchema.safeParse(data);
}

/** Valida formulário de entrada rápida */
export function validateQuickBetForm(data: Record<string, unknown>) {
  return QuickBetFormSchema.safeParse(data);
}
