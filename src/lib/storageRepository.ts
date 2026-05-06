import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { storage } from "./firebase";

export async function uploadBetSlip(userId: string, file: File) {
  const extension = file.name.split(".").pop() || "png";
  const path = `users/${userId}/bet-slips/${crypto.randomUUID()}.${extension}`;
  const storageRef = ref(storage, path);
  const snapshot = await uploadBytes(storageRef, file, {
    contentType: file.type,
    customMetadata: {
      originalName: file.name,
    },
  });

  return {
    path,
    url: await getDownloadURL(snapshot.ref),
  };
}
