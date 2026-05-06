import type { User } from "firebase/auth";
import type { FormEvent } from "react";
import type { AppState } from "../lib/types";

interface SettingsProps {
  state: AppState;
  reset: () => void;
  user: User | null;
  syncStatus: string;
  connectCloud: () => Promise<void>;
  disconnectCloud: () => Promise<void>;
  pushCloud: () => Promise<void>;
  pullCloud: () => Promise<void>;
  createAccount: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  signInAccount: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  sendReset: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  authMessage: string;
  updateRiskSettings: (event: FormEvent<HTMLFormElement>) => void;
}

export function Settings({
  state,
  reset,
  user,
  syncStatus,
  connectCloud,
  disconnectCloud,
  pushCloud,
  pullCloud,
  createAccount,
  signInAccount,
  sendReset,
  authMessage,
  updateRiskSettings,
}: SettingsProps) {
  return (
    <section className="page">
      <div className="settings-layout">
      <article className="panel">
        <h2>Etapa atual</h2>
        <p>
          Produto <b>Banca+</b>, Firebase <b>bancamais-12778</b>, deploy planejado em
          <b> bancamais.jpproject.com.br</b>.
        </p>
        <p>
          Esta entrega manteve a persistencia local e adicionou sincronizacao opcional com
          Firebase Auth anonimo + Firestore. O proximo passo e trocar anonimo por login real.
        </p>
        <div className="settings-grid">
          <div>
            <span>Status de sync</span>
            <strong>{syncStatus}</strong>
            <small>{user ? `UID: ${user.uid}` : "Nenhum usuario Firebase conectado"}</small>
          </div>
          <div className="actions">
            {user ? (
              <button onClick={disconnectCloud}>Desconectar</button>
            ) : (
              <button onClick={connectCloud}>Conectar Firebase</button>
            )}
            <button onClick={pushCloud}>Salvar na nuvem</button>
            <button onClick={pullCloud}>Carregar da nuvem</button>
            <button onClick={reset}>Restaurar demo</button>
          </div>
        </div>
      </article>

      <article className="panel auth-panel">
        <h2>Conta Banca+</h2>
        <p>
          Use email e senha para criar uma conta real no Firebase Auth. Ao criar ou entrar,
          o app salva/carrega o snapshot do Firestore automaticamente.
        </p>
        <div className="auth-message">{authMessage}</div>

        <div className="auth-grid">
          <form onSubmit={createAccount}>
            <h3>Criar conta</h3>
            <label>Nome<input name="displayName" placeholder="Joao Damas" /></label>
            <label>Email<input name="email" required type="email" placeholder="voce@email.com" /></label>
            <label>Senha<input name="password" required minLength={6} type="password" placeholder="minimo 6 caracteres" /></label>
            <button className="primary" type="submit">Criar e sincronizar</button>
          </form>

          <form onSubmit={signInAccount}>
            <h3>Entrar</h3>
            <label>Email<input name="email" required type="email" placeholder="voce@email.com" /></label>
            <label>Senha<input name="password" required type="password" /></label>
            <button className="primary" type="submit">Entrar</button>
          </form>

          <form onSubmit={sendReset}>
            <h3>Recuperar senha</h3>
            <label>Email<input name="email" required type="email" placeholder="voce@email.com" /></label>
            <button type="submit">Enviar reset</button>
          </form>
        </div>
      </article>

      <form className="panel risk-settings-form" onSubmit={updateRiskSettings}>
        <h2>Limites de risco</h2>
        <p>
          Estes limites alimentam os alertas do dashboard. No futuro, eles tambem podem bloquear
          novas apostas ou exigir cooldown.
        </p>
        <label>Unidade da banca (%)
          <input defaultValue={state.riskSettings.unitPercent} min="0.1" name="unitPercent" required step="0.1" type="number" />
        </label>
        <label>Stake maxima (unidades)
          <input defaultValue={state.riskSettings.maxStakeUnits} min="0.5" name="maxStakeUnits" required step="0.5" type="number" />
        </label>
        <label>Exposicao aberta maxima (%)
          <input defaultValue={state.riskSettings.maxOpenExposurePercent} min="1" name="maxOpenExposurePercent" required step="1" type="number" />
        </label>
        <label>Alerta apos perdas seguidas
          <input defaultValue={state.riskSettings.lossStreakLimit} min="1" name="lossStreakLimit" required step="1" type="number" />
        </label>
        <button className="primary" type="submit">Salvar limites</button>
      </form>
      </div>
    </section>
  );
}
