/**
 * Helpers de tempo para apostas pendentes.
 * O que importa numa aposta pendente não é a data absoluta do evento,
 * e sim o delta: quanto falta para começar, se já está ao vivo, se encerrou.
 */

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const LIVE_WINDOW = 3 * HOUR; // até 3h após o início ainda tratamos como "ao vivo"

export interface EventDelta {
  /** Texto pronto para exibição: "em 45min", "ao vivo", "encerrado". */
  label: string;
  /** Estado discreto para estilização / lógica condicional. */
  state: "upcoming" | "imminent" | "live" | "ended" | "unknown";
}

/** Calcula o estado e o rótulo de um evento em relação a agora. */
export function eventDelta(eventAt: string, now: number = Date.now()): EventDelta {
  const target = new Date(eventAt).getTime();
  if (Number.isNaN(target)) return { label: "", state: "unknown" };

  const diff = target - now;

  if (diff < 0) {
    const elapsedMin = Math.abs(diff) / MINUTE;
    if (Math.abs(diff) < LIVE_WINDOW) {
      return { label: `ao vivo · há ${Math.round(elapsedMin)}min`, state: "live" };
    }
    return { label: "encerrado", state: "ended" };
  }

  const minutes = diff / MINUTE;
  if (minutes < 60) {
    return { label: `em ${Math.round(minutes)}min`, state: "imminent" };
  }

  const hours = diff / HOUR;
  if (hours < 24) {
    return { label: `em ${Math.round(hours)}h`, state: "upcoming" };
  }

  const formatted = new Date(target).toLocaleDateString("pt-BR", {
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
  return { label: formatted, state: "upcoming" };
}

/** Texto curto pronto para a tabela. */
export function formatEventDelta(eventAt: string, now: number = Date.now()): string {
  return eventDelta(eventAt, now).label;
}

/** Evento que começa em menos de 1h e ainda não começou — merece destaque visual. */
export function isImminent(eventAt: string, now: number = Date.now()): boolean {
  const target = new Date(eventAt).getTime();
  if (Number.isNaN(target)) return false;
  const diff = target - now;
  return diff > 0 && diff < HOUR;
}
