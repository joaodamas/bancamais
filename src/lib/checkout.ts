import { getFunctions, httpsCallable } from "firebase/functions";
import { firebaseApp } from "./firebase";
import { getStoredUtm } from "./analytics";

const functions = getFunctions(firebaseApp, "southamerica-east1");

interface ProtocoloCheckoutRequest {
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
}

interface ProtocoloCheckoutResponse {
  initPoint: string;
  preferenceId: string;
}

const createProtocoloCheckoutCallable = httpsCallable<ProtocoloCheckoutRequest, ProtocoloCheckoutResponse>(
  functions,
  "createProtocoloCheckout",
);

/** Cria a preference do Protocolo no Mercado Pago e devolve o link de checkout. */
export async function startProtocoloCheckout(): Promise<string> {
  const utm = getStoredUtm();
  const { data } = await createProtocoloCheckoutCallable({
    utmSource: utm?.source,
    utmMedium: utm?.medium,
    utmCampaign: utm?.campaign,
  });
  return data.initPoint;
}
