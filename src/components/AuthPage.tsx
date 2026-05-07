import { FormEvent, useState } from "react";
import { BrandLogo } from "./BrandLogo";

type AuthMode = "signin" | "signup" | "reset";

interface AuthPageProps {
  onSignIn: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  onSignUp: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  onReset: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  onDemoMode: () => void;
  message: string;
}

export function AuthPage({ onSignIn, onSignUp, onReset, onDemoMode, message }: AuthPageProps) {
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
          Usar modo demo local
          <small>Sem cadastro — dados salvos apenas neste dispositivo</small>
        </button>
      </div>

      <div className="auth-page-features">
        <h2>Controle total da sua banca</h2>
        <ul>
          <li>
            <span className="feature-icon">📊</span>
            <div>
              <strong>Dashboard com gráficos reais</strong>
              <small>Evolução da banca, ROI mensal e distribuição por esporte</small>
            </div>
          </li>
          <li>
            <span className="feature-icon">🧠</span>
            <div>
              <strong>Análise de IA</strong>
              <small>Insights automáticos sobre estratégias e alertas de risco</small>
            </div>
          </li>
          <li>
            <span className="feature-icon">📈</span>
            <div>
              <strong>CLV &amp; Edge tracking</strong>
              <small>Meça se você está batendo a linha de fechamento</small>
            </div>
          </li>
          <li>
            <span className="feature-icon">☁️</span>
            <div>
              <strong>Sincronização em nuvem</strong>
              <small>Acesse seus dados em qualquer dispositivo</small>
            </div>
          </li>
        </ul>
      </div>
    </div>
  );
}
