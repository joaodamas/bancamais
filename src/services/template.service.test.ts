import { describe, it, expect } from "vitest";
import { buildBetTemplate, addBetTemplate, removeBetTemplate, canBuildTemplate } from "./template.service";
import { emptyState } from "../lib/storage";
import type { NewBetFormValues } from "../lib/types";

function values(overrides: Partial<NewBetFormValues> = {}): NewBetFormValues {
  return {
    eventName: "Real x City",
    eventAt: "2026-06-18T20:00",
    sport: "Futebol",
    league: "Premier League",
    market: "Over/Under",
    selection: "Over 1.5",
    bookmakerId: "b1",
    strategyId: "s1",
    stake: "50",
    odds: "1.85",
    closingOdds: "",
    mode: "prelive",
    tags: "value, ev",
    ...overrides,
  };
}

describe("buildBetTemplate", () => {
  it("captura só os campos fixos (sem evento/data/odd)", () => {
    const t = buildBetTemplate("Over 1.5 PL", values());
    expect(t.name).toBe("Over 1.5 PL");
    expect(t.partial).toEqual({
      sport: "Futebol",
      league: "Premier League",
      market: "Over/Under",
      selection: "Over 1.5",
      bookmakerId: "b1",
      strategyId: "s1",
      stake: "50",
      mode: "prelive",
      tags: "value, ev",
    });
    expect(t.partial).not.toHaveProperty("eventName");
    expect(t.partial).not.toHaveProperty("odds");
    expect(t.id).toMatch(/^tpl-/);
  });

  it("omite campos vazios", () => {
    const t = buildBetTemplate("Simples", values({ league: "", strategyId: "", tags: "" }));
    expect(t.partial).not.toHaveProperty("league");
    expect(t.partial).not.toHaveProperty("strategyId");
    expect(t.partial).not.toHaveProperty("tags");
  });

  it("usa nome padrão quando vazio", () => {
    expect(buildBetTemplate("  ", values()).name).toBe("Template");
  });
});

describe("canBuildTemplate", () => {
  it("true com esporte, mercado ou casa", () => {
    expect(canBuildTemplate(values())).toBe(true);
    expect(canBuildTemplate(values({ sport: "", market: "", bookmakerId: "b1" }))).toBe(true);
  });
  it("false sem nenhum campo relevante", () => {
    expect(canBuildTemplate(values({ sport: "", market: "", bookmakerId: "" }))).toBe(false);
  });
});

describe("addBetTemplate / removeBetTemplate", () => {
  it("adiciona e remove preservando o resto do estado", () => {
    const t = buildBetTemplate("X", values());
    const added = addBetTemplate(emptyState(), t);
    expect(added.betTemplates).toHaveLength(1);
    const removed = removeBetTemplate(added, t.id);
    expect(removed.betTemplates).toHaveLength(0);
  });
});
