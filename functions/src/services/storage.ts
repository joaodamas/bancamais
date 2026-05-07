import { getStorage } from "firebase-admin/storage";
import type { SlipImagePayload } from "../contracts/ocr.js";

const ALLOWED_CONTENT_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

export async function downloadUserSlip(uid: string, storagePath: string): Promise<SlipImagePayload> {
  ensureOwnedPath(uid, storagePath);

  const bucket = getStorage().bucket();
  const file = bucket.file(storagePath);
  const [exists] = await file.exists();
  if (!exists) {
    throw new Error("Slip image not found in Storage.");
  }

  const [metadata] = await file.getMetadata();
  const contentType = metadata.contentType || "application/octet-stream";
  if (!ALLOWED_CONTENT_TYPES.has(contentType)) {
    throw new Error(`Unsupported content type for OCR: ${contentType}`);
  }

  const [buffer] = await file.download();

  return {
    storagePath,
    contentType,
    sizeBytes: Number(metadata.size || buffer.length),
    base64: buffer.toString("base64"),
  };
}

function ensureOwnedPath(uid: string, storagePath: string) {
  const expectedPrefix = `users/${uid}/bet-slips/`;
  if (!storagePath.startsWith(expectedPrefix)) {
    throw new Error("Storage path does not belong to the authenticated user.");
  }
}
