import type { User } from "firebase/auth";
import { type FormEvent, useState } from "react";
import { callDeleteUserData, callExportUserData } from "../lib/cloudRepository";
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

  const [lgpdExporting, setLgpdExporting] = useState(false);
  const [lgpdDeleting, setLgpdDeleting] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [unitMode, setUnitMode] = useState(state.riskSettings.unitMode);

  async function handleExportData() {
    if (!isAuthenticated) return;
    setLgpdExporting(true);
    try {
      const data = await callExportUserData();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `bancamais-dados-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setLgpdExporting(false);
    }
  }

  async function handleDeleteAccount() {
    if (!isAuthenticated || deleteConfirm !== "EXCLUIR") return;
    setLgpdDeleting(true);
    try {
      await callDeleteUserData(deleteConfirm);
    } finally {
      setLgpdDeleting(false);
      setDeleteConfirm("");
    }
  }

  return (
    <section className="page">
      <div className="section-head">
        <div>
          <h1>Configurações</h1>
          <p>Conta, sincronização e limites de risco</p>
        </div>
      </div>

      <div className="ops-summary-grid settings-summary-grid">
        <article className="ops-summary-card">
          <span>Conta</span>
          <strong>{isAuthenticated ? "Sincronizada" : isAnonymous ? "Temporária" : "Local"}</strong>
          <small>{isAuthenticated ? "Vinculada a conta permanente" : "Dados neste dispositivo"}</small>
        </article>
        <article className="ops-summary-card">
          <span>Unidade da banca</span>
          <strong>
            {state.riskSettings.unitMode === "fixed"
              ? `R$ ${state.riskSettings.unitFixed.toFixed(2)}`
              : `${state.riskSettings.unitPercent.toFixed(1)}%`}
          </strong>
          <small>{state.riskSettings.unitMode === "fixed" ? "valor fixo por unidade" : "base dos alertas de stake"}</small>
        </article>
        <article className="ops-summary-card">
          <span>Exposição máxima</span>
          <strong>{state.riskSettings.maxOpenExposurePercent.toFixed(0)}%</strong>
          <small>teto de risco simultâneo</small>
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
              Modo da unidade
              <select name="unitMode" defaultValue={state.riskSettings.unitMode} onChange={(e) => setUnitMode(e.target.value as typeof unitMode)}>
                <option value="fixed">Valor fixo (R$)</option>
                <option value="percent">% da banca</option>
              </select>
            </label>
            {unitMode === "fixed" ? (
              <label>
                Valor da unidade (R$)
                <input defaultValue={state.riskSettings.unitFixed || ""} min="0" name="unitFixed" step="0.01" type="number" placeholder="Ex: 50.00" />
              </label>
            ) : (
              <label>
                Unidade da banca (%)
                <input defaultValue={state.riskSettings.unitPercent} min="0.1" name="unitPercent" required step="0.1" type="number" />
              </label>
            )}
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

          <div className="settings-hardstop">
            <div className="settings-hardstop-header">
              <div>
                <strong>Hard Stop automático</strong>
                <p>Bloqueia novas apostas quando os limites de perda são atingidos.</p>
              </div>
              <label className="settings-toggle">
                <input
                  type="checkbox"
                  name="hardStopEnabled"
                  defaultChecked={state.riskSettings.hardStopEnabled}
                />
                <span className="settings-toggle-track">
                  <span className="settings-toggle-thumb" />
                </span>
              </label>
            </div>
            <div className="risk-settings-grid">
              <label>
                Limite diário de perda (%)
                <input
                  defaultValue={state.riskSettings.dailyLossLimitPercent}
                  min="1" max="100" name="dailyLossLimitPercent" required step="1" type="number"
                />
                <small>% da banca perdida em 24h para bloquear</small>
              </label>
              <label>
                Limite semanal de perda (%)
                <input
                  defaultValue={state.riskSettings.weeklyLossLimitPercent}
                  min="1" max="100" name="weeklyLossLimitPercent" required step="1" type="number"
                />
                <small>% da banca perdida em 7 dias para bloquear</small>
              </label>
              <label>
                Drawdown mensal máximo (%)
                <input
                  defaultValue={state.riskSettings.monthlyDrawdownPercent}
                  min="1" max="100" name="monthlyDrawdownPercent" required step="1" type="number"
                />
                <small>% da banca perdida em 30 dias para bloquear</small>
              </label>
            </div>
          </div>

          <button className="primary" type="submit">Salvar limites</button>
        </form>

        {isAuthenticated && (
          <article className="panel settings-panel">
            <h2>Dados e privacidade</h2>
            <p className="sync-description">
              Seus direitos sob a LGPD: exportar uma cópia completa dos seus dados ou excluir sua conta permanentemente.
            </p>
            <div className="lgpd-actions">
              <div className="lgpd-action-row">
                <div>
                  <strong>Exportar meus dados</strong>
                  <small>Baixa um JSON com apostas, transações, logs de auditoria e lista de arquivos.</small>
                </div>
                <button onClick={handleExportData} disabled={lgpdExporting}>
                  {lgpdExporting ? "Exportando..." : "Exportar JSON"}
                </button>
              </div>
              <div className="lgpd-action-row lgpd-action-delete">
                <div>
                  <strong>Excluir conta e dados</strong>
                  <small>Remove todos os dados do Firestore, Storage e a conta de autenticação. Irreversível.</small>
                </div>
                <div className="lgpd-delete-confirm">
                  <input
                    placeholder='Digite "EXCLUIR" para confirmar'
                    value={deleteConfirm}
                    onChange={(e) => setDeleteConfirm(e.target.value)}
                  />
                  <button
                    className="btn-danger"
                    disabled={deleteConfirm !== "EXCLUIR" || lgpdDeleting}
                    onClick={handleDeleteAccount}
                  >
                    {lgpdDeleting ? "Excluindo..." : "Excluir conta"}
                  </button>
                </div>
              </div>
            </div>
          </article>
        )}

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
