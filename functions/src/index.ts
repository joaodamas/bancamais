import { getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { logger } from "firebase-functions";
import { defineSecret } from "firebase-functions/params";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import type {
  EstimateEdgeRequest,
  FetchClosingOddsRequest,
  FetchTeamNewsRequest,
  GetSportsFixtureResultRequest,
  GetTeamContextRequest,
  SearchSportsFixturesRequest,
} from "./contracts/externalData.js";
import type { ParseBetSlipRequest } from "./contracts/ocr.js";
import { AnthropicOcrClient } from "./services/anthropicOcr.js";
import { buildFailedResponse, buildNotConfiguredResponse, mapProviderPayload } from "./services/ocrMapper.js";
import { fetchTeamNews } from "./services/teamNews.js";
import { getSportsFixtureResult, searchSportsFixtures } from "./services/sportsData.js";
import { fetchClosingOddsForBets } from "./services/oddsData.js";
import { getTeamContext } from "./services/teamContext.js";
import { estimateEdge } from "./services/edgeEstimator.js";
import { downloadUserSlip } from "./services/storage.js";

if (getApps().length === 0) {
  initializeApp();
}

const ANTHROPIC_API_KEY = defineSecret("ANTHROPIC_API_KEY");
const APISPORTS_API_KEY = defineSecret("APISPORTS_API_KEY");
const GNEWS_API_KEY = defineSecret("GNEWS_API_KEY");
const THEODDS_API_KEY = defineSecret("THEODDS_API_KEY");
const DEFAULT_REGION = "southamerica-east1";

export const parseBetSlipFromStorage = onCall(
  {
    region: DEFAULT_REGION,
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

export const searchSportsFixturesCallable = onCall(
  {
    region: DEFAULT_REGION,
    timeoutSeconds: 15,
    memory: "256MiB",
    secrets: [APISPORTS_API_KEY],
  },
  async (request) => {
    ensureAuthenticated(request.auth?.uid);
    const payload = parseSearchSportsFixturesRequest(request.data);
    const apiKey = APISPORTS_API_KEY.value();

    if (!apiKey) {
      logger.warn("APISPORTS_API_KEY is not configured.");
      return [];
    }

    try {
      return await searchSportsFixtures(apiKey, payload.query, payload.limit);
    } catch (error) {
      logger.error("Sports fixture search failed", {
        query: payload.query,
        error,
      });
      throw new HttpsError("internal", "Sports fixture search failed.");
    }
  },
);

export const getSportsFixtureResultCallable = onCall(
  {
    region: DEFAULT_REGION,
    timeoutSeconds: 15,
    memory: "256MiB",
    secrets: [APISPORTS_API_KEY],
  },
  async (request) => {
    ensureAuthenticated(request.auth?.uid);
    const payload = parseGetSportsFixtureResultRequest(request.data);
    const apiKey = APISPORTS_API_KEY.value();

    if (!apiKey) {
      logger.warn("APISPORTS_API_KEY is not configured.");
      return null;
    }

    try {
      return await getSportsFixtureResult(apiKey, payload.fixtureId);
    } catch (error) {
      logger.error("Sports fixture result lookup failed", {
        fixtureId: payload.fixtureId,
        error,
      });
      throw new HttpsError("internal", "Sports fixture result lookup failed.");
    }
  },
);

export const fetchTeamNewsCallable = onCall(
  {
    region: DEFAULT_REGION,
    timeoutSeconds: 15,
    memory: "256MiB",
    secrets: [GNEWS_API_KEY],
  },
  async (request) => {
    ensureAuthenticated(request.auth?.uid);
    const payload = parseFetchTeamNewsRequest(request.data);
    const apiKey = GNEWS_API_KEY.value();

    if (!apiKey) {
      logger.warn("GNEWS_API_KEY is not configured.");
      return [];
    }

    try {
      return await fetchTeamNews(apiKey, payload.teamName, payload.maxResults);
    } catch (error) {
      logger.error("Team news lookup failed", {
        teamName: payload.teamName,
        error,
      });
      throw new HttpsError("internal", "Team news lookup failed.");
    }
  },
);

export const getTeamContextCallable = onCall(
  {
    region: DEFAULT_REGION,
    timeoutSeconds: 30,
    memory: "256MiB",
    secrets: [APISPORTS_API_KEY],
  },
  async (request) => {
    ensureAuthenticated(request.auth?.uid);
    const payload = parseGetTeamContextRequest(request.data);
    const apiKey = APISPORTS_API_KEY.value();

    if (!apiKey) {
      logger.warn("APISPORTS_API_KEY is not configured.");
      throw new HttpsError("failed-precondition", "Sports API is not configured.");
    }

    try {
      return await getTeamContext(apiKey, payload.fixtureId);
    } catch (error) {
      logger.error("Team context lookup failed", {
        fixtureId: payload.fixtureId,
        error,
      });
      throw new HttpsError("internal", "Team context lookup failed.");
    }
  },
);

export const estimateEdgeCallable = onCall(
  {
    region: DEFAULT_REGION,
    timeoutSeconds: 30,
    memory: "256MiB",
    secrets: [APISPORTS_API_KEY],
  },
  async (request) => {
    ensureAuthenticated(request.auth?.uid);
    const payload = parseEstimateEdgeRequest(request.data);
    const apiKey = APISPORTS_API_KEY.value();

    if (!apiKey) {
      logger.warn("APISPORTS_API_KEY is not configured.");
      throw new HttpsError("failed-precondition", "Sports API is not configured.");
    }

    try {
      return await estimateEdge(apiKey, payload);
    } catch (error) {
      logger.error("Edge estimation failed", {
        fixtureId: payload.fixtureId,
        market: payload.market,
        error,
      });
      throw new HttpsError("internal", "Edge estimation failed.");
    }
  },
);

export const fetchClosingOddsCallable = onCall(
  {
    region: DEFAULT_REGION,
    timeoutSeconds: 30,
    memory: "256MiB",
    secrets: [THEODDS_API_KEY],
  },
  async (request) => {
    ensureAuthenticated(request.auth?.uid);
    const payload = parseFetchClosingOddsRequest(request.data);
    const apiKey = THEODDS_API_KEY.value();

    if (!apiKey) {
      logger.warn("THEODDS_API_KEY is not configured.");
      return [];
    }

    try {
      return await fetchClosingOddsForBets(apiKey, payload.bets);
    } catch (error) {
      logger.error("Closing odds fetch failed", { error });
      return [];
    }
  },
);

// ── LGPD — exportação e exclusão de dados do usuário ─────────────────────────

export const exportUserData = onCall(
  { region: DEFAULT_REGION, timeoutSeconds: 60, memory: "256MiB" },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) throw new HttpsError("unauthenticated", "Authentication is required.");

    const db = getFirestore();
    const bucket = getStorage().bucket();

    const [appStatesSnap, auditLogsSnap] = await Promise.all([
      db.collection(`users/${uid}/appStates`).get(),
      db.collection(`users/${uid}/auditLogs`).get(),
    ]);

    const [storageFiles] = await bucket.getFiles({ prefix: `users/${uid}/bet-slips/` });

    const payload = {
      exportedAt: new Date().toISOString(),
      uid,
      appStates: appStatesSnap.docs.map((d) => ({ id: d.id, ...d.data() })),
      auditLogs: auditLogsSnap.docs.map((d) => ({ id: d.id, ...d.data() })),
      betSlipFiles: storageFiles.map((f) => f.name),
    };

    logger.info("exportUserData", { uid, appStatesDocs: appStatesSnap.size, auditLogDocs: auditLogsSnap.size, files: storageFiles.length });

    return payload;
  },
);

export const deleteUserData = onCall(
  { region: DEFAULT_REGION, timeoutSeconds: 120, memory: "256MiB" },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) throw new HttpsError("unauthenticated", "Authentication is required.");

    const data = request.data as { confirmText?: string };
    if (data?.confirmText !== "EXCLUIR") {
      throw new HttpsError("invalid-argument", "confirmText deve ser exatamente 'EXCLUIR'.");
    }

    const db = getFirestore();
    const bucket = getStorage().bucket();

    const deleteCollection = async (path: string) => {
      const snap = await db.collection(path).get();
      const batch = db.batch();
      snap.docs.forEach((d) => batch.delete(d.ref));
      if (snap.size > 0) await batch.commit();
    };

    await Promise.all([
      deleteCollection(`users/${uid}/appStates`),
      deleteCollection(`users/${uid}/auditLogs`),
    ]);

    const [files] = await bucket.getFiles({ prefix: `users/${uid}/bet-slips/` });
    await Promise.all(files.map((f) => f.delete()));

    await getAuth().deleteUser(uid);

    logger.info("deleteUserData", { uid });

    return { deleted: true };
  },
);

// ─────────────────────────────────────────────────────────────────────────────

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

function ensureAuthenticated(uid: string | undefined) {
  if (!uid) {
    throw new HttpsError("unauthenticated", "Authentication is required.");
  }
}

function parseSearchSportsFixturesRequest(data: unknown): Required<SearchSportsFixturesRequest> {
  if (!data || typeof data !== "object") {
    throw new HttpsError("invalid-argument", "Request payload must be an object.");
  }

  const query = Reflect.get(data, "query");
  const limit = Reflect.get(data, "limit");

  if (typeof query !== "string" || query.trim().length < 3 || query.trim().length > 80) {
    throw new HttpsError("invalid-argument", "query must be a string between 3 and 80 characters.");
  }

  if (limit != null && (!Number.isInteger(limit) || Number(limit) < 1 || Number(limit) > 10)) {
    throw new HttpsError("invalid-argument", "limit must be an integer between 1 and 10.");
  }

  return {
    query: query.trim(),
    limit: typeof limit === "number" ? limit : 8,
  };
}

function parseGetSportsFixtureResultRequest(data: unknown): GetSportsFixtureResultRequest {
  if (!data || typeof data !== "object") {
    throw new HttpsError("invalid-argument", "Request payload must be an object.");
  }

  const fixtureId = Reflect.get(data, "fixtureId");

  if (!Number.isInteger(fixtureId) || Number(fixtureId) <= 0) {
    throw new HttpsError("invalid-argument", "fixtureId must be a positive integer.");
  }

  return {
    fixtureId: Number(fixtureId),
  };
}

function parseFetchTeamNewsRequest(data: unknown): Required<FetchTeamNewsRequest> {
  if (!data || typeof data !== "object") {
    throw new HttpsError("invalid-argument", "Request payload must be an object.");
  }

  const teamName = Reflect.get(data, "teamName");
  const maxResults = Reflect.get(data, "maxResults");

  if (typeof teamName !== "string" || teamName.trim().length < 2 || teamName.trim().length > 80) {
    throw new HttpsError("invalid-argument", "teamName must be a string between 2 and 80 characters.");
  }

  if (
    maxResults != null &&
    (!Number.isInteger(maxResults) || Number(maxResults) < 1 || Number(maxResults) > 5)
  ) {
    throw new HttpsError("invalid-argument", "maxResults must be an integer between 1 and 5.");
  }

  return {
    teamName: teamName.trim(),
    maxResults: typeof maxResults === "number" ? maxResults : 3,
  };
}

function parseGetTeamContextRequest(data: unknown): GetTeamContextRequest {
  if (!data || typeof data !== "object") {
    throw new HttpsError("invalid-argument", "Request payload must be an object.");
  }

  const fixtureId = Reflect.get(data, "fixtureId");

  if (!Number.isInteger(fixtureId) || Number(fixtureId) <= 0) {
    throw new HttpsError("invalid-argument", "fixtureId must be a positive integer.");
  }

  return { fixtureId: Number(fixtureId) };
}

function parseEstimateEdgeRequest(data: unknown): EstimateEdgeRequest {
  if (!data || typeof data !== "object") {
    throw new HttpsError("invalid-argument", "Request payload must be an object.");
  }

  const fixtureId = Reflect.get(data, "fixtureId");
  const market = Reflect.get(data, "market");
  const selection = Reflect.get(data, "selection");
  const odds = Reflect.get(data, "odds");

  if (!Number.isInteger(fixtureId) || Number(fixtureId) <= 0) {
    throw new HttpsError("invalid-argument", "fixtureId must be a positive integer.");
  }

  if (typeof market !== "string" || market.trim().length === 0) {
    throw new HttpsError("invalid-argument", "market must be a non-empty string.");
  }

  if (typeof selection !== "string" || selection.trim().length === 0) {
    throw new HttpsError("invalid-argument", "selection must be a non-empty string.");
  }

  if (typeof odds !== "number" || odds <= 1) {
    throw new HttpsError("invalid-argument", "odds must be a number greater than 1.");
  }

  return {
    fixtureId: Number(fixtureId),
    market: market.trim(),
    selection: selection.trim(),
    odds,
  };
}

function parseFetchClosingOddsRequest(data: unknown): FetchClosingOddsRequest {
  if (!data || typeof data !== "object") {
    throw new HttpsError("invalid-argument", "Request payload must be an object.");
  }

  const bets = Reflect.get(data, "bets");
  if (!Array.isArray(bets) || bets.length === 0) {
    throw new HttpsError("invalid-argument", "bets must be a non-empty array.");
  }
  if (bets.length > 50) {
    throw new HttpsError("invalid-argument", "bets must contain at most 50 items.");
  }

  const parsed = bets.map((raw, index) => {
    if (!raw || typeof raw !== "object") {
      throw new HttpsError("invalid-argument", `bets[${index}] must be an object.`);
    }

    const betId = Reflect.get(raw, "betId");
    const sport = Reflect.get(raw, "sport");
    const league = Reflect.get(raw, "league");
    const eventName = Reflect.get(raw, "eventName");
    const selection = Reflect.get(raw, "selection");
    const eventAt = Reflect.get(raw, "eventAt");

    if (typeof betId !== "string" || betId.length === 0) {
      throw new HttpsError("invalid-argument", `bets[${index}].betId is required.`);
    }
    if (typeof eventName !== "string" || eventName.length === 0) {
      throw new HttpsError("invalid-argument", `bets[${index}].eventName is required.`);
    }
    if (typeof selection !== "string" || selection.length === 0) {
      throw new HttpsError("invalid-argument", `bets[${index}].selection is required.`);
    }
    if (typeof eventAt !== "string" || eventAt.length === 0) {
      throw new HttpsError("invalid-argument", `bets[${index}].eventAt is required.`);
    }

    return {
      betId,
      sport: typeof sport === "string" ? sport : "",
      league: typeof league === "string" ? league : "",
      eventName,
      selection,
      eventAt,
    };
  });

  return { bets: parsed };
}
