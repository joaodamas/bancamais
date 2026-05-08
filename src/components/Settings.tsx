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
  updateBankrollSettings: (event: FormEvent<HTMLFormElement>) => void;
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
  updateBankrollSettings,
  updateRiskSettings,
}: SettingsProps) {
  const isAnonymous = user?.isAnonymous ?? false;
  const isAuthenticated = user !== null && !isAnonymous;

  return (
    <section className="page">
      <div className="dashboard-command panel settings-command">
        <div className="dashboard-command-copy">
          <span className="dashboard-kicker">Governanca operacional</span>
          <h1>Configuracoes, sincronizacao e risco</h1>
          <p>Gerencie conta, persistencia e limites operacionais em uma camada unica de controle.</p>
        </div>
      </div>

      <div className="ops-summary-grid settings-summary-grid">
        <article className="ops-summary-card">
          <span>Status da conta</span>
          <strong>{isAuthenticated ? "Sincronizada" : isAnonymous ? "Temporaria" : "Local"}</strong>
          <small>{isAuthenticated ? "Operacao vinculada a conta permanente." : "Persistencia depende deste dispositivo."}</small>
        </article>
        <article className="ops-summary-card">
          <span>Unidade da banca</span>
          <strong>{state.riskSettings.unitPercent.toFixed(1)}%</strong>
          <small>Base usada para alertas, stake e governanca.</small>
        </article>
        <article className="ops-summary-card">
          <span>Exposicao maxima</span>
          <strong>{state.riskSettings.maxOpenExposurePercent.toFixed(0)}%</strong>
          <small>Teto atual para risco aberto simultaneo.</small>
        </article>
      </div>

      <div className="settings-layout">
        <article className="panel settings-panel">
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
                  <small>Sessão anônima vinculada ao ambiente atual</small>
                </div>
              </div>
              <p className="sync-description">
                Crie uma conta permanente para vincular esta operação de forma estável ao seu email.
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
                  <strong>Sem sessão autenticada</strong>
                  <small>Entre para ativar sincronização e recuperação de acesso</small>
                </div>
              </div>
              <p className="sync-description">
                Use conta permanente ou sessão temporária para começar a operar.
              </p>
              <div className="actions">
                <button className="primary" onClick={onGoToAuth}>Criar conta ou entrar</button>
              </div>
            </>
          )}
        </article>

        <form className="panel settings-panel risk-settings-form" onSubmit={updateBankrollSettings}>
          <h2>Banca base</h2>
          <p>
            Ajuste o nome operacional da banca e o saldo inicial de referência. Quando você opera com casas cadastradas,
            o saldo corrente continua vindo do ledger e das movimentações.
          </p>
          <div className="risk-settings-grid">
            <label>
              Nome da banca
              <input defaultValue={state.bankrollName} maxLength={60} name="bankrollName" required type="text" />
            </label>
            <label>
              Saldo inicial de referência
              <input defaultValue={state.startingBalance} min="0" name="startingBalance" required step="0.01" type="number" />
            </label>
          </div>
          <button className="primary" type="submit">Salvar banca</button>
        </form>

        <form className="panel risk-settings-form settings-panel" onSubmit={updateRiskSettings}>
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

        <article className="panel danger-zone settings-panel">
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
