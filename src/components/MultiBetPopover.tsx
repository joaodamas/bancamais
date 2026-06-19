import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { Popover, PopoverTrigger, PopoverContent } from "./ui/popover";

export interface BetLeg {
  text: string;
  odd?: string;
}

/**
 * Quebra a seleção de uma múltipla em pernas individuais.
 * Tenta os separadores fortes (/, ;, |) e cai para vírgula só quando há vários.
 * Extrai a odd entre parênteses no fim de cada perna, se houver.
 */
export function parseLegs(selection: string): BetLeg[] {
  const trimmed = selection.trim();
  if (!trimmed) return [];

  let parts = trimmed.split(/\s*[/|;]\s*/).map((s) => s.trim()).filter(Boolean);
  if (parts.length === 1 && (trimmed.match(/,/g)?.length ?? 0) >= 3) {
    parts = trimmed.split(/\s*,\s*/).map((s) => s.trim()).filter(Boolean);
  }

  return parts.map((raw) => {
    const m = raw.match(/\(([\d.,]+)\)\s*$/);
    return m && m.index !== undefined
      ? { text: raw.slice(0, m.index).trim(), odd: m[1] }
      : { text: raw };
  });
}

/** Quebra o eventName de uma múltipla nos confrontos individuais. */
export function parseConfrontos(eventName: string): string[] {
  const trimmed = eventName.trim();
  if (!trimmed) return [];
  let parts = trimmed.split(/\s*[/|;]\s*/).map((s) => s.trim()).filter(Boolean);
  if (parts.length === 1 && (trimmed.match(/,/g)?.length ?? 0) >= 2) {
    parts = trimmed.split(/\s*,\s*/).map((s) => s.trim()).filter(Boolean);
  }
  return parts;
}

export function MultiBetPopover({
  market,
  legs,
  oddTotal,
  eventName,
}: {
  market: string;
  legs: BetLeg[];
  oddTotal: number;
  eventName?: string;
}) {
  const [open, setOpen] = useState(false);
  const confrontos = eventName ? parseConfrontos(eventName) : [];
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button className={`multibet-trigger${open ? " active" : ""}`} type="button">
          {legs.length} seleções
          <ChevronDown size={12} />
        </button>
      </PopoverTrigger>
      <PopoverContent className="multibet-popover" align="start">
        <div className="multibet-head">
          <span className="multibet-head-title" title={market}>{market}</span>
          <span className="multibet-head-odd text-mono">@ {oddTotal.toFixed(2)}</span>
        </div>
        {confrontos.length >= 2 && (
          <div className="multibet-confrontos">
            <span className="multibet-section-label">Confrontos</span>
            <ul className="multibet-confrontos-list">
              {confrontos.map((confronto, i) => (
                <li key={i}>{confronto}</li>
              ))}
            </ul>
          </div>
        )}
        <span className="multibet-section-label">Seleções</span>
        <ol className="multibet-legs">
          {legs.map((leg, i) => (
            <li key={i} className="multibet-leg">
              <span className="multibet-leg-num text-mono">{i + 1}</span>
              <span className="multibet-leg-text">{leg.text}</span>
              {leg.odd && <span className="multibet-leg-odd text-mono">{leg.odd}</span>}
            </li>
          ))}
        </ol>
      </PopoverContent>
    </Popover>
  );
}
