import { FormEvent, useState } from "react";
import { ShieldCheck, TrendingUp, Brain, CloudUpload } from "lucide-react";
import { BrandLogo } from "./BrandLogo";

type AuthMode = "signin" | "signup" | "reset";

interface AuthPageProps {
  onSignIn: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  onSignUp: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  onReset: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  onDemoMode: () => void;
  onGoogleSignIn: () => Promise<void>;
  message: string;
}

const FEATURES = [
  {
    Icon: TrendingUp,
    title: "CLV & Edge tracking",
    description: "Meça se você está batendo a linha de fechamento em cada aposta.",
  },
  {
    Icon: Brain,
    title: "Análise de portfólio",
    description: "Insights automáticos sobre risco, estratégia e eficiência de execução.",
  },
  {
    Icon: ShieldCheck,
    title: "Hard stops e limites de risco",
    description: "Trava automática diária, semanal e mensal para proteger a banca.",
  },
  {
    Icon: CloudUpload,
    title: "Sincronização em nuvem",
    description: "Seus dados em qualquer dispositivo, sempre atualizados.",
  },
];

const STATS = [
  { value: "ROI", label: "rastreado por estratégia" },
  { value: "CLV", label: "vs linha de fechamento" },
  { value: "Hard stop", label: "proteção automática" },
];

export function AuthPage({ onSignIn, onSignUp, onReset, onDemoMode, onGoogleSignIn, message }: AuthPageProps) {
  const [mode, setMode] = useState<AuthMode>("signin");

  return (
    <div className="auth-page">
      <div className="auth-page-panel">
        <div className="auth-page-brand">
          <BrandLogo />
          <p>Gestão profissional de apostas esportivas</p>
        </div>

        <div className="auth-tabs">
          <button
            className={mode === "signin" ? "active" : ""}
            onClick={() => setMode("signin")}
          >
            Entrar
          </button>
          <button
            className={mode === "signup" ? "active" : ""}
            onClick={() => setMode("signup")}
          >
            Criar conta
          </button>
        </div>

        {message && (
          <div className="auth-page-message">{message}</div>
        )}

        <button className="btn-google" type="button" onClick={onGoogleSignIn}>
          <svg className="btn-google-icon" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
          </svg>
          Continuar com Google
        </button>

        <div className="auth-divider">
          <span>ou com email</span>
        </div>

        {mode === "signin" && (
          <form className="auth-page-form" onSubmit={onSignIn}>
            <label>
              Email
              <input name="email" type="email" required placeholder="seu@email.com" autoComplete="email" />
            </label>
            <label>
              Senha
              <input name="password" type="password" required placeholder="••••••••" autoComplete="current-password" />
            </label>
            <button className="primary full-width" type="submit">Entrar</button>
            <button type="button" className="auth-link" onClick={() => setMode("reset")}>
              Esqueci minha senha
            </button>
          </form>
        )}

        {mode === "signup" && (
          <form className="auth-page-form" onSubmit={onSignUp}>
            <label>
              Nome
              <input name="displayName" placeholder="Seu nome" autoComplete="name" />
            </label>
            <label>
              Email
              <input name="email" type="email" required placeholder="seu@email.com" autoComplete="email" />
            </label>
            <label>
              Senha
              <input name="password" type="password" required minLength={6} placeholder="mínimo 6 caracteres" autoComplete="new-password" />
            </label>
            <button className="primary full-width" type="submit">Criar conta</button>
          </form>
        )}

        {mode === "reset" && (
          <form className="auth-page-form" onSubmit={onReset}>
            <p style={{ color: "var(--muted)", fontSize: 13, margin: "0 0 12px" }}>
              Digite seu email para receber o link de recuperação de senha.
            </p>
            <label>
              Email
              <input name="email" type="email" required placeholder="seu@email.com" />
            </label>
            <button className="primary full-width" type="submit">Enviar link</button>
            <button type="button" className="auth-link" onClick={() => setMode("signin")}>
              Voltar ao login
            </button>
          </form>
        )}

        <div className="auth-divider">
          <span>ou</span>
        </div>

        <button className="auth-demo-btn" onClick={onDemoMode}>
          Usar sessão temporária
          <small>Sem cadastro · dados salvos localmente · sem sincronização</small>
        </button>
      </div>

      <div className="auth-page-features">
        <div className="auth-features-inner">
          <p className="auth-features-eyebrow">Terminal analítico para apostadores</p>
          <h2 className="auth-features-title">Controle real.<br />Dados que importam.</h2>
          <p className="auth-features-sub">
            Chega de planilha. Banca+ centraliza apostas, capital, risco e edge em um único lugar — com as métricas que separam apostadores sérios de amadores.
          </p>

          <div className="auth-stats-row">
            {STATS.map((s) => (
              <div key={s.value} className="auth-stat">
                <strong>{s.value}</strong>
                <span>{s.label}</span>
              </div>
            ))}
          </div>

          <ul className="auth-features-list">
            {FEATURES.map(({ Icon, title, description }) => (
              <li key={title} className="auth-feature-item">
                <span className="auth-feature-icon">
                  <Icon size={16} />
                </span>
                <div>
                  <strong>{title}</strong>
                  <small>{description}</small>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
