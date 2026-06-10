import crypto from "node:crypto";

export interface IpaymuStatusResult {
  paid: boolean;
  raw: unknown;
  error?: string;
}

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
    const statusStr = String(d.Status ?? d.StatusDesc ?? "").toLowerCase();
    const statusCode = d.StatusCode ?? d.Status;

    const paid =
      statusStr === "berhasil" ||
      statusStr === "success" ||
      statusStr === "paid" ||
      statusCode === 1 ||
      statusCode === "1";

    return { paid, raw: data };
  } catch (err) {
    return {
      paid: false,
      raw: null,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
