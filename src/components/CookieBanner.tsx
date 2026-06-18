import { useState } from "react";

const CONSENT_KEY = "bancamais_cookie_consent";

export type CookieConsent = "all" | "essential";

export function getStoredConsent(): CookieConsent | null {
  try {
    const v = localStorage.getItem(CONSENT_KEY);
    if (v === "all" || v === "essential") return v;
    return null;
  } catch {
    return null;
  }
}

function storeConsent(value: CookieConsent) {
  try {
    localStorage.setItem(CONSENT_KEY, value);
  } catch {
    // ignore
  }
}

interface CookieBannerProps {
  onConsent: (choice: CookieConsent) => void;
}

export function CookieBanner({ onConsent }: CookieBannerProps) {
  const [visible, setVisible] = useState(true);

  function accept(choice: CookieConsent) {
    storeConsent(choice);
    setVisible(false);
    onConsent(choice);
  }

  if (!visible) return null;

  return (
    <div className="cookie-banner" role="dialog" aria-label="Consentimento de cookies">
      <div className="cookie-banner-content">
        <div className="cookie-banner-text">
          <strong>Cookies e armazenamento</strong>
          <p>
            Usamos <b>armazenamento local</b> para salvar seus dados de aposta no navegador (essencial para o funcionamento)
            e <b>Firebase Analytics</b> para entender como a ferramenta é usada e melhorá-la.
            Seus dados de aposta nunca são compartilhados. Veja nossa{" "}
            <a
              href="https://bancamais.com.br/privacidade"
              target="_blank"
              rel="noopener noreferrer"
              className="cookie-link"
            >
              política de privacidade
            </a>.
          </p>
        </div>
        <div className="cookie-banner-actions">
          <button className="cookie-btn-essential" onClick={() => accept("essential")}>
            Apenas essenciais
          </button>
          <button className="cookie-btn-accept primary" onClick={() => accept("all")}>
            Aceitar todos
          </button>
        </div>
      </div>
    </div>
  );
}
