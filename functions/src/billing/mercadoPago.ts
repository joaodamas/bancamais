/**
 * Mercado Pago recurring subscription billing for the "edge" plan (R$ 24,90/mês).
 *
 * This module is self-contained and exports two Firebase Functions v2 handlers:
 *   - `createSubscriptionCheckout` (onCall)  → cria um preapproval e devolve a URL de checkout.
 *   - `mercadoPagoWebhook`        (onRequest) → recebe notificações da Mercado Pago e
 *                                               sincroniza o entitlement do usuário.
 *
 * ── Secret ──────────────────────────────────────────────────────────────────
 * Requer o access token da Mercado Pago, armazenado como secret do Functions:
 *
 *   firebase functions:secrets:set MERCADOPAGO_ACCESS_TOKEN
 *
 * ── Webhook ─────────────────────────────────────────────────────────────────
 * Após o deploy, registre a URL HTTPS da função `mercadoPagoWebhook` no painel da
 * Mercado Pago (Suas integrações → Webhooks), assinando os eventos de
 * `preapproval` / `subscription_preapproval`. O método aceito é POST. A URL tem o
 * formato:
 *
 *   https://southamerica-east1-bancamais-12778.cloudfunctions.net/mercadoPagoWebhook
 *
 * ── Fonte da verdade ────────────────────────────────────────────────────────
 * O entitlement do usuário é gravado em `entitlements/{uid}` (coleção top-level,
 * doc id = uid). Esse documento é a fonte da verdade lida pelo frontend para
 * liberar/bloquear o plano "edge". O webhook sempre responde 200 rapidamente para
 * a Mercado Pago não reprocessar a notificação indefinidamente.
 */

import { createHmac, timingSafeEqual } from "crypto";
import { getApps, initializeApp } from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { logger } from "firebase-functions";
import { defineSecret } from "firebase-functions/params";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { onRequest } from "firebase-functions/v2/https";

const MERCADOPAGO_ACCESS_TOKEN = defineSecret("MERCADOPAGO_ACCESS_TOKEN");
const MERCADOPAGO_WEBHOOK_SECRET = defineSecret("MERCADOPAGO_WEBHOOK_SECRET");
const DEFAULT_REGION = "southamerica-east1";

const MP_PREAPPROVAL_URL = "https://api.mercadopago.com/preapproval";

const PLAN_EDGE = "edge";
const PLAN_FREE = "free";
const EDGE_PLAN_REASON = "Banca+ Edge — assinatura mensal";
const EDGE_PLAN_AMOUNT = 24.9;
const EDGE_PLAN_CURRENCY = "BRL";

/**
 * Para onde o usuário é redirecionado ao concluir o checkout da Mercado Pago.
 * Sobrescreva via env var `APP_BILLING_BACK_URL` se necessário.
 */
const DEFAULT_BACK_URL = "https://bancamais-12778.web.app/configuracoes?billing=mercadopago";

type Plan = typeof PLAN_EDGE | typeof PLAN_FREE;

interface CreatePreapprovalResponse {
  id?: string;
  init_point?: string;
  status?: string;
}

interface PreapprovalDetails {
  id: string;
  status: string;
  external_reference?: string;
}

interface MercadoPagoNotification {
  type?: string;
  action?: string;
  data?: { id?: string };
  id?: string | number;
}

if (getApps().length === 0) {
  initializeApp();
}

/**
 * Cria uma assinatura recorrente (preapproval) na Mercado Pago para o plano "edge"
 * e devolve a URL de checkout (`init_point`).
 */
export const createSubscriptionCheckout = onCall(
  {
    region: DEFAULT_REGION,
    timeoutSeconds: 30,
    memory: "256MiB",
    secrets: [MERCADOPAGO_ACCESS_TOKEN],
  },
  async (request): Promise<{ init_point: string }> => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Authentication is required.");
    }

    const uid = request.auth.uid;
    const accessToken = MERCADOPAGO_ACCESS_TOKEN.value();

    if (!accessToken) {
      logger.error("MERCADOPAGO_ACCESS_TOKEN is not configured.");
      throw new HttpsError("failed-precondition", "Billing provider is not configured.");
    }

    const payerEmail = readPayerEmail(request.data, request.auth.token);
    const backUrl = readBackUrl(request.data);

    const body: Record<string, unknown> = {
      reason: EDGE_PLAN_REASON,
      external_reference: uid,
      back_url: backUrl,
      auto_recurring: {
        frequency: 1,
        frequency_type: "months",
        transaction_amount: EDGE_PLAN_AMOUNT,
        currency_id: EDGE_PLAN_CURRENCY,
      },
      status: "pending",
    };

    if (payerEmail) {
      body.payer_email = payerEmail;
    }

    let response: Response;
    try {
      response = await fetch(MP_PREAPPROVAL_URL, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify(body),
      });
    } catch (error) {
      logger.error("Mercado Pago preapproval request failed to send", { uid, error });
      throw new HttpsError("unavailable", "Could not reach the billing provider.");
    }

    if (!response.ok) {
      const errorBody = await response.text();
      logger.error("Mercado Pago preapproval creation failed", {
        uid,
        status: response.status,
        errorBody,
      });
      throw new HttpsError("internal", "Could not create the subscription checkout.");
    }

    const payload = (await response.json()) as CreatePreapprovalResponse;

    if (!payload.init_point) {
      logger.error("Mercado Pago preapproval response missing init_point", { uid, payload });
      throw new HttpsError("internal", "Billing provider returned an invalid checkout.");
    }

    logger.info("Mercado Pago preapproval created", {
      uid,
      preapprovalId: payload.id,
      status: payload.status,
    });

    return { init_point: payload.init_point };
  },
);

/**
 * Recebe notificações (webhooks) da Mercado Pago e sincroniza o entitlement do
 * usuário em `entitlements/{uid}`. Sempre responde 200 para evitar retentativas.
 */
export const mercadoPagoWebhook = onRequest(
  {
    region: DEFAULT_REGION,
    timeoutSeconds: 30,
    memory: "256MiB",
    secrets: [MERCADOPAGO_ACCESS_TOKEN, MERCADOPAGO_WEBHOOK_SECRET],
  },
  async (req, res) => {
    if (req.method !== "POST") {
      res.status(405).send("Method Not Allowed");
      return;
    }

    const webhookSecret = MERCADOPAGO_WEBHOOK_SECRET.value();
    if (webhookSecret) {
      if (!verifyWebhookSignature(req, webhookSecret)) {
        logger.warn("Mercado Pago webhook signature validation failed");
        res.status(401).send("invalid signature");
        return;
      }
    } else {
      // Sem o secret configurado não há como validar a assinatura. O re-fetch do
      // preapproval na API da Mercado Pago (fetchPreapproval) permanece como
      // defesa em profundidade, mas configure MERCADOPAGO_WEBHOOK_SECRET.
      logger.warn(
        "MERCADOPAGO_WEBHOOK_SECRET not configured; skipping x-signature validation.",
      );
    }

    const notification = (req.body ?? {}) as MercadoPagoNotification;
    const topic = readNotificationTopic(req, notification);

    if (!isPreapprovalTopic(topic)) {
      logger.info("Ignoring Mercado Pago notification (unsupported topic)", { topic });
      res.status(200).send("ignored");
      return;
    }

    const preapprovalId = readPreapprovalId(req, notification);
    if (!preapprovalId) {
      logger.warn("Mercado Pago notification without preapproval id", { topic, body: notification });
      res.status(200).send("ignored");
      return;
    }

    const accessToken = MERCADOPAGO_ACCESS_TOKEN.value();
    if (!accessToken) {
      logger.error("MERCADOPAGO_ACCESS_TOKEN is not configured.");
      res.status(200).send("not-configured");
      return;
    }

    try {
      const details = await fetchPreapproval(preapprovalId, accessToken);

      if (!details) {
        logger.warn("Preapproval not found at Mercado Pago", { preapprovalId });
        res.status(200).send("not-found");
        return;
      }

      const uid = details.external_reference;
      if (!uid) {
        logger.warn("Preapproval has no external_reference (uid)", { preapprovalId });
        res.status(200).send("no-reference");
        return;
      }

      const plan = mapStatusToPlan(details.status);

      await getFirestore().doc(`entitlements/${uid}`).set(
        {
          plan,
          status: details.status,
          source: "mercadopago",
          mpPreapprovalId: details.id,
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true },
      );

      logger.info("Entitlement synced from Mercado Pago", {
        uid,
        preapprovalId: details.id,
        status: details.status,
        plan,
      });

      res.status(200).send("ok");
    } catch (error) {
      logger.error("Failed to process Mercado Pago webhook", { preapprovalId, error });
      // Still respond 200 so MP does not retry indefinitely on transient errors.
      res.status(200).send("error-handled");
    }
  },
);

function readHeaderValue(headers: Record<string, unknown>, name: string): string | undefined {
  const value = headers[name];
  if (typeof value === "string") {
    return value;
  }
  if (Array.isArray(value) && typeof value[0] === "string") {
    return value[0];
  }
  return undefined;
}

/**
 * Valida a assinatura HMAC-SHA256 enviada pela Mercado Pago no header
 * `x-signature` (formato `ts=<timestamp>,v1=<hash>`), usando o `x-request-id`
 * e o `data.id` da query para montar o manifest, conforme a documentação da MP.
 */
function verifyWebhookSignature(
  req: { headers: Record<string, unknown>; query: Record<string, unknown> },
  secret: string,
): boolean {
  const signatureHeader = readHeaderValue(req.headers, "x-signature");
  const requestId = readHeaderValue(req.headers, "x-request-id");

  if (!signatureHeader) {
    return false;
  }

  let ts: string | undefined;
  let v1: string | undefined;
  for (const part of signatureHeader.split(",")) {
    const separatorIndex = part.indexOf("=");
    if (separatorIndex === -1) {
      continue;
    }
    const key = part.slice(0, separatorIndex).trim();
    const value = part.slice(separatorIndex + 1).trim();
    if (key === "ts") {
      ts = value;
    } else if (key === "v1") {
      v1 = value;
    }
  }

  if (!ts || !v1) {
    return false;
  }

  const dataIdRaw = req.query["data.id"] ?? req.query["id"];
  const dataId = typeof dataIdRaw === "string" ? dataIdRaw.toLowerCase() : "";

  let manifest = "";
  if (dataId) {
    manifest += `id:${dataId};`;
  }
  if (requestId) {
    manifest += `request-id:${requestId};`;
  }
  manifest += `ts:${ts};`;

  const expected = createHmac("sha256", secret).update(manifest).digest("hex");
  const expectedBuffer = Buffer.from(expected, "hex");
  const providedBuffer = Buffer.from(v1, "hex");

  if (expectedBuffer.length === 0 || expectedBuffer.length !== providedBuffer.length) {
    return false;
  }

  return timingSafeEqual(expectedBuffer, providedBuffer);
}

async function fetchPreapproval(
  id: string,
  accessToken: string,
): Promise<PreapprovalDetails | null> {
  const response = await fetch(`${MP_PREAPPROVAL_URL}/${encodeURIComponent(id)}`, {
    method: "GET",
    headers: {
      authorization: `Bearer ${accessToken}`,
    },
  });

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Mercado Pago preapproval lookup failed with ${response.status}: ${errorBody}`);
  }

  const body = (await response.json()) as Partial<PreapprovalDetails>;

  if (typeof body.id !== "string" || typeof body.status !== "string") {
    throw new Error("Mercado Pago preapproval response is missing id/status.");
  }

  return {
    id: body.id,
    status: body.status,
    external_reference:
      typeof body.external_reference === "string" ? body.external_reference : undefined,
  };
}

function mapStatusToPlan(status: string): Plan {
  if (status === "authorized") {
    return PLAN_EDGE;
  }
  // "paused" | "cancelled" (and any non-authorized state) → downgrade to free.
  return PLAN_FREE;
}

function isPreapprovalTopic(topic: string | undefined): boolean {
  return topic === "preapproval" || topic === "subscription_preapproval";
}

function readNotificationTopic(
  req: { query: Record<string, unknown> },
  notification: MercadoPagoNotification,
): string | undefined {
  const queryType = req.query["type"] ?? req.query["topic"];
  if (typeof queryType === "string" && queryType.length > 0) {
    return queryType;
  }
  if (typeof notification.type === "string" && notification.type.length > 0) {
    return notification.type;
  }
  return undefined;
}

function readPreapprovalId(
  req: { query: Record<string, unknown> },
  notification: MercadoPagoNotification,
): string | undefined {
  const dataId = notification.data?.id;
  if (typeof dataId === "string" && dataId.length > 0) {
    return dataId;
  }

  if (typeof notification.id === "string" && notification.id.length > 0) {
    return notification.id;
  }
  if (typeof notification.id === "number") {
    return String(notification.id);
  }

  const queryId = req.query["data.id"] ?? req.query["id"];
  if (typeof queryId === "string" && queryId.length > 0) {
    return queryId;
  }

  return undefined;
}

function readPayerEmail(data: unknown, token: Record<string, unknown>): string | undefined {
  if (data && typeof data === "object") {
    const candidate = Reflect.get(data, "payerEmail");
    if (typeof candidate === "string" && candidate.includes("@")) {
      return candidate;
    }
  }

  const tokenEmail = token["email"];
  if (typeof tokenEmail === "string" && tokenEmail.includes("@")) {
    return tokenEmail;
  }

  return undefined;
}

function readBackUrl(data: unknown): string {
  const envUrl = process.env.APP_BILLING_BACK_URL;
  if (typeof envUrl === "string" && envUrl.startsWith("https://")) {
    return envUrl;
  }

  if (data && typeof data === "object") {
    const candidate = Reflect.get(data, "backUrl");
    if (typeof candidate === "string" && candidate.startsWith("https://")) {
      return candidate;
    }
  }

  return DEFAULT_BACK_URL;
}
