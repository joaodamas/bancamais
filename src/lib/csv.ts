import type { AppState, Bet } from "./types";
import { createBetId } from "./storage";
import { settledPayout } from "../services/bets.service";

function escapeCsv(value: unknown) {
  const text = String(value ?? "");
  if (text.includes(",") || text.includes("\n") || text.includes('"')) {
    return `"${text.replaceAll('"', '""')}"`;
  }

  return text;
}

function row(values: unknown[]) {
  return values.map(escapeCsv).join(",");
}

export function betsToCsv(state: AppState) {
  const header = row([
    "id",
    "placedAt",
    "eventAt",
    "sport",
    "league",
    "eventName",
    "market",
    "selection",
    "bookmaker",
    "stake",
    "odds",
    "status",
    "isFreebet",
    "payout",
    "closingOdds",
    "mode",
    "tags",
    "slipImageUrl",
  ]);

  const rows = state.bets.map((bet: Bet) => row([
    bet.id,
    bet.placedAt,
    bet.eventAt,
    bet.sport,
    bet.league,
    bet.eventName,
    bet.market,
    bet.selection,
    state.bookmakers.find((book) => book.id === bet.bookmakerId)?.name ?? bet.bookmakerId,
    bet.stake,
    bet.odds,
    bet.status,
    bet.isFreebet ? "true" : "",
    bet.payout ?? "",
    bet.closingOdds ?? "",
    bet.mode,
    bet.tags.join("|"),
    bet.slipImageUrl ?? "",
  ]));

  return [header, ...rows].join("\n");
}

export function downloadTextFile(filename: string, content: string, mimeType = "text/csv;charset=utf-8") {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function parseCsvLine(line: string) {
  const values: string[] = [];
  let current = "";
  let quoted = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];

    if (char === '"' && quoted && next === '"') {
      current += '"';
      index += 1;
      continue;
    }

    if (char === '"') {
      quoted = !quoted;
      continue;
    }

    if (char === "," && !quoted) {
      values.push(current);
      current = "";
      continue;
    }

    current += char;
  }

  values.push(current);
  return values;
}

export function parseBetsCsv(content: string, state: AppState) {
  const lines = content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length < 2) {
    return { bets: [] as Bet[], errors: ["CSV sem linhas de aposta."] };
  }

  const headers = parseCsvLine(lines[0]);
  const errors: string[] = [];
  const bets: Bet[] = [];

  lines.slice(1).forEach((line, rowIndex) => {
    const values = parseCsvLine(line);
    const record = Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""]));
    const bookmakerId = state.bookmakers.find((book) => book.name === record.bookmaker || book.id === record.bookmaker)?.id;

    if (!bookmakerId) {
      errors.push(`Linha ${rowIndex + 2}: casa nao encontrada (${record.bookmaker}).`);
      return;
    }

    if (!record.eventName || !record.selection || !record.stake || !record.odds) {
      errors.push(`Linha ${rowIndex + 2}: campos obrigatorios ausentes.`);
      return;
    }

    const stakeNum = Number(record.stake);
    if (!Number.isFinite(stakeNum) || stakeNum <= 0) {
      errors.push(`Linha ${rowIndex + 2}: stake invalida (${record.stake}).`);
      return;
    }

    const oddsNum = Number(record.odds);
    if (!Number.isFinite(oddsNum) || oddsNum < 1.01) {
      errors.push(`Linha ${rowIndex + 2}: odd invalida (${record.odds}).`);
      return;
    }

    const status = (record.status || "pending") as Bet["status"];
    const isFreebet = record.isFreebet === "true" || record.isFreebet === "1" || record.isFreebet?.toLowerCase() === "sim";
    const explicitPayout = record.payout ? Number(record.payout) : undefined;
    // Payout autoritativo: usa o do CSV quando presente e válido; senão
    // recalcula pela fonte única. Sem isso, meia-ganha/meia-perdida importadas
    // ficavam com lucro errado nas métricas (payout undefined → −stake).
    const payout = status === "pending"
      ? undefined
      : explicitPayout != null && Number.isFinite(explicitPayout)
        ? explicitPayout
        : settledPayout(status, stakeNum, oddsNum, undefined, isFreebet);

    bets.push({
      id: record.id || createBetId(),
      placedAt: record.placedAt || new Date().toISOString(),
      eventAt: record.eventAt || new Date().toISOString(),
      sport: record.sport || "Nao informado",
      league: record.league || "Nao informado",
      eventName: record.eventName,
      market: record.market || "Nao informado",
      selection: record.selection,
      bookmakerId,
      tags: record.tags ? record.tags.split("|").map((tag) => tag.trim()).filter(Boolean) : [],
      stake: stakeNum,
      odds: oddsNum,
      status,
      isFreebet: isFreebet || undefined,
      payout,
      closingOdds: record.closingOdds ? Number(record.closingOdds) : undefined,
      mode: record.mode === "live" ? "live" : "prelive",
      slipImageUrl: record.slipImageUrl || undefined,
    });
  });

  return { bets, errors };
}
