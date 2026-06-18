import { useLayoutEffect, useState } from "react";

interface TourStep {
  target: string;
  title: string;
  body: string;
}

const STEPS: TourStep[] = [
  {
    target: '[data-tour="new-bet"]',
    title: "Registre em segundos",
    body: "Toda a inteligência parte do log. Aqui você registra com autocomplete, OCR de bilhete e templates de 1 clique.",
  },
  {
    target: '[data-tour="intelligence"]',
    title: "Inteligência & Radar",
    body: "Veja onde você tem edge e onde sangra banca — o Radar cruza ROI × exposição, com guarda de amostra contra ruído.",
  },
  {
    target: '[data-tour="risk"]',
    title: "Risco sob controle",
    body: "Unidade, exposição vs limite e alertas de tilt — sua disciplina monitorada em tempo real.",
  },
  {
    target: '[data-tour="reports"]',
    title: "Relatório executivo",
    body: "Sua carta mensal com evolução vs o mês anterior. Congele snapshots e acompanhe sua evolução.",
  },
];

interface TipPos {
  top: number;
  left: number;
  above: boolean;
}

export function GuidedTour({ onDone }: { onDone: () => void }) {
  const [step, setStep] = useState(0);
  const [pos, setPos] = useState<TipPos | null>(null);

  const current = STEPS[step];

  useLayoutEffect(() => {
    const el = document.querySelector(current.target) as HTMLElement | null;
    if (!el) {
      // Alvo ausente nesta tela — avança ou encerra sem travar o tour.
      if (step < STEPS.length - 1) setStep((s) => s + 1);
      else onDone();
      return;
    }

    el.classList.add("tour-highlight");
    el.scrollIntoView({ block: "nearest", behavior: "smooth" });

    const r = el.getBoundingClientRect();
    const tipWidth = 300;
    const above = window.innerHeight - r.bottom < 200;
    const top = above ? r.top - 12 : r.bottom + 12;
    const left = Math.max(12, Math.min(r.left + r.width / 2 - tipWidth / 2, window.innerWidth - tipWidth - 12));
    setPos({ top, left, above });

    return () => el.classList.remove("tour-highlight");
  }, [step, current.target, onDone]);

  function next() {
    if (step < STEPS.length - 1) setStep(step + 1);
    else onDone();
  }

  if (!pos) return null;

  return (
    <div className="tour-overlay" role="dialog" aria-label="Tour guiado">
      <div
        className="tour-tip"
        style={{ top: pos.top, left: pos.left, transform: pos.above ? "translateY(-100%)" : undefined }}
      >
        <div className="tour-step-count">{step + 1} de {STEPS.length}</div>
        <strong>{current.title}</strong>
        <p>{current.body}</p>
        <div className="tour-actions">
          <button className="tour-skip" onClick={onDone}>Pular tour</button>
          <button className="tour-next" onClick={next}>{step < STEPS.length - 1 ? "Próximo" : "Entendi"}</button>
        </div>
      </div>
    </div>
  );
}
