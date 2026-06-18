import { useMemo, useState } from "react";
import { TrendingUp, TrendingDown } from "lucide-react";
import { analyzeEdge, edgeHighlights, type EdgeDimension, type EdgeSegment, type EdgeConfidence } from "../lib/edgeAnalysis";
import { money, percent } from "../lib/metrics";
import type { AppState } from "../lib/types";

const DIMENSIONS: { id: EdgeDimension; label: string }[] = [
  { id: "market", label: "Mercado" },
  { id: "league", label: "Liga" },
  { id: "sport", label: "Esporte" },
  { id: "mode", label: "Modo" },
  { id: "tag", label: "Tag" },
];

const CONFIDENCE_LABEL: Record<EdgeConfidence, string> = {
  low: "amostra pequena — leitura frágil",
  medium: "amostra média",
  high: "amostra robusta",
};

function ConfidenceDot({ c, n }: { c: EdgeConfidence; n: number }) {
  return <span className={`edge-conf edge-conf-${c}`} title={`${n} apostas · ${CONFIDENCE_LABEL[c]}`} />;
}

function Highlight({ tone, label, seg }: { tone: "good" | "bad"; label: string; seg: EdgeSegment }) {
  return (
    <div className={`edge-highlight edge-highlight-${tone}`}>
      <div className="edge-highlight-icon">{tone === "good" ? <TrendingUp size={16} /> : <TrendingDown size={16} />}</div>
      <div>
        <span>{label}</span>
        <strong>{seg.key}</strong>
        <small className="text-mono">
          {percent.format(seg.roi)} ROI · {money.format(seg.profit)} · {seg.bets} apostas
        </small>
      </div>
    </div>
  );
}

export function EdgePanel({ state }: { state: AppState }) {
  const [dim, setDim] = useState<EdgeDimension>("market");
  const segments = useMemo(() => analyzeEdge(state, dim, 1), [state, dim]);
  const { best, worst } = useMemo(() => edgeHighlights(state, dim), [state, dim]);
  const dimLabel = DIMENSIONS.find((d) => d.id === dim)?.label ?? "";

  return (
    <article className="panel edge-panel">
      <div className="edge-head">
        <div className="edge-head-copy">
          <h2>Dissecação de edge</h2>
          <p>Onde você ganha e onde perde, por {dimLabel.toLowerCase()}. O ponto ao lado indica o tamanho da amostra — segmento pequeno é ruído, não edge.</p>
        </div>
        <div className="edge-dims">
          {DIMENSIONS.map((d) => (
            <button key={d.id} className={dim === d.id ? "edge-dim active" : "edge-dim"} onClick={() => setDim(d.id)}>
              {d.label}
            </button>
          ))}
        </div>
      </div>

      {segments.length === 0 ? (
        <p className="edge-empty">Liquide apostas com {dimLabel.toLowerCase()} preenchido para dissecar o edge aqui.</p>
      ) : (
        <>
          {(best || worst) && (
            <div className="edge-highlights">
              {best && <Highlight tone="good" label="Mais lucrativo" seg={best} />}
              {worst && <Highlight tone="bad" label="Mais deficitário" seg={worst} />}
            </div>
          )}

          <div className="edge-table-wrap">
            <table className="edge-table">
              <colgroup>
                <col />
                <col style={{ width: "84px" }} />
                <col style={{ width: "84px" }} />
                <col style={{ width: "84px" }} />
                <col style={{ width: "84px" }} />
                <col style={{ width: "104px" }} />
              </colgroup>
              <thead>
                <tr>
                  <th>{dimLabel}</th>
                  <th className="num">Apostas</th>
                  <th className="num">ROI</th>
                  <th className="num">Acerto</th>
                  <th className="num">CLV</th>
                  <th className="num">Lucro</th>
                </tr>
              </thead>
              <tbody>
                {segments.map((s) => (
                  <tr key={s.key}>
                    <td className="edge-key-cell">
                      <ConfidenceDot c={s.confidence} n={s.bets} />
                      <span className="edge-key" title={s.key}>{s.key}</span>
                    </td>
                    <td className="num text-mono">{s.bets}</td>
                    <td className={`num text-mono ${s.roi >= 0 ? "pos" : "neg"}`}>{percent.format(s.roi)}</td>
                    <td className="num text-mono">{percent.format(s.hitRate)}</td>
                    <td className={`num text-mono ${s.clvAvg === null ? "" : s.clvAvg >= 0 ? "pos" : "neg"}`}>
                      {s.clvAvg === null ? "—" : percent.format(s.clvAvg)}
                    </td>
                    <td className={`num text-mono ${s.profit >= 0 ? "pos" : "neg"}`}>{money.format(s.profit)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </article>
  );
}
