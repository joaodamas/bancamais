import { describe, it, expect } from "vitest";
import { track, setAnalyticsInstance } from "./analytics";

describe("analytics.track", () => {
  it("é no-op silencioso sem instância (sem consentimento de cookie)", () => {
    setAnalyticsInstance(null);
    expect(() => track("demo_start")).not.toThrow();
    expect(() => track("bet_recorded", { source: "manual", mode: "prelive" })).not.toThrow();
    expect(() => track("demo_data_imported", { bets: 5 })).not.toThrow();
  });
});
