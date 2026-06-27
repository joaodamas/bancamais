import { useState, type FormEvent } from "react";
import {
  Check, Lock, Zap, ArrowRight, ShieldCheck, Brain, ScanLine,
  TrendingUp, LineChart, Target, CalendarDays, ListChecks, ShieldAlert,
  X, Clock,
} from "lucide-react";
import { BrandLogo } from "./BrandLogo";

interface LandingProps {
  onGetStarted: () => void;
  onSignIn: () => void;
  onDemo: () => void;
  onJoinWaitlist: (email: string) => Promise<void>;
}

type PlanFeature = { label: string; included: boolean };

const PAINS = [
  {
    Icon: TrendingUp,
    title: "Você sabe seu ROI real?",
    body: "Ou só sente que está no lucro? Sem registro disciplinado, a sensação engana e a banca derrete sem você perceber.",
  },
  {
    Icon: ShieldAlert,
    title: "O tilt te pega no escuro",
    body: "Sequência de perda, stake subindo, decisão emocional. Sem limites e alertas, o tilt vira prejuízo antes de você reagir.",
  },
  {
    Icon: Target,
    title: "Aposta sem edge é sorte",
    body: "Se você não mede CLV nem valor esperado, não sabe se ganha por skill ou por acaso. E acaso não paga no longo prazo.",
  },
];

const STEPS = [
  {
    Icon: ScanLine,
    step: "01",
    title: "Registre",
    body: "Escaneie o bilhete por OCR ou use a Entrada Rápida. Cada aposta vira dado estruturado em segundos.",
  },
  {
    Icon: LineChart,
    step: "02",
    title: "Controle",
    body: "Dashboard, risco e hard stops mostram exatamente onde está sua banca, seu tilt e sua disciplina.",
  },
  {
    Icon: Brain,
    step: "03",
    title: "Ganhe edge",
    body: "IA analisa seu portfólio, CLV mede se você bate a linha de fechamento e o valor esperado guia as próximas entradas.",
  },
];

const FEATURES = [
  { Icon: ListChecks, title: "Apostas & Diário", body: "Histórico completo, busca, filtros e calendário das suas entradas." },
  { Icon: LineChart, title: "Dashboard & Performance", body: "ROI, yield, hit rate, lucro e a evolução da banca em tempo real." },
  { Icon: ShieldAlert, title: "Risco & Hard stops", body: "Travas diárias, semanais e mensais que protegem a banca do tilt." },
  { Icon: TrendingUp, title: "CLV, Edge & Odds", body: "Meça closing line value, valor esperado e compare linhas entre casas." },
  { Icon: CalendarDays, title: "Extrato & Estratégias", body: "Fluxo de caixa por casa e performance separada por estratégia." },
  { Icon: ScanLine, title: "OCR de bilhete", body: "Escaneie o print e preencha a aposta sem digitar nada." },
];

const FAQS = [
  {
    q: "Banca+ é um site de apostas?",
    a: "Não. Banca+ não aceita apostas nem paga prêmios. É uma ferramenta de gestão e disciplina, um terminal analítico para você controlar sua própria banca.",
  },
  {
    q: "O plano grátis é realmente grátis?",
    a: "Sim, grátis pra sempre. Você controla sua banca com dashboard, diário, risco e estratégias. Os limites são de volume (50 apostas/mês, 2 casas, 90 dias de histórico) e os recursos de IA, OCR e Odds.",
  },
  {
    q: "Preciso colocar cartão pra começar?",
    a: "Não. Você cria conta grátis ou testa direto no modo demonstração, sem cadastro. Só paga se quiser fazer upgrade pro Edge.",
  },
  {
    q: "Meus dados ficam seguros?",
    a: "Seus dados são seus. Ficam sincronizados na sua conta em nuvem, acessíveis em qualquer dispositivo. Não vendemos nem compartilhamos seu histórico.",
  },
  {
    q: "Posso cancelar quando quiser?",
    a: "Sim. O Edge é uma assinatura sem fidelidade. Cancela quando quiser e seus dados continuam no plano grátis.",
  },
];

const FREE_FEATURES: PlanFeature[] = [
  { label: "Dashboard com ROI, lucro e evolução da banca", included: true },
  { label: "Registro manual + Entrada Rápida", included: true },
  { label: "Diário, Extrato e Estratégias", included: true },
  { label: "Risco e Performance básicos", included: true },
  { label: "Até 2 casas · 50 apostas/mês · 90 dias de histórico", included: true },
  { label: "Inteligência por IA", included: false },
  { label: "OCR para escanear bilhete", included: false },
  { label: "Odds, CLV & valor esperado", included: false },
];

const EDGE_FEATURES: PlanFeature[] = [
  { label: "Tudo do Controle, sem limites", included: true },
  { label: "Inteligência por IA: portfólio, tilt e sugestões", included: true },
  { label: "OCR para escanear o bilhete em vez de digitar", included: true },
  { label: "Odds, CLV & Edge e valor esperado", included: true },
  { label: "Risco avançado com hard stops", included: true },
  { label: "Relatórios avançados + export CSV/PDF", included: true },
  { label: "Casas, apostas e histórico ilimitados", included: true },
];

export function Landing({ onGetStarted, onSignIn, onDemo, onJoinWaitlist }: LandingProps) {
  const [waitlistOpen, setWaitlistOpen] = useState(false);
  const [waitEmail, setWaitEmail] = useState("");
  const [waitStatus, setWaitStatus] = useState<"idle" | "sending" | "done" | "error">("idle");

  async function submitWaitlist(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (waitStatus === "sending") return;
    setWaitStatus("sending");
    try {
      await onJoinWaitlist(waitEmail);
      setWaitStatus("done");
    } catch {
      setWaitStatus("error");
    }
  }

  function openWaitlist() {
    setWaitStatus("idle");
    setWaitEmail("");
    setWaitlistOpen(true);
  }

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

      {/* Hero */}
      <section className="lp-hero">
        <p className="lp-eyebrow">Terminal analítico para apostadores</p>
        <h1 className="lp-hero-title">
          Pare de só registrar.<br />
          <span className="lp-hero-accent">Comece a ganhar vantagem.</span>
        </h1>
        <p className="lp-hero-sub">
          Banca+ não é um cassino. É onde você controla banca, risco e edge num só lugar,
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

      {/* A dor */}
      <section className="lp-section lp-pains">
        <div className="lp-section-head">
          <p className="lp-eyebrow">O problema</p>
          <h2 className="lp-section-title">Apostar no escuro custa caro.</h2>
        </div>
        <div className="lp-pain-grid">
          {PAINS.map((p) => (
            <article key={p.title} className="lp-pain-card">
              <span className="lp-pain-icon"><p.Icon size={20} /></span>
              <h3>{p.title}</h3>
              <p>{p.body}</p>
            </article>
          ))}
        </div>
      </section>

      {/* Como funciona */}
      <section className="lp-section lp-steps">
        <div className="lp-section-head">
          <p className="lp-eyebrow">Como funciona</p>
          <h2 className="lp-section-title">Do bilhete ao edge, em três passos.</h2>
        </div>
        <div className="lp-step-grid">
          {STEPS.map((s) => (
            <article key={s.step} className="lp-step-card">
              <div className="lp-step-top">
                <span className="lp-step-num">{s.step}</span>
                <span className="lp-step-icon"><s.Icon size={18} /></span>
              </div>
              <h3>{s.title}</h3>
              <p>{s.body}</p>
            </article>
          ))}
        </div>
      </section>

      {/* IA em destaque */}
      <section className="lp-section lp-ai">
        <div className="lp-ai-inner">
          <div className="lp-ai-copy">
            <p className="lp-eyebrow"><Brain size={13} /> Inteligência</p>
            <h2 className="lp-section-title">A IA te diz onde você está errando.</h2>
            <p className="lp-section-sub">
              Análise automática do seu portfólio: detecta tilt, aponta estratégias furadas,
              mede eficiência de execução e sugere ajustes. É o copiloto que apostador amador não tem.
            </p>
            <ul className="lp-ai-list">
              <li><Check size={15} /> Detecção de tilt e padrões de risco</li>
              <li><Check size={15} /> Insights de estratégia e execução</li>
              <li><Check size={15} /> Sugestões acionáveis por aposta</li>
            </ul>
            <button type="button" className="lp-btn lp-btn-primary" onClick={onGetStarted}>
              Ver minha análise com IA <ArrowRight size={16} />
            </button>
          </div>
          <div className="lp-ai-visual" aria-hidden="true">
            <div className="lp-ai-chip"><Brain size={14} /> Análise de portfólio</div>
            <div className="lp-ai-row"><span>Risco de tilt</span><strong className="warn">Atenção</strong></div>
            <div className="lp-ai-row"><span>CLV médio</span><strong className="pos">+2,3%</strong></div>
            <div className="lp-ai-row"><span>Estratégia mais eficiente</span><strong>Over 2.5 FT</strong></div>
            <div className="lp-ai-bar"><span style={{ width: "72%" }} /></div>
            <p className="lp-ai-tip">Stake média 18% acima do recomendado nos últimos 7 dias.</p>
          </div>
        </div>
      </section>

      {/* Features grid */}
      <section className="lp-section lp-features">
        <div className="lp-section-head">
          <p className="lp-eyebrow">Tudo num só lugar</p>
          <h2 className="lp-section-title">O terminal completo do apostador.</h2>
        </div>
        <div className="lp-feat-grid">
          {FEATURES.map((f) => (
            <article key={f.title} className="lp-feat-card">
              <span className="lp-feat-icon"><f.Icon size={18} /></span>
              <h3>{f.title}</h3>
              <p>{f.body}</p>
            </article>
          ))}
        </div>
      </section>

      {/* Planos */}
      <section className="lp-section lp-pricing" id="planos">
        <div className="lp-section-head">
          <p className="lp-eyebrow">Planos</p>
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
            <span className="lp-plan-badge"><Zap size={12} /> Em breve</span>
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
            <button type="button" className="lp-btn lp-btn-primary lp-btn-block" onClick={openWaitlist}>
              <Clock size={15} /> Entrar na lista de espera
            </button>
            <p className="lp-plan-note">Em construção. Entre na lista e avisamos quando o Edge lançar.</p>
          </article>
        </div>
      </section>

      {/* Privacidade + jogo responsável */}
      <section className="lp-section lp-trust">
        <div className="lp-trust-grid">
          <article className="lp-trust-card">
            <span className="lp-trust-icon"><ShieldCheck size={20} /></span>
            <h3>Seus dados são seus</h3>
            <p>Histórico sincronizado na sua conta, acessível em qualquer dispositivo. Não vendemos nem compartilhamos nada.</p>
          </article>
          <article className="lp-trust-card">
            <span className="lp-trust-icon"><ShieldAlert size={20} /></span>
            <h3>Ferramenta de disciplina</h3>
            <p>Banca+ não incentiva apostar mais, e sim apostar melhor. Hard stops e limites existem pra proteger sua banca.</p>
          </article>
        </div>
      </section>

      {/* FAQ */}
      <section className="lp-section lp-faq">
        <div className="lp-section-head">
          <p className="lp-eyebrow">Dúvidas</p>
          <h2 className="lp-section-title">Perguntas frequentes</h2>
        </div>
        <div className="lp-faq-list">
          {FAQS.map((f) => (
            <details key={f.q} className="lp-faq-item">
              <summary>{f.q}</summary>
              <p>{f.a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* CTA final */}
      <section className="lp-section lp-cta-final">
        <h2 className="lp-section-title">Pronto pra apostar com método?</h2>
        <p className="lp-section-sub">Crie sua conta grátis em segundos. Sem cartão, sem compromisso.</p>
        <div className="lp-hero-cta">
          <button type="button" className="lp-btn lp-btn-primary" onClick={onGetStarted}>
            Criar conta grátis <ArrowRight size={16} />
          </button>
          <button type="button" className="lp-btn lp-btn-ghost" onClick={onDemo}>
            Testar sem conta
          </button>
        </div>
      </section>

      <footer className="lp-foot">
        <BrandLogo compact />
        <span className="lp-foot-copy">Ferramenta de disciplina e gestão. Aposte com responsabilidade.</span>
      </footer>

      {waitlistOpen && (
        <div className="lp-wait-overlay" onClick={() => setWaitlistOpen(false)}>
          <div className="lp-wait-modal" onClick={(e) => e.stopPropagation()}>
            <button type="button" className="lp-wait-close" onClick={() => setWaitlistOpen(false)} aria-label="Fechar">
              <X size={16} />
            </button>
            {waitStatus === "done" ? (
              <div className="lp-wait-done">
                <span className="lp-wait-icon ok"><Check size={22} /></span>
                <h3>Você está na lista!</h3>
                <p>Avisamos no seu email assim que o Edge lançar. Enquanto isso, use o plano Controle de graça.</p>
                <button type="button" className="lp-btn lp-btn-primary lp-btn-block" onClick={() => { setWaitlistOpen(false); onGetStarted(); }}>
                  Criar conta grátis agora
                </button>
              </div>
            ) : (
              <form className="lp-wait-form" onSubmit={submitWaitlist}>
                <span className="lp-wait-icon"><Clock size={20} /></span>
                <h3>Edge está chegando</h3>
                <p>IA, OCR, Odds e CLV ilimitados. Deixe seu email e avisamos quando lançar.</p>
                <input
                  type="email"
                  required
                  placeholder="seu@email.com"
                  className="lp-wait-input"
                  value={waitEmail}
                  onChange={(e) => setWaitEmail(e.target.value)}
                  disabled={waitStatus === "sending"}
                />
                {waitStatus === "error" && (
                  <span className="lp-wait-err">Não foi possível registrar. Tente de novo.</span>
                )}
                <button type="submit" className="lp-btn lp-btn-primary lp-btn-block" disabled={waitStatus === "sending"}>
                  {waitStatus === "sending" ? "Enviando…" : "Entrar na lista de espera"}
                </button>
                <span className="lp-wait-foot">Sem spam. Só o aviso de lançamento.</span>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
