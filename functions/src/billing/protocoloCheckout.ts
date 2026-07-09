/**
 * Checkout de PAGAMENTO ÚNICO do infoproduto "Protocolo de Gestão de Banca"
 * (R$ 47) via Mercado Pago Checkout Pro.
 *
 * Exporta um único handler Firebase Functions v2:
 *   - `createProtocoloCheckout` (onCall) → cria uma preference de Checkout Pro e
 *                                          devolve o `init_point` + `preferenceId`.
 *
 * ── Secret ──────────────────────────────────────────────────────────────────
 * Reutiliza o access token da Mercado Pago já usado pela assinatura recorrente:
 *
 *   firebase functions:secrets:set MERCADOPAGO_ACCESS_TOKEN
 *
 * Enquanto o secret não estiver configurado, a função falha com mensagem clara
 * (comportamento esperado de "ativar depois").
 */

import { logger } from "firebase-functions";
import { defineSecret } from "firebase-functions/params";
import { HttpsError, onCall } from "firebase-functions/v2/https";

const MERCADOPAGO_ACCESS_TOKEN = defineSecret("MERCADOPAGO_ACCESS_TOKEN");
const DEFAULT_REGION = "southamerica-east1";

const MP_PREFERENCES_URL = "https://api.mercadopago.com/checkout/preferences";

const PROTOCOLO_PRICE_BRL = 47;
const PROTOCOLO_TITLE = "Protocolo de Gestão de Banca";
const PROTOCOLO_CURRENCY = "BRL";

/**
 * Base URL do app usada para montar as `back_urls` do checkout.
 * Sobrescreva via env var `APP_BASE_URL` se necessário.
 */
const DEFAULT_APP_BASE_URL = "https://bancamais.jpproject.com.br";

interface CreatePreferenceResponse {
  id?: string;
  init_point?: string;
  sandbox_init_point?: string;
}

interface ProtocoloCheckoutData {
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
}

/**
 * Cria uma preference de Checkout Pro na Mercado Pago para o pagamento único do
 * Protocolo de Gestão de Banca e devolve o link de checkout.
 */
export const createProtocoloCheckout = onCall(
  {
    region: DEFAULT_REGION,
    timeoutSeconds: 30,
    memory: "256MiB",
    secrets: [MERCADOPAGO_ACCESS_TOKEN],
  },
  async (request): Promise<{ initPoint: string; preferenceId: string }> => {
    const uid = ensureAuthenticated(request.auth?.uid);
    const accessToken = MERCADOPAGO_ACCESS_TOKEN.value();

    if (!accessToken) {
      logger.error("MERCADOPAGO_ACCESS_TOKEN is not configured.");
      throw new HttpsError("failed-precondition", "Billing provider is not configured.");
    }

    const utm = readUtm(request.data);
    const baseUrl = readAppBaseUrl();

    const metadata: Record<string, unknown> = { product: "protocolo", uid };
    if (utm.utmSource) metadata.utmSource = utm.utmSource;
    if (utm.utmMedium) metadata.utmMedium = utm.utmMedium;
    if (utm.utmCampaign) metadata.utmCampaign = utm.utmCampaign;

    const body: Record<string, unknown> = {
      items: [
        {
          title: PROTOCOLO_TITLE,
          quantity: 1,
          unit_price: PROTOCOLO_PRICE_BRL,
          currency_id: PROTOCOLO_CURRENCY,
        },
      ],
      external_reference: uid,
      metadata,
      back_urls: {
        success: `${baseUrl}/app?checkout=success`,
        failure: `${baseUrl}/app?checkout=failure`,
        pending: `${baseUrl}/app?checkout=pending`,
      },
      auto_return: "approved",
      // TODO: webhook de fulfillment do Protocolo (conceder Founder) em etapa futura
    };

    let response: Response;
    try {
      response = await fetch(MP_PREFERENCES_URL, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify(body),
      });
    } catch (error) {
      logger.error("Mercado Pago preference request failed to send", { uid, error });
      throw new HttpsError("unavailable", "Could not reach the billing provider.");
    }

    if (!response.ok) {
      const errorBody = await response.text();
      logger.error("Mercado Pago preference creation failed", {
        uid,
        status: response.status,
        errorBody,
      });
      throw new HttpsError("internal", "Could not create the checkout.");
    }

    const payload = (await response.json()) as CreatePreferenceResponse;

    if (!payload.init_point || !payload.id) {
      logger.error("Mercado Pago preference response missing init_point/id", { uid, payload });
      throw new HttpsError("internal", "Billing provider returned an invalid checkout.");
    }

    logger.info("Mercado Pago Protocolo preference created", {
      uid,
      preferenceId: payload.id,
    });

    return { initPoint: payload.init_point, preferenceId: payload.id };
  },
);

function ensureAuthenticated(uid: string | undefined): string {
  if (!uid) {
    throw new HttpsError("unauthenticated", "Authentication is required.");
  }
  return uid;
}

function readUtm(data: unknown): ProtocoloCheckoutData {
  if (!data || typeof data !== "object") {
    return {};
  }

  const readField = (key: keyof ProtocoloCheckoutData): string | undefined => {
    const candidate = Reflect.get(data, key);
    return typeof candidate === "string" && candidate.length > 0 ? candidate : undefined;
  };

  return {
    utmSource: readField("utmSource"),
    utmMedium: readField("utmMedium"),
    utmCampaign: readField("utmCampaign"),
  };
}

function readAppBaseUrl(): string {
  const envUrl = process.env.APP_BASE_URL;
  if (typeof envUrl === "string" && envUrl.startsWith("https://")) {
    return envUrl.replace(/\/+$/, "");
  }
  return DEFAULT_APP_BASE_URL;
}
