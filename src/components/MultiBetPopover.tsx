import { useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown } from "lucide-react";

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

function normalize(value: string): string {
  return value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

function extractTeams(confronto: string): string[] {
  return confronto
    .split(/\s+(?:vs|x|×|-|–)\s+/i)
    .map((team) => normalize(team).replace(/[^a-z0-9 ]/g, "").trim())
    .filter((team) => team.length >= 3);
}

interface GamePicks {
  confronto: string;
  picks: BetLeg[];
}

/** Pareia cada perna ao confronto cujo nome de time aparece na seleção. */
function pairLegs(confrontos: string[], legs: BetLeg[]): { games: GamePicks[]; outras: BetLeg[] } {
  const games: GamePicks[] = confrontos.map((confronto) => ({ confronto, picks: [] }));
  const teamsByGame = confrontos.map(extractTeams);
  const outras: BetLeg[] = [];

  for (const leg of legs) {
    const legNorm = normalize(leg.text);
    const idx = teamsByGame.findIndex((teams) => teams.some((team) => team && legNorm.includes(team)));
    if (idx >= 0) games[idx].picks.push(leg);
    else outras.push(leg);
  }

  return { games, outras };
}

function PickList({ picks }: { picks: BetLeg[] }) {
  return (
    <ul className="multibet-game-picks">
      {picks.map((pick, i) => (
        <li key={i}>
          <span className="multibet-pick-text">{pick.text}</span>
          {pick.odd && <span className="multibet-pick-odd text-mono">{pick.odd}</span>}
        </li>
      ))}
    </ul>
  );
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
  const paired = confrontos.length >= 2 ? pairLegs(confrontos, legs) : null;

  return (
    <>
      <button
        className={`multibet-trigger${open ? " active" : ""}`}
        type="button"
        onClick={() => setOpen(true)}
      >
        {legs.length} seleções
        <ChevronDown size={12} />
      </button>

      {open && createPortal(
        <div className="modal-overlay" onClick={() => setOpen(false)}>
          <div className="modal-panel multibet-modal" onClick={(event) => event.stopPropagation()}>
            <button className="modal-close" onClick={() => setOpen(false)} type="button">×</button>
            <div className="multibet-modal-head">
              <span className="multibet-modal-tag">Múltipla · {legs.length} seleções</span>
              <h2 title={market}>{market}</h2>
              <span className="multibet-modal-odd text-mono">@ {oddTotal.toFixed(2)}</span>
            </div>
            <div className="multibet-modal-body">
              {paired ? (
                <>
                  {paired.games.map((game, i) => (
                    <div key={i} className="multibet-game">
                      <div className="multibet-game-name">{game.confronto}</div>
                      {game.picks.length > 0 ? (
                        <PickList picks={game.picks} />
                      ) : (
                        <span className="multibet-game-empty">sem seleção identificada</span>
                      )}
                    </div>
                  ))}
                  {paired.outras.length > 0 && (
                    <div className="multibet-game">
                      <div className="multibet-game-name multibet-game-outras">Demais seleções</div>
                      <PickList picks={paired.outras} />
                    </div>
                  )}
                </>
              ) : (
                <div className="multibet-game">
                  <PickList picks={legs} />
                </div>
              )}
            </div>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
