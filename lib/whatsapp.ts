import {
  notifyAdminReceiptUploaded as watzapAdminReceipt,
  notifyCustomerConfirmed as watzapCustomerConfirmed,
  notifyCustomerOrderReceived as watzapOrderReceived,
} from "@/lib/watzap";

type EventType =
  | "order_received"
  | "payment_confirmed"
  | "admin_receipt"
  | "admin_new_order"
  | "admin_payment_confirmed";

interface SendPayload {
  eventType: EventType;
  phone?: string;
  name: string;
  referenceCode: string;
  totalPrice: number;
  memo?: string | null;
  receiptUrl?: string;
}

function useSelfHosted(): boolean {
  return Boolean(process.env.WHATSAPP_SERVICE_URL?.trim());
}

function useWatzap(): boolean {
  const hasWatzap = Boolean(process.env.WATZAP_API_KEY?.trim());
  if (!hasWatzap) return false;
  if (!useSelfHosted()) return true;
  return process.env.WHATSAPP_PARALLEL === "true";
}

async function sendToSelfHosted(payload: SendPayload): Promise<void> {
  const base = process.env.WHATSAPP_SERVICE_URL?.trim();
  const secret = process.env.PROXY_SECRET?.trim();
  if (!base || !secret) {
    console.warn("[whatsapp] skipped self-hosted — WHATSAPP_SERVICE_URL or PROXY_SECRET not set");
    return;
  }

  const url = base.replace(/\/$/, "") + "/send";
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-proxy-secret": secret,
    },
    body: JSON.stringify(payload),
  });

  if (res.status === 202 || res.ok) {
    console.log("[whatsapp] self-hosted queued:", payload.eventType, payload.referenceCode);
    return;
  }
  const text = await res.text().catch(() => "");
  console.error("[whatsapp] self-hosted send failed:", res.status, text);
}

async function dispatch(payload: SendPayload): Promise<void> {
  const tasks: Promise<void>[] = [];
  if (useSelfHosted()) tasks.push(sendToSelfHosted(payload));
  if (useWatzap()) {
    const { eventType, phone, name, referenceCode, totalPrice, memo, receiptUrl } = payload;
    if (eventType === "order_received" && phone) {
      tasks.push(watzapOrderReceived({ phone, name, referenceCode, totalPrice }));
    } else if (eventType === "payment_confirmed" && phone) {
      tasks.push(watzapCustomerConfirmed({ phone, name, referenceCode, totalPrice }));
    } else if (eventType === "admin_receipt" && phone && receiptUrl) {
      tasks.push(
        watzapAdminReceipt({
          referenceCode,
          name,
          phone,
          totalPrice,
          memo: memo ?? null,
          receiptUrl,
        })
      );
    }
  }
  await Promise.allSettled(tasks);
}

export async function notifyAdminReceiptUploaded(params: {
  referenceCode: string;
  name: string;
  phone: string;
  totalPrice: number;
  memo: string | null;
  receiptUrl: string;
}): Promise<void> {
  await dispatch({
    eventType: "admin_receipt",
    phone: params.phone,
    name: params.name,
    referenceCode: params.referenceCode,
    totalPrice: params.totalPrice,
    memo: params.memo,
    receiptUrl: params.receiptUrl,
  });
}

export async function notifyAdminNewOrder(params: {
  phone: string;
  name: string;
  referenceCode: string;
  totalPrice: number;
  memo?: string | null;
}): Promise<void> {
  await dispatch({
    eventType: "admin_new_order",
    phone: params.phone,
    name: params.name,
    referenceCode: params.referenceCode,
    totalPrice: params.totalPrice,
    memo: params.memo ?? null,
  });
}

export async function notifyAdminPaymentConfirmed(params: {
  phone: string;
  name: string;
  referenceCode: string;
  totalPrice: number;
}): Promise<void> {
  await dispatch({
    eventType: "admin_payment_confirmed",
    phone: params.phone,
    name: params.name,
    referenceCode: params.referenceCode,
    totalPrice: params.totalPrice,
  });
}

export async function notifyCustomerConfirmed(params: {
  phone: string;
  name: string;
  referenceCode: string;
  totalPrice: number;
}): Promise<void> {
  await dispatch({
    eventType: "payment_confirmed",
    phone: params.phone,
    name: params.name,
    referenceCode: params.referenceCode,
    totalPrice: params.totalPrice,
  });
}

export async function notifyCustomerOrderReceived(params: {
  phone: string;
  name: string;
  referenceCode: string;
  totalPrice: number;
}): Promise<void> {
  await dispatch({
    eventType: "order_received",
    phone: params.phone,
    name: params.name,
    referenceCode: params.referenceCode,
    totalPrice: params.totalPrice,
  });
}
