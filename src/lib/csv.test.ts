import { describe, it, expect } from "vitest";
import { betsToCsv, parseBetsCsv } from "./csv";
import { emptyState } from "./storage";
import type { AppState, Bet } from "./types";

function makeState(overrides: Partial<AppState> = {}): AppState {
  return {
    ...emptyState(),
    bookmakers: [{ id: "b1", name: "Bet365", balance: 1000, status: "manual", lastSyncLabel: "manual" }],
    ...overrides,
  };
}

function makeBet(overrides: Partial<Bet> = {}): Bet {
  return {
    id: "bet-1",
    placedAt: "2026-05-01T10:00:00.000Z",
    eventAt: "2026-05-07T20:00:00.000Z",
    sport: "Futebol",
    league: "UCL",
    eventName: "Real x City",
    market: "Resultado",
    selection: "Real vence",
    bookmakerId: "b1",
    tags: [],
    stake: 100,
    odds: 2.0,
    status: "pending",
    mode: "prelive",
    ...overrides,
  };
}

const VALID_CSV = [
  "id,placedAt,eventAt,sport,league,eventName,market,selection,bookmaker,stake,odds,status,payout,closingOdds,mode,tags,slipImageUrl",
  "bet-1,2026-05-01T10:00:00.000Z,2026-05-07T20:00:00.000Z,Futebol,UCL,Real x City,Resultado,Real vence,Bet365,100,2.0,pending,,,prelive,,",
].join("\n");

// ── betsToCsv ─────────────────────────────────────────────────────────────────

describe("betsToCsv", () => {
  it("primeira linha contém os headers esperados", () => {
    const csv = betsToCsv(makeState({ bets: [makeBet()] }));
    const header = csv.split("\n")[0];
    expect(header).toContain("eventName");
    expect(header).toContain("stake");
    expect(header).toContain("odds");
    expect(header).toContain("status");
    expect(header).toContain("bookmaker");
  });

  it("resolve id da casa para nome na coluna bookmaker", () => {
    const csv = betsToCsv(makeState({ bets: [makeBet()] }));
    expect(csv).toContain("Bet365");
  });

  it("gera uma linha por aposta além do header", () => {
    const bets = [makeBet({ id: "b1" }), makeBet({ id: "b2" })];
    const csv = betsToCsv(makeState({ bets }));
    expect(csv.split("\n")).toHaveLength(3); // header + 2 linhas
  });

  it("escapa vírgulas em campos com vírgula", () => {
    const csv = betsToCsv(makeState({ bets: [makeBet({ eventName: "Real, City" })] }));
    expect(csv).toContain('"Real, City"');
  });

  it("escapa aspas duplas dentro de campos", () => {
    const csv = betsToCsv(makeState({ bets: [makeBet({ eventName: 'Evento "Especial"' })] }));
    expect(csv).toContain('"Evento ""Especial"""');
  });

  it("serializa tags separadas por pipe", () => {
    const csv = betsToCsv(makeState({ bets: [makeBet({ tags: ["value", "ev"] })] }));
    expect(csv).toContain("value|ev");
  });

  it("estado sem apostas gera apenas o header", () => {
    const csv = betsToCsv(makeState({ bets: [] }));
    expect(csv.split("\n")).toHaveLength(1);
  });
});

// ── parseBetsCsv ──────────────────────────────────────────────────────────────

describe("parseBetsCsv — sucesso", () => {
  it("parseia CSV válido sem erros", () => {
    const { bets, errors } = parseBetsCsv(VALID_CSV, makeState());
    expect(errors).toHaveLength(0);
    expect(bets).toHaveLength(1);
    expect(bets[0].stake).toBe(100);
    expect(bets[0].odds).toBe(2.0);
    expect(bets[0].status).toBe("pending");
  });

  it("aceita casas por nome e por id", () => {
    const byId = VALID_CSV.replace("Bet365", "b1");
    const { bets, errors } = parseBetsCsv(byId, makeState());
    expect(errors).toHaveLength(0);
    expect(bets).toHaveLength(1);
  });

  it("parseia tags separadas por pipe", () => {
    const csv = VALID_CSV.replace(",,prelive,,", ",,prelive,value|ev,,");
    const { bets } = parseBetsCsv(csv, makeState());
    expect(bets[0]?.tags).toEqual(["value", "ev"]);
  });

  it("status pendente por padrão quando coluna ausente", () => {
    const csv = VALID_CSV.replace(",pending,", ",,");
    const { bets } = parseBetsCsv(csv, makeState());
    expect(bets[0]?.status).toBe("pending");
  });
});

describe("parseBetsCsv — validações de stake e odd", () => {
  it("rejeita stake zero", () => {
    const csv = VALID_CSV.replace(",100,", ",0,");
    const { bets, errors } = parseBetsCsv(csv, makeState());
    expect(bets).toHaveLength(0);
    expect(errors[0]).toContain("stake invalida");
  });

  it("rejeita stake negativa", () => {
    const csv = VALID_CSV.replace(",100,", ",-50,");
    const { bets, errors } = parseBetsCsv(csv, makeState());
    expect(bets).toHaveLength(0);
    expect(errors[0]).toContain("stake invalida");
  });

  it("rejeita odd 1.0 (abaixo de 1.01)", () => {
    const csv = VALID_CSV.replace(",2.0,", ",1.0,");
    const { bets, errors } = parseBetsCsv(csv, makeState());
    expect(bets).toHaveLength(0);
    expect(errors[0]).toContain("odd invalida");
  });

  it("rejeita odd zero", () => {
    const csv = VALID_CSV.replace(",2.0,", ",0,");
    const { bets, errors } = parseBetsCsv(csv, makeState());
    expect(bets).toHaveLength(0);
    expect(errors[0]).toContain("odd invalida");
  });
});

describe("parseBetsCsv — erros estruturais", () => {
  it("retorna erro para CSV com apenas header (sem linhas)", () => {
    const { bets, errors } = parseBetsCsv(VALID_CSV.split("\n")[0], makeState());
    expect(bets).toHaveLength(0);
    expect(errors.length).toBeGreaterThan(0);
  });

  it("rejeita linha com casa desconhecida", () => {
    const csv = VALID_CSV.replace("Bet365", "CasaInexistente");
    const { bets, errors } = parseBetsCsv(csv, makeState());
    expect(bets).toHaveLength(0);
    expect(errors).toHaveLength(1);
  });

  it("rejeita linha com campos obrigatórios ausentes", () => {
    const header = "id,placedAt,eventAt,sport,league,eventName,market,selection,bookmaker,stake,odds,status,payout,closingOdds,mode,tags,slipImageUrl";
    const row = ",,,,,,,,Bet365,100,2.0,pending,,,prelive,,";
    const { bets, errors } = parseBetsCsv(`${header}\n${row}`, makeState());
    expect(bets).toHaveLength(0);
    expect(errors.length).toBeGreaterThan(0);
  });

  it("processa linhas válidas ignorando linhas inválidas", () => {
    const badRow = ",,,,,,,,CasaErrada,100,2.0,pending,,,prelive,,";
    const goodRow = "bet-2,2026-05-01T10:00:00.000Z,2026-05-07T20:00:00.000Z,Futebol,UCL,Outro Evento,Resultado,Casa,Bet365,50,1.8,pending,,,prelive,,";
    const csv = `${VALID_CSV.split("\n")[0]}\n${badRow}\n${goodRow}`;
    const { bets, errors } = parseBetsCsv(csv, makeState());
    expect(bets).toHaveLength(1);
    expect(errors).toHaveLength(1);
  });
});
