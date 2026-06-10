import crypto from "node:crypto";

export interface IpaymuStatusResult {
  paid: boolean;
  /** iPaymu numeric transaction status (Data.Status), if available. */
  status?: number;
  /** Human-readable status from iPaymu (Data.StatusDesc), if available. */
  statusDesc?: string;
  raw: unknown;
  error?: string;
}

/**
 * iPaymu transaction statuses considered "paid".
 *   1 => Berhasil (success)
 *   6 => Berhasil - Unsettled (paid, awaiting settlement) — common for QRIS!
 *   7 => Escrow (paid, held)
 * See ipaymu-memo.md → "Data->Status: 1 atau 6 atau 7".
 */
const PAID_STATUS_CODES = [1, 6, 7];
const PAID_STATUS_WORDS = [
  "berhasil",
  "success",
  "paid",
  "settlement",
  "berhasil - unsettled",
  "escrow",
];

/**
 * Query iPaymu directly for a transaction's status using the v2 signed API.
 *
 * This avoids depending on the webhook/proxy callback chain — given a stored
 * `ipaymu_trx_id`, we ask iPaymu whether the payment succeeded and self-heal
 * the order's `payment_status`.
 *
 * Signature spec (iPaymu v2):
 *   bodyHash     = sha256(jsonBody)            // lowercase hex
 *   stringToSign = "POST:" + VA + ":" + bodyHash + ":" + APIKEY
 *   signature    = hmac_sha256(stringToSign, APIKEY)
 */
export async function checkIpaymuTransaction(
  trxId: string
): Promise<IpaymuStatusResult> {
  const va = process.env.IPAYMU_VA?.trim();
  const apiKey = process.env.IPAYMU_API_KEY?.trim();
  // Production: https://my.ipaymu.com · Sandbox: https://sandbox.ipaymu.com
  const baseUrl = (process.env.IPAYMU_BASE_URL ?? "https://my.ipaymu.com").trim();

  if (!va || !apiKey) {
    return { paid: false, raw: null, error: "IPAYMU_VA or IPAYMU_API_KEY not set" };
  }

  const url = `${baseUrl}/api/v2/transaction`;
  const bodyJson = JSON.stringify({ transactionId: trxId });

  const bodyHash = crypto
    .createHash("sha256")
    .update(bodyJson)
    .digest("hex")
    .toLowerCase();
  const stringToSign = `POST:${va}:${bodyHash}:${apiKey}`;
  const signature = crypto
    .createHmac("sha256", apiKey)
    .update(stringToSign)
    .digest("hex");
  const timestamp = new Date()
    .toISOString()
    .replace(/[-:T.Z]/g, "")
    .slice(0, 14);

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        va,
        signature,
        timestamp,
      },
      body: bodyJson,
    });

    const data = await res.json().catch(() => null);
    const d = (data as { Data?: Record<string, unknown> } | null)?.Data ?? {};

    // iPaymu returns Data.Status as a number (e.g. 1, 6, 7). Some flows also
    // expose StatusCode / StatusDesc — handle all of them defensively.
    const statusNum = Number(d.Status ?? d.StatusCode);
    const statusDesc = String(d.StatusDesc ?? d.Status ?? "")
      .trim()
      .toLowerCase();

    const paid =
      (Number.isFinite(statusNum) && PAID_STATUS_CODES.includes(statusNum)) ||
      PAID_STATUS_WORDS.includes(statusDesc);

    // If the top-level Status isn't 200, the request itself failed (e.g. 401
    // unauthorized signature). Surface that as an error so it's visible.
    const topStatus = (data as { Status?: number } | null)?.Status;
    const error =
      topStatus && topStatus !== 200
        ? `iPaymu API returned Status ${topStatus}: ${
            (data as { Message?: string } | null)?.Message ?? "unknown"
          }`
        : undefined;

    return {
      paid,
      status: Number.isFinite(statusNum) ? statusNum : undefined,
      statusDesc: statusDesc || undefined,
      raw: data,
      error,
    };
  } catch (err) {
    return {
      paid: false,
      raw: null,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
