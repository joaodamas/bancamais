/**
 * Resolução da unidade de aposta.
 * A unidade é a base de quase todos os insights (stake em unidades, alertas
 * de over-staking, exposição). Pode ser um valor fixo em R$ ou uma % da banca.
 */
import type { RiskSettings } from "./types";

/** Valor da unidade em R$, resolvido a partir do modo configurado. */
export function resolveUnitValue(settings: RiskSettings, bankroll: number): number {
  if (settings.unitMode === "fixed") {
    return settings.unitFixed > 0 ? settings.unitFixed : 0;
  }
  const pct = settings.unitPercent / 100;
  return bankroll > 0 ? bankroll * pct : 0;
}

/** Quantas unidades representa um stake (0 se a unidade não está configurada). */
export function stakeInUnits(stake: number, unitValue: number): number {
  return unitValue > 0 ? stake / unitValue : 0;
}

/** Texto curto descrevendo a unidade para exibição. */
export function describeUnit(settings: RiskSettings, bankroll: number): string {
  const value = resolveUnitValue(settings, bankroll);
  if (value <= 0) return "Unidade não configurada";
  if (settings.unitMode === "fixed") {
    return `1u = R$ ${value.toFixed(2)} (fixo)`;
  }
  return `1u = R$ ${value.toFixed(2)} (${settings.unitPercent}% da banca)`;
}

/** Sinaliza se um stake excede o teto de unidades permitido. */
export function exceedsUnitCap(stake: number, settings: RiskSettings, bankroll: number): boolean {
  const unitValue = resolveUnitValue(settings, bankroll);
  if (unitValue <= 0) return false;
  return stake > unitValue * settings.maxStakeUnits;
}
