import { Check, Lock, Zap, ArrowRight, ShieldCheck } from "lucide-react";
import { BrandLogo } from "./BrandLogo";

interface LandingProps {
  onGetStarted: () => void;
  onSignIn: () => void;
  onDemo: () => void;
}

type PlanFeature = { label: string; included: boolean };

const FREE_FEATURES: PlanFeature[] = [
  { label: "Dashboard com ROI, lucro e evolução da banca", included: true },
  { label: "Registro manual + Entrada Rápida", included: true },
  { label: "Diário, Extrato e Estratégias", included: true },
  { label: "Risco e Performance básicos", included: true },
  { label: "Até 2 casas · 50 apostas/mês · 90 dias de histórico", included: true },
  { label: "Inteligência por IA", included: false },
  { label: "OCR — escanear bilhete", included: false },
  { label: "Odds, CLV & valor esperado", included: false },
];

const EDGE_FEATURES: PlanFeature[] = [
  { label: "Tudo do Controle, sem limites", included: true },
  { label: "Inteligência por IA: portfólio, tilt e sugestões", included: true },
  { label: "OCR — escaneie o bilhete em vez de digitar", included: true },
  { label: "Odds, CLV & Edge e valor esperado", included: true },
  { label: "Risco avançado com hard stops", included: true },
  { label: "Relatórios avançados + export CSV/PDF", included: true },
  { label: "Casas, apostas e histórico ilimitados", included: true },
];

export function Landing({ onGetStarted, onSignIn, onDemo }: LandingProps) {
  return (
    <div className="lp">
      <header className="lp-topbar">
        <BrandLogo compact />
        <div className="lp-topbar-actions">
          <button type="button" className="lp-link" onClick={onSignIn}>Entrar</button>
          <button type="button" className="lp-btn lp-btn-primary lp-btn-sm" onClick={onGetStarted}>
            Criar conta grátis
          </button>
        </div>
      </header>

      <section className="lp-hero">
        <p className="lp-eyebrow">Terminal analítico para apostadores</p>
        <h1 className="lp-hero-title">
          Pare de só registrar.<br />
          <span className="lp-hero-accent">Comece a ganhar vantagem.</span>
        </h1>
        <p className="lp-hero-sub">
          Banca+ não é um cassino. É onde você controla banca, risco e edge num só lugar —
          com as métricas que separam apostadores profissionais de amadores.
        </p>
        <div className="lp-hero-cta">
          <button type="button" className="lp-btn lp-btn-primary" onClick={onGetStarted}>
            Criar conta grátis <ArrowRight size={16} />
          </button>
          <button type="button" className="lp-btn lp-btn-ghost" onClick={onDemo}>
            Testar sem conta
          </button>
        </div>
        <p className="lp-hero-foot">
          <ShieldCheck size={13} /> Grátis pra sempre · sem cartão · seus dados são seus
        </p>
      </section>

      <section className="lp-pricing" id="planos">
        <div className="lp-section-head">
          <h2 className="lp-section-title">Comece grátis. Evolua quando quiser vantagem.</h2>
          <p className="lp-section-sub">Sem pegadinha: o plano grátis é completo pra controlar sua banca de verdade.</p>
        </div>

        <div className="lp-plans">
          <article className="lp-plan">
            <header className="lp-plan-head">
              <h3 className="lp-plan-name">Controle</h3>
              <p className="lp-plan-tagline">Largue a planilha. Tenha controle real.</p>
              <div className="lp-plan-price">
                <strong>R$ 0</strong>
                <span>grátis pra sempre</span>
              </div>
            </header>
            <ul className="lp-plan-features">
              {FREE_FEATURES.map((f) => (
                <li key={f.label} className={f.included ? "on" : "off"}>
                  {f.included ? <Check size={15} /> : <Lock size={14} />}
                  <span>{f.label}</span>
                </li>
              ))}
            </ul>
            <button type="button" className="lp-btn lp-btn-ghost lp-btn-block" onClick={onGetStarted}>
              Criar conta grátis
            </button>
          </article>

          <article className="lp-plan lp-plan-featured">
            <span className="lp-plan-badge"><Zap size={12} /> Mais popular</span>
            <header className="lp-plan-head">
              <h3 className="lp-plan-name">Edge</h3>
              <p className="lp-plan-tagline">Pare de só registrar. Ganhe vantagem.</p>
              <div className="lp-plan-price">
                <strong>R$ 24,90</strong>
                <span>/mês · ou R$ 199/ano</span>
              </div>
            </header>
            <ul className="lp-plan-features">
              {EDGE_FEATURES.map((f) => (
                <li key={f.label} className="on">
                  <Check size={15} />
                  <span>{f.label}</span>
                </li>
              ))}
            </ul>
            <button type="button" className="lp-btn lp-btn-primary lp-btn-block" onClick={onGetStarted}>
              Começar grátis e fazer upgrade
            </button>
            <p className="lp-plan-note">Comece no grátis. Faça upgrade quando bater no limite.</p>
          </article>
        </div>
      </section>

      <footer className="lp-foot">
        <BrandLogo compact />
        <span className="lp-foot-copy">Ferramenta de disciplina e gestão. Aposte com responsabilidade.</span>
      </footer>
    </div>
  );
}
