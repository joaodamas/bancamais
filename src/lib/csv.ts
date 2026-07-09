import type { AppState, Bet } from "./types";
import { settledPayout } from "../services/bets.service";
import { betProfit, money } from "./metrics";

// Neutraliza injecao de formula (CSV/planilha): celulas que comecam com
// = + - @ ou tab sao interpretadas como formula pelo Excel/Sheets. O prefixo
// de aspa simples forca a celula a ser tratada como texto.
function neutralizeFormula(text: string): string {
  return /^[=+\-@\t]/.test(text) ? `'${text}` : text;
}

function escapeCsv(value: unknown) {
  const text = neutralizeFormula(String(value ?? ""));
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

// ── Export Excel colorido (.xls via HTML — Excel abre com cor e colunas) ──────

const XLS_STATUS_LABEL: Record<Bet["status"], string> = {
  pending: "Pendente",
  won: "Ganha",
  lost: "Perdida",
  cashout: "Cashout",
  void: "Cancelada",
  half_won: "Meia ganha",
  half_lost: "Meia perdida",
};

/** Cor de fundo/texto da linha por resultado. */
function xlsTone(bet: Bet): { bg: string; fg: string } {
  if (bet.status === "pending") return { bg: "#FEF6E7", fg: "#8A6D1B" };
  if (bet.status === "void") return { bg: "#F0F1F3", fg: "#4B5563" };
  const green = { bg: "#E7F7EE", fg: "#127A3E" };
  const red = { bg: "#FCEBEC", fg: "#B4232B" };
  if (bet.status === "won" || bet.status === "half_won") return green;
  if (bet.status === "lost" || bet.status === "half_lost") return red;
  return betProfit(bet) >= 0 ? green : red; // cashout
}

function xlsDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

/** Gera uma planilha .xls (HTML) com uma linha por aposta, colorida por resultado. */
export function betsToExcelHtml(state: AppState): string {
  const bookmakerName = new Map(state.bookmakers.map((b) => [b.id, b.name]));
  const headers = ["Data", "Evento", "Esporte / Liga", "Mercado", "Seleção", "Casa", "Stake", "Odd", "Status", "Resultado"];

  const th = headers
    .map((h) => `<th style="background:#111827;color:#fff;padding:6px 9px;border:1px solid #D1D5DB;text-align:left;font-size:11px;">${escapeHtml(h)}</th>`)
    .join("");

  const rows = state.bets.map((bet) => {
    const tone = xlsTone(bet);
    const settled = bet.status !== "pending";
    const profit = betProfit(bet);
    const resultado = settled
      ? (bet.status === "void" ? money.format(0) : `${profit >= 0 ? "+" : ""}${money.format(profit)}`)
      : "Pendente";
    const cell = (v: string, extra = "") =>
      `<td style="padding:5px 9px;border:1px solid #E5E7EB;font-size:11px;${extra}">${v}</td>`;
    const freebetTag = bet.isFreebet
      ? ' <span style="color:#7C3AED;font-weight:bold;">[Freebet]</span>'
      : "";
    return `<tr style="background:${tone.bg};color:${tone.fg};">${[
      cell(escapeHtml(xlsDate(bet.eventAt || bet.placedAt))),
      cell(escapeHtml(neutralizeFormula(bet.eventName)) + freebetTag),
      cell(escapeHtml(neutralizeFormula([bet.sport, bet.league].filter(Boolean).join(" · ")))),
      cell(escapeHtml(neutralizeFormula(bet.market))),
      cell(escapeHtml(neutralizeFormula(bet.selection))),
      cell(escapeHtml(neutralizeFormula(bookmakerName.get(bet.bookmakerId) ?? bet.bookmakerId))),
      cell(money.format(bet.stake), "text-align:right;"),
      cell(bet.odds.toFixed(2), "text-align:right;"),
      cell(`<strong>${escapeHtml(XLS_STATUS_LABEL[bet.status] ?? bet.status)}</strong>`),
      cell(`<strong>${escapeHtml(resultado)}</strong>`, "text-align:right;"),
    ].join("")}</tr>`;
  }).join("");

  return `<html xmlns:x="urn:schemas-microsoft-com:office:excel"><head><meta charset="utf-8"></head>
<body><table style="border-collapse:collapse;font-family:Arial,sans-serif;">
<thead><tr>${th}</tr></thead><tbody>${rows}</tbody></table></body></html>`;
}

/** Baixa a planilha colorida como .xls (Excel abre com cores e colunas). */
export function downloadBetsExcel(state: AppState, filename = "bancamais-apostas.xls") {
  const html = betsToExcelHtml(state);
  downloadTextFile(filename, `﻿${html}`, "application/vnd.ms-excel;charset=utf-8");
}

export function downloadTextFile(filename: string, content: string, mimeType = "text/csv;charset=utf-8") {
  // BOM UTF-8: sem ele o Excel (sobretudo no Mac) lê o arquivo como MacRoman e
  // embaralha os acentos ("Bélgica" → "B√©lgica"). O ﻿ sinaliza UTF-8.
  const payload = mimeType.includes("csv") ? `﻿${content}` : content;
  const blob = new Blob([payload], { type: mimeType });
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

// Converte uma data crua para ISO. Trata primeiro DD/MM/YYYY (pt-BR) com hora
// opcional, pois Date.parse interpretaria "07/05/2026" como MM/DD (formato US) e
// trocaria dia por mes silenciosamente. Formatos com traco (ISO) caem no
// Date.parse. Retorna null quando nao consegue interpretar, para o chamador
// emitir erro de linha.
function toIsoDate(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  const brMatch = /^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?$/.exec(trimmed);
  if (brMatch) {
    const [, day, month, year, hour = "0", minute = "0", second = "0"] = brMatch;
    const date = new Date(
      Number(year),
      Number(month) - 1,
      Number(day),
      Number(hour),
      Number(minute),
      Number(second),
    );
    const valid = !Number.isNaN(date.getTime())
      && date.getDate() === Number(day)
      && date.getMonth() === Number(month) - 1;
    return valid ? date.toISOString() : null;
  }

  const direct = Date.parse(trimmed);
  if (!Number.isNaN(direct)) return new Date(direct).toISOString();

  return null;
}

// Hash deterministico (djb2) de uma chave de conteudo. Reimportar o mesmo CSV
// produz os mesmos ids, permitindo a deduplicacao detectar duplicatas.
function contentHash(input: string): string {
  let hash = 5381;
  for (let index = 0; index < input.length; index += 1) {
    hash = (hash * 33) ^ input.charCodeAt(index);
  }
  return (hash >>> 0).toString(36);
}

// Status conhecido (Bet["status"]) + sinonimos pt-BR obvios. Status fora deste
// conjunto vira erro de linha em vez de cast cego.
const STATUS_ALIASES: Record<string, Bet["status"]> = {
  pending: "pending",
  pendente: "pending",
  aberta: "pending",
  won: "won",
  ganha: "won",
  ganhou: "won",
  green: "won",
  lost: "lost",
  perdida: "lost",
  perdeu: "lost",
  red: "lost",
  void: "void",
  cancelada: "void",
  anulada: "void",
  devolvida: "void",
  cashout: "cashout",
  half_won: "half_won",
  "meia ganha": "half_won",
  half_lost: "half_lost",
  "meia perdida": "half_lost",
};

export function parseBetsCsv(content: string, state: AppState) {
  const lines = content
    .replace(/^﻿/, "") // remove BOM UTF-8 se o arquivo trouxer (ex.: nosso próprio export)
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

    const status = STATUS_ALIASES[(record.status || "pending").trim().toLowerCase()];
    if (!status) {
      errors.push(`Linha ${rowIndex + 2}: status desconhecido (${record.status}).`);
      return;
    }

    let placedAt: string;
    if (record.placedAt) {
      const parsed = toIsoDate(record.placedAt);
      if (!parsed) {
        errors.push(`Linha ${rowIndex + 2}: data da aposta invalida (${record.placedAt}).`);
        return;
      }
      placedAt = parsed;
    } else {
      placedAt = new Date().toISOString();
    }

    let eventAt: string;
    if (record.eventAt) {
      const parsed = toIsoDate(record.eventAt);
      if (!parsed) {
        errors.push(`Linha ${rowIndex + 2}: data do evento invalida (${record.eventAt}).`);
        return;
      }
      eventAt = parsed;
    } else {
      eventAt = placedAt;
    }

    const isFreebet = record.isFreebet === "true" || record.isFreebet === "1" || record.isFreebet?.toLowerCase() === "sim";
    const explicitPayout = record.payout ? Number(record.payout) : undefined;
    // Payout reconciliado pela regra do app (fonte unica). Ignora o payout do
    // CSV que contradiga a regra — sobretudo freebet, onde vitoria paga
    // stake×(odd−1) e nao stake×odd. Cashout preserva o valor recebido do CSV,
    // por ser um montante manual sem formula fixa.
    const cashoutFromCsv = status === "cashout" && explicitPayout != null
      && Number.isFinite(explicitPayout) && explicitPayout > 0
      ? explicitPayout
      : undefined;
    const payout = status === "pending"
      ? undefined
      : settledPayout(status, stakeNum, oddsNum, cashoutFromCsv, isFreebet);

    const closingOddsNum = record.closingOdds ? Number(record.closingOdds) : undefined;
    const closingOdds = closingOddsNum != null && Number.isFinite(closingOddsNum) && closingOddsNum >= 1.01
      ? closingOddsNum
      : undefined;

    const id = record.id
      || `bet-csv-${contentHash(`${placedAt}|${record.eventName}|${record.selection}|${stakeNum}|${oddsNum}|${bookmakerId}`)}`;

    bets.push({
      id,
      placedAt,
      eventAt,
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
      closingOdds,
      mode: record.mode === "live" ? "live" : "prelive",
      slipImageUrl: record.slipImageUrl || undefined,
    });
  });

  return { bets, errors };
}
