import type { Bet } from "../lib/types";

const STATUS_LABEL: Record<Bet["status"], string> = {
  pending: "Pendente",
  won: "Ganha",
  lost: "Perdida",
  cashout: "Cashout",
  void: "Cancelada",
};

/**
 * Badge de status centralizado — fundo leve + texto escuro (estilo Stripe/Linear).
 * Fonte única de verdade para cor e rótulo de status de aposta.
 */
export function StatusBadge({ status }: { status: Bet["status"] }) {
  return <span className={`badge-status badge-${status}`}>{STATUS_LABEL[status]}</span>;
}
