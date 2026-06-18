import { describe, it, expect } from "vitest";
import { resolveUnitValue, stakeInUnits, describeUnit, exceedsUnitCap } from "./unit";
import type { RiskSettings } from "./types";

function settings(overrides: Partial<RiskSettings> = {}): RiskSettings {
  return {
    unitMode: "percent",
    unitFixed: 0,
    unitPercent: 2,
    maxStakeUnits: 3,
    maxOpenExposurePercent: 10,
    lossStreakLimit: 3,
    hardStopEnabled: false,
    dailyLossLimitPercent: 10,
    weeklyLossLimitPercent: 20,
    monthlyDrawdownPercent: 30,
    ...overrides,
  };
}

describe("resolveUnitValue", () => {
  it("modo fixo retorna o valor configurado", () => {
    expect(resolveUnitValue(settings({ unitMode: "fixed", unitFixed: 50 }), 5000)).toBe(50);
  });

  it("modo percentual calcula a partir da banca", () => {
    expect(resolveUnitValue(settings({ unitMode: "percent", unitPercent: 2 }), 5000)).toBe(100);
  });

  it("retorna 0 quando fixo não configurado", () => {
    expect(resolveUnitValue(settings({ unitMode: "fixed", unitFixed: 0 }), 5000)).toBe(0);
  });

  it("retorna 0 quando banca é zero no modo percentual", () => {
    expect(resolveUnitValue(settings({ unitMode: "percent" }), 0)).toBe(0);
  });
});

describe("stakeInUnits", () => {
  it("converte stake em unidades", () => {
    expect(stakeInUnits(250, 50)).toBe(5);
  });
  it("retorna 0 quando unidade é 0", () => {
    expect(stakeInUnits(250, 0)).toBe(0);
  });
});

describe("describeUnit", () => {
  it("descreve unidade fixa", () => {
    expect(describeUnit(settings({ unitMode: "fixed", unitFixed: 50 }), 5000)).toBe("1u = R$ 50.00 (fixo)");
  });
  it("descreve unidade percentual", () => {
    expect(describeUnit(settings({ unitMode: "percent", unitPercent: 2 }), 5000)).toBe("1u = R$ 100.00 (2% da banca)");
  });
  it("avisa quando não configurada", () => {
    expect(describeUnit(settings({ unitMode: "fixed", unitFixed: 0 }), 5000)).toBe("Unidade não configurada");
  });
});

describe("exceedsUnitCap", () => {
  it("detecta stake acima do teto de unidades", () => {
    // unidade = R$50, teto 3u = R$150
    const s = settings({ unitMode: "fixed", unitFixed: 50, maxStakeUnits: 3 });
    expect(exceedsUnitCap(200, s, 5000)).toBe(true);
    expect(exceedsUnitCap(150, s, 5000)).toBe(false);
  });
  it("não dispara quando unidade não configurada", () => {
    expect(exceedsUnitCap(999, settings({ unitMode: "fixed", unitFixed: 0 }), 5000)).toBe(false);
  });
});
