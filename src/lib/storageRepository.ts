import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { storage } from "./firebase";

const EXT_TO_MIME: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
  heic: "image/heic",
  heif: "image/heif",
};

function resolveContentType(file: File, extension: string): string {
  if (file.type && file.type.startsWith("image/")) return file.type;
  return EXT_TO_MIME[extension.toLowerCase()] ?? "image/png";
}

export async function uploadBetSlip(userId: string, file: File) {
  const extension = file.name.split(".").pop() || "png";
  const contentType = resolveContentType(file, extension);
  const path = `users/${userId}/bet-slips/${crypto.randomUUID()}.${extension}`;
  const storageRef = ref(storage, path);
  const snapshot = await uploadBytes(storageRef, file, {
    contentType,
    customMetadata: {
      originalName: file.name,
    },
  });

  return {
    path,
    url: await getDownloadURL(snapshot.ref),
  };
}
