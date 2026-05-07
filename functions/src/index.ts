import { getApps, initializeApp } from "firebase-admin/app";
import { logger } from "firebase-functions";
import { defineSecret } from "firebase-functions/params";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import type { ParseBetSlipRequest } from "./contracts/ocr.js";
import { AnthropicOcrClient } from "./services/anthropicOcr.js";
import { buildFailedResponse, buildNotConfiguredResponse, mapProviderPayload } from "./services/ocrMapper.js";
import { downloadUserSlip } from "./services/storage.js";

if (getApps().length === 0) {
  initializeApp();
}

const ANTHROPIC_API_KEY = defineSecret("ANTHROPIC_API_KEY");

export const parseBetSlipFromStorage = onCall(
  {
    region: "southamerica-east1",
    timeoutSeconds: 60,
    memory: "512MiB",
    secrets: [ANTHROPIC_API_KEY],
  },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) {
      throw new HttpsError("unauthenticated", "Authentication is required.");
    }

    const payload = parseRequest(request.data);
    const slip = await downloadUserSlip(uid, payload.storagePath);
    const client = new AnthropicOcrClient(ANTHROPIC_API_KEY.value());

    if (!client.isConfigured()) {
      return buildNotConfiguredResponse(slip);
    }

    try {
      const result = await client.extractSlip(slip);
      return mapProviderPayload(slip, result.requestId, result.payload);
    } catch (error) {
      logger.error("OCR extraction failed", {
        uid,
        storagePath: payload.storagePath,
        error,
      });

      return buildFailedResponse(
        slip,
        `failed-${Date.now()}`,
        error instanceof Error ? error.message : "Unknown OCR provider error.",
      );
    }
  },
);

function parseRequest(data: unknown): ParseBetSlipRequest {
  if (!data || typeof data !== "object") {
    throw new HttpsError("invalid-argument", "Request payload must be an object.");
  }

  const storagePath = Reflect.get(data, "storagePath");
  const mimeType = Reflect.get(data, "mimeType");
  const source = Reflect.get(data, "source");

  if (typeof storagePath !== "string" || storagePath.length === 0) {
    throw new HttpsError("invalid-argument", "storagePath is required.");
  }

  if (mimeType != null && typeof mimeType !== "string") {
    throw new HttpsError("invalid-argument", "mimeType must be a string when provided.");
  }

  if (source != null && source !== "upload" && source !== "paste" && source !== "camera") {
    throw new HttpsError("invalid-argument", "source must be upload, paste, or camera.");
  }

  return {
    storagePath,
    mimeType: typeof mimeType === "string" ? mimeType : undefined,
    source: source as ParseBetSlipRequest["source"],
  };
}
