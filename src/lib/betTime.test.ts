import { describe, it, expect } from "vitest";
import { eventDelta, formatEventDelta, isImminent } from "./betTime";

const NOW = new Date("2026-06-18T12:00:00.000Z").getTime();
const iso = (offsetMs: number) => new Date(NOW + offsetMs).toISOString();

const MIN = 60_000;
const HOUR = 60 * MIN;

describe("eventDelta", () => {
  it("retorna 'imminent' para evento em menos de 1h", () => {
    const d = eventDelta(iso(45 * MIN), NOW);
    expect(d.state).toBe("imminent");
    expect(d.label).toBe("em 45min");
  });

  it("retorna 'upcoming' para evento em algumas horas", () => {
    const d = eventDelta(iso(3 * HOUR), NOW);
    expect(d.state).toBe("upcoming");
    expect(d.label).toBe("em 3h");
  });

  it("retorna 'live' para evento começado há pouco", () => {
    const d = eventDelta(iso(-30 * MIN), NOW);
    expect(d.state).toBe("live");
    expect(d.label).toContain("ao vivo");
  });

  it("retorna 'ended' para evento que começou há muitas horas", () => {
    const d = eventDelta(iso(-5 * HOUR), NOW);
    expect(d.state).toBe("ended");
    expect(d.label).toBe("encerrado");
  });

  it("retorna 'upcoming' com data formatada para eventos a mais de 24h", () => {
    const d = eventDelta(iso(48 * HOUR), NOW);
    expect(d.state).toBe("upcoming");
    expect(d.label).not.toBe("");
  });

  it("retorna 'unknown' para data inválida", () => {
    const d = eventDelta("não-é-data", NOW);
    expect(d.state).toBe("unknown");
    expect(d.label).toBe("");
  });
});

describe("formatEventDelta", () => {
  it("expõe apenas o rótulo", () => {
    expect(formatEventDelta(iso(20 * MIN), NOW)).toBe("em 20min");
  });
});

describe("isImminent", () => {
  it("é true para evento entre agora e 1h", () => {
    expect(isImminent(iso(30 * MIN), NOW)).toBe(true);
  });

  it("é false para evento daqui a mais de 1h", () => {
    expect(isImminent(iso(2 * HOUR), NOW)).toBe(false);
  });

  it("é false para evento que já começou", () => {
    expect(isImminent(iso(-5 * MIN), NOW)).toBe(false);
  });

  it("é false para data inválida", () => {
    expect(isImminent("xxx", NOW)).toBe(false);
  });
});
