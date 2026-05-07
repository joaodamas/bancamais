import type { User } from "firebase/auth";
import type { FormEvent } from "react";
import type { AppState } from "../lib/types";

interface SettingsProps {
  state: AppState;
  reset: () => void;
  user: User | null;
  pushCloud: () => Promise<void>;
  pullCloud: () => Promise<void>;
  disconnectCloud: () => Promise<void>;
  onGoToAuth: () => void;
  updateRiskSettings: (event: FormEvent<HTMLFormElement>) => void;
}

function SyncDot({ status }: { status: "online" | "temp" | "offline" }) {
  return <span className={`sync-dot sync-dot-${status}`} aria-hidden="true" />;
}

export function Settings({
  state,
  reset,
  user,
  pushCloud,
  pullCloud,
  disconnectCloud,
  onGoToAuth,
  updateRiskSettings,
}: SettingsProps) {
  const isAnonymous = user?.isAnonymous ?? false;
  const isAuthenticated = user !== null && !isAnonymous;

  return (
    <section className="page">
      <div className="section-head">
        <div>
          <h1>Configurações</h1>
          <p>Sincronização, limites de risco e dados da conta.</p>
        </div>
      </div>

      <div className="settings-layout">
        <article className="panel">
          <h2>Sincronização</h2>

          {isAuthenticated && (
            <>
              <div className="sync-status-row">
                <SyncDot status="online" />
                <div>
                  <strong>Sincronização automática ativa</strong>
                  <small>{user.displayName || user.email}</small>
                </div>
              </div>
              <p className="sync-description">
                Seus dados são salvos automaticamente em até 3 segundos após cada alteração.
              </p>
              <div className="actions">
                <button onClick={pushCloud}>Forçar sincronização</button>
                <button onClick={pullCloud}>Restaurar da nuvem</button>
                <button onClick={disconnectCloud}>Sair da conta</button>
              </div>
            </>
          )}

          {isAnonymous && (
            <>
              <div className="sync-status-row">
                <SyncDot status="temp" />
                <div>
                  <strong>Conta temporária</strong>
                  <small>Seus dados podem ser perdidos se você limpar o navegador</small>
                </div>
              </div>
              <p className="sync-description">
                Crie uma conta para sincronizar sua operação com segurança entre dispositivos.
              </p>
              <div className="actions">
                <button className="primary" onClick={onGoToAuth}>Criar conta permanente</button>
                <button onClick={pushCloud}>Salvar snapshot agora</button>
              </div>
            </>
          )}

          {!user && (
            <>
              <div className="sync-status-row">
                <SyncDot status="offline" />
                <div>
                  <strong>Operação local</strong>
                  <small>Dados salvos apenas neste dispositivo</small>
                </div>
              </div>
              <p className="sync-description">
                Entre com sua conta para ativar a sincronização automática entre dispositivos.
              </p>
              <div className="actions">
                <button className="primary" onClick={onGoToAuth}>Criar conta ou entrar</button>
              </div>
            </>
          )}
        </article>

        <form className="panel risk-settings-form" onSubmit={updateRiskSettings}>
          <h2>Limites de risco</h2>
          <p>
            Defina os limites operacionais que orientam alertas e bloqueios de stake.
          </p>
          <div className="risk-settings-grid">
            <label>
              Unidade da banca (%)
              <input defaultValue={state.riskSettings.unitPercent} min="0.1" name="unitPercent" required step="0.1" type="number" />
            </label>
            <label>
              Stake máxima (unidades)
              <input defaultValue={state.riskSettings.maxStakeUnits} min="0.5" name="maxStakeUnits" required step="0.5" type="number" />
            </label>
            <label>
              Exposição aberta máxima (%)
              <input defaultValue={state.riskSettings.maxOpenExposurePercent} min="1" name="maxOpenExposurePercent" required step="1" type="number" />
            </label>
            <label>
              Alerta após perdas seguidas
              <input defaultValue={state.riskSettings.lossStreakLimit} min="1" name="lossStreakLimit" required step="1" type="number" />
            </label>
          </div>
          <button className="primary" type="submit">Salvar limites</button>
        </form>

        <article className="panel danger-zone">
          <h2>Zona de perigo</h2>
          <p>Ações irreversíveis sobre os dados desta sessão.</p>
          <div className="actions">
            <button
              className="btn-danger"
              onClick={() => {
                if (window.confirm("Isso apagará todos os seus dados locais e não pode ser desfeito. Continuar?")) {
                  reset();
                }
              }}
            >
              Restaurar dados demo
            </button>
          </div>
        </article>
      </div>
    </section>
  );
}
