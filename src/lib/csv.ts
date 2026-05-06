import type { AppState, Bet } from "./types";

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
    "payout",
    "closingOdds",
    "mode",
    "tags",
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
    bet.payout ?? "",
    bet.closingOdds ?? "",
    bet.mode,
    bet.tags.join("|"),
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
