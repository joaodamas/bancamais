import { money, percent, betProfit } from "./metrics";
import type { AppState } from "./types";
import type { calculateMetrics } from "./metrics";

type Metrics = ReturnType<typeof calculateMetrics>;

const ACCENT: [number, number, number] = [249, 115, 22];
const INK: [number, number, number] = [24, 24, 27];
const MUTED: [number, number, number] = [120, 120, 128];
const LINE: [number, number, number] = [225, 225, 228];
const POS: [number, number, number] = [22, 140, 70];
const NEG: [number, number, number] = [200, 50, 50];

const STATUS_LABEL: Record<string, string> = {
  won: "Ganha",
  lost: "Perdida",
  cashout: "Cashout",
  void: "Reembolso",
  pending: "Pendente",
};

/** Gera e baixa um relatório operacional em PDF. */
export async function generateReportPdf(state: AppState, metrics: Metrics) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 16;
  let y = margin;

  // Cabeçalho
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.setTextColor(...INK);
  doc.text("Banca+", margin, y + 2);
  doc.setTextColor(...ACCENT);
  doc.text("+", margin + doc.getTextWidth("Banca") + 0.5, y + 2);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(...MUTED);
  const generatedAt = new Intl.DateTimeFormat("pt-BR", { dateStyle: "long", timeStyle: "short" }).format(new Date());
  doc.text(`Relatório operacional · ${generatedAt}`, pageW - margin, y, { align: "right" });
  doc.text(state.bankrollName || "Banca", pageW - margin, y + 5, { align: "right" });

  y += 12;
  doc.setDrawColor(...LINE);
  doc.line(margin, y, pageW - margin, y);
  y += 10;

  // Métricas principais (grid 4 colunas)
  const cards: Array<{ label: string; value: string; tone?: [number, number, number] }> = [
    { label: "Banca atual", value: money.format(metrics.totalBalance) },
    { label: "Lucro total", value: money.format(metrics.profit), tone: metrics.profit >= 0 ? POS : NEG },
    { label: "ROI", value: percent.format(metrics.roi), tone: metrics.roi >= 0 ? POS : NEG },
    { label: "Yield", value: percent.format(metrics.yield), tone: metrics.yield >= 0 ? POS : NEG },
    { label: "Taxa de acerto", value: percent.format(metrics.hitRate) },
    { label: "CLV médio", value: percent.format(metrics.clvAverage), tone: metrics.clvAverage >= 0 ? POS : NEG },
    { label: "Exposição aberta", value: money.format(metrics.openExposure) },
    { label: "Odd média", value: metrics.averageOdds.toFixed(2) },
  ];

  const cols = 4;
  const gap = 4;
  const cardW = (pageW - margin * 2 - gap * (cols - 1)) / cols;
  const cardH = 20;
  cards.forEach((card, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const cx = margin + col * (cardW + gap);
    const cy = y + row * (cardH + gap);
    doc.setDrawColor(...LINE);
    doc.setFillColor(250, 250, 251);
    doc.roundedRect(cx, cy, cardW, cardH, 2, 2, "FD");
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(...MUTED);
    doc.text(card.label.toUpperCase(), cx + 4, cy + 6);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.setTextColor(...(card.tone ?? INK));
    doc.text(card.value, cx + 4, cy + 14);
  });

  y += Math.ceil(cards.length / cols) * (cardH + gap) + 8;

  // Tabela de apostas recentes
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...INK);
  doc.text("Apostas recentes", margin, y);
  y += 6;

  const recent = [...state.bets]
    .sort((a, b) => new Date(b.placedAt).getTime() - new Date(a.placedAt).getTime())
    .slice(0, 28);

  const colX = [margin, margin + 24, margin + 96, margin + 116, margin + 134, pageW - margin];
  const headers = ["Data", "Evento", "Stake", "Odd", "Status", "Lucro"];

  doc.setFillColor(...INK);
  doc.rect(margin, y, pageW - margin * 2, 7, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(255, 255, 255);
  headers.forEach((h, i) => {
    const right = i >= 2;
    doc.text(h, right ? colX[i + 1] - 2 : colX[i] + 2, y + 4.8, { align: right ? "right" : "left" });
  });
  y += 7;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  recent.forEach((bet, idx) => {
    if (idx % 2 === 1) {
      doc.setFillColor(247, 247, 248);
      doc.rect(margin, y, pageW - margin * 2, 6.5, "F");
    }
    const date = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" }).format(new Date(bet.placedAt));
    const profit = betProfit(bet);
    const isPending = bet.status === "pending";
    const event = bet.eventName.length > 42 ? bet.eventName.slice(0, 41) + "…" : bet.eventName;

    doc.setTextColor(...MUTED);
    doc.text(date, colX[0] + 2, y + 4.4);
    doc.setTextColor(...INK);
    doc.text(event, colX[1] + 2, y + 4.4);
    doc.text(money.format(bet.stake), colX[3] - 2, y + 4.4, { align: "right" });
    doc.text(bet.odds.toFixed(2), colX[4] - 2, y + 4.4, { align: "right" });
    doc.setTextColor(...MUTED);
    doc.text(STATUS_LABEL[bet.status] ?? bet.status, colX[5] - 2 - 18, y + 4.4);
    if (!isPending) {
      doc.setTextColor(...(profit >= 0 ? POS : NEG));
      doc.text(money.format(profit), colX[5] - 2, y + 4.4, { align: "right" });
    } else {
      doc.setTextColor(...MUTED);
      doc.text("—", colX[5] - 2, y + 4.4, { align: "right" });
    }
    y += 6.5;
  });

  // Rodapé
  const footY = doc.internal.pageSize.getHeight() - 10;
  doc.setDrawColor(...LINE);
  doc.line(margin, footY - 4, pageW - margin, footY - 4);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(...MUTED);
  doc.text("Gerado por Banca+ · ferramenta de gestão e disciplina · aposte com responsabilidade", margin, footY);

  doc.save(`bancamais-relatorio-${new Date().toISOString().slice(0, 10)}.pdf`);
}
