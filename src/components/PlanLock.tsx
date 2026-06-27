import { Lock, Check, Clock } from "lucide-react";
import type { GatedFeature } from "../lib/plan";
import { FEATURE_PAYWALL } from "../lib/plan";

interface PlanLockProps {
  feature: GatedFeature;
  onUpgrade: () => void;
}

/** Tela de paywall para um recurso exclusivo do Edge. */
export function PlanLock({ feature, onUpgrade }: PlanLockProps) {
  const { title, benefits } = FEATURE_PAYWALL[feature];
  return (
    <article className="plan-lock">
      <span className="plan-lock-badge"><Lock size={13} /> Edge</span>
      <h2 className="plan-lock-title">{title}</h2>
      <p className="plan-lock-sub">
        Você está no plano Controle (grátis). Desbloqueie com o Edge.
      </p>
      <ul className="plan-lock-benefits">
        {benefits.map((b) => (
          <li key={b}><Check size={15} /> {b}</li>
        ))}
      </ul>
      <button type="button" className="plan-lock-cta" onClick={onUpgrade}>
        <Clock size={15} /> Entrar na lista de espera do Edge
      </button>
      <span className="plan-lock-foot">Em construção. Avisamos quando lançar.</span>
    </article>
  );
}
