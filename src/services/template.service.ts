/**
 * Templates de aposta — lógica pura para criar/aplicar/remover atalhos de
 * preenchimento rápido (o "feijão com arroz" do apostador).
 */
import type { AppState, BetTemplate, BetTemplateFields, NewBetFormValues } from "../lib/types";

/** Campos que compõem um template (o que se repete entre apostas). */
function extractTemplateFields(values: NewBetFormValues): Partial<BetTemplateFields> {
  const partial: Partial<BetTemplateFields> = {};
  if (values.sport) partial.sport = values.sport;
  if (values.league) partial.league = values.league;
  if (values.market) partial.market = values.market;
  if (values.selection) partial.selection = values.selection;
  if (values.bookmakerId) partial.bookmakerId = values.bookmakerId;
  if (values.strategyId) partial.strategyId = values.strategyId;
  if (values.stake) partial.stake = values.stake;
  if (values.mode) partial.mode = values.mode;
  if (values.tags) partial.tags = values.tags;
  return partial;
}

/** Há algo digno de virar template? (pelo menos esporte, mercado ou casa) */
export function canBuildTemplate(values: NewBetFormValues): boolean {
  return Boolean(values.sport || values.market || values.bookmakerId);
}

export function buildBetTemplate(name: string, values: NewBetFormValues): BetTemplate {
  return {
    id: `tpl-${crypto.randomUUID()}`,
    name: name.trim() || "Template",
    partial: extractTemplateFields(values),
    createdAt: new Date().toISOString(),
  };
}

export function addBetTemplate(state: AppState, template: BetTemplate): AppState {
  return { ...state, betTemplates: [...(state.betTemplates ?? []), template] };
}

export function removeBetTemplate(state: AppState, id: string): AppState {
  return { ...state, betTemplates: (state.betTemplates ?? []).filter((t) => t.id !== id) };
}
