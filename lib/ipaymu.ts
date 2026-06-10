import crypto from "node:crypto";

export interface IpaymuStatusResult {
  paid: boolean;
  /** iPaymu numeric transaction status, if available. */
  status?: number;
  /** Human-readable status from iPaymu, if available. */
  statusDesc?: string;
  /** The matched iPaymu transaction id, when found via reference lookup. */
  trxId?: string;
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

function ipaymuConfig() {
  const va = process.env.IPAYMU_VA?.trim();
  const apiKey = process.env.IPAYMU_API_KEY?.trim();
  // Production: https://my.ipaymu.com · Sandbox: https://sandbox.ipaymu.com
  const baseUrl = (process.env.IPAYMU_BASE_URL ?? "https://my.ipaymu.com").trim();
  return { va, apiKey, baseUrl };
}

/**
 * Perform a signed iPaymu v2 POST request.
 *
 * Signature spec (verified against iPaymu's official ipaymu.js sample):
 *   bodyHash     = sha256(JSON.stringify(body))   // lowercase hex
 *   stringToSign = "POST:" + VA + ":" + bodyHash + ":" + APIKEY
 *   signature    = hmac_sha256(stringToSign, APIKEY)
 */
async function ipaymuPost(
  path: string,
  body: Record<string, unknown>
): Promise<unknown> {
  const { va, apiKey, baseUrl } = ipaymuConfig();
  if (!va || !apiKey) {
    throw new Error("IPAYMU_VA or IPAYMU_API_KEY not set");
  }

  const bodyJson = JSON.stringify(body);
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

  const res = await fetch(`${baseUrl}${path}`, {
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

  return res.json().catch(() => null);
}

function topLevelError(data: unknown): string | undefined {
  const topStatus = (data as { Status?: number } | null)?.Status;
  if (topStatus && topStatus !== 200) {
    const msg = (data as { Message?: string } | null)?.Message ?? "unknown";
    return `iPaymu API returned Status ${topStatus}: ${msg}`;
  }
  return undefined;
}

function isPaidStatus(statusNum: number, statusDesc: string): boolean {
  return (
    (Number.isFinite(statusNum) && PAID_STATUS_CODES.includes(statusNum)) ||
    PAID_STATUS_WORDS.includes(statusDesc)
  );
}

/**
 * Query iPaymu directly for a transaction's status by transaction id.
 *
 * Note: for QRIS, the transaction id only exists AFTER the customer pays, so
 * this is only usable once we have a stored `ipaymu_trx_id`. When we don't have
 * one, use `checkIpaymuByReference` instead.
 */
export async function checkIpaymuTransaction(
  trxId: string
): Promise<IpaymuStatusResult> {
  try {
    const data = await ipaymuPost("/api/v2/transaction", { transactionId: trxId });
    const d = (data as { Data?: Record<string, unknown> } | null)?.Data ?? {};

    const statusNum = Number(d.Status ?? d.StatusCode);
    const statusDesc = String(d.StatusDesc ?? d.Status ?? "")
      .trim()
      .toLowerCase();

    return {
      paid: isPaidStatus(statusNum, statusDesc),
      status: Number.isFinite(statusNum) ? statusNum : undefined,
      statusDesc: statusDesc || undefined,
      trxId,
      raw: data,
      error: topLevelError(data),
    };
  } catch (err) {
    return {
      paid: false,
      raw: null,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * Recursively walk an arbitrary JSON value looking for an object that contains
 * `referenceCode` as one of its string values (the iPaymu "Ref ID"). Returns
 * that object so we can read its status, regardless of the exact field names
 * iPaymu uses in the history response.
 */
function findRecordByReference(
  node: unknown,
  referenceCode: string
): Record<string, unknown> | null {
  const target = referenceCode.trim().toLowerCase();

  if (Array.isArray(node)) {
    for (const item of node) {
      const found = findRecordByReference(item, referenceCode);
      if (found) return found;
    }
    return null;
  }

  if (node && typeof node === "object") {
    const obj = node as Record<string, unknown>;
    const matchesHere = Object.values(obj).some(
      (v) =>
        (typeof v === "string" || typeof v === "number") &&
        String(v).trim().toLowerCase() === target
    );
    if (matchesHere) return obj;

    for (const v of Object.values(obj)) {
      const found = findRecordByReference(v, referenceCode);
      if (found) return found;
    }
  }

  return null;
}

/** Pull a status code + description out of an arbitrary iPaymu record object. */
function extractStatus(record: Record<string, unknown>): {
  statusNum: number;
  statusDesc: string;
  trxId?: string;
} {
  const statusRaw =
    record.Status ??
    record.status ??
    record.StatusCode ??
    record.status_code ??
    record.StatusId ??
    record.status_id;
  const statusDesc = String(
    record.StatusDescription ??
      record.StatusDesc ??
      record.status_desc ??
      record.statusDescription ??
      ""
  )
    .trim()
    .toLowerCase();
  const trxRaw =
    record.Id ??
    record.id ??
    record.TransactionId ??
    record.transactionId ??
    record.trx_id;

  return {
    statusNum: Number(statusRaw),
    statusDesc,
    trxId: trxRaw != null ? String(trxRaw) : undefined,
  };
}

function ymd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * Look up an order's payment status on iPaymu by our own reference id
 * (e.g. "GD-8199"), using the History API. This is the reliable path for QRIS,
 * because iPaymu stores our reference as the transaction's Ref ID but does not
 * hand back a transaction id at QR-creation time.
 */
export async function checkIpaymuByReference(
  referenceCode: string
): Promise<IpaymuStatusResult> {
  const { va } = ipaymuConfig();
  const now = new Date();
  const start = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
  const end = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  try {
    const data = await ipaymuPost("/api/v2/history", {
      account: va,
      date: "created_at",
      startdate: ymd(start),
      enddate: ymd(end),
      orderBy: "id",
      order: "DESC",
      limit: 20,
      page: 1,
    });

    const topErr = topLevelError(data);
    const record = findRecordByReference(
      (data as { Data?: unknown } | null)?.Data ?? data,
      referenceCode
    );

    if (!record) {
      return {
        paid: false,
        raw: data,
        error:
          topErr ??
          `No iPaymu history record found for reference ${referenceCode} in the last 3 days`,
      };
    }

    const { statusNum, statusDesc, trxId } = extractStatus(record);
    return {
      paid: isPaidStatus(statusNum, statusDesc),
      status: Number.isFinite(statusNum) ? statusNum : undefined,
      statusDesc: statusDesc || undefined,
      trxId,
      raw: record,
      error: topErr,
    };
  } catch (err) {
    return {
      paid: false,
      raw: null,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
