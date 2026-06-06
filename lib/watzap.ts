const WATZAP_BASE = "https://api.watzap.id/v1";

function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("0")) return "62" + digits.slice(1);
  if (digits.startsWith("62")) return digits;
  return "62" + digits;
}

export async function notifyAdminPosOrder(params: {
  referenceCode: string;
  totalPrice: number;
  paymentMethod: string;
  changeDue: number | null;
  notes: string | null;
}): Promise<void> {
  const apiKey = process.env.WATZAP_API_KEY;
  const accessToken = process.env.WATZAP_ACCESS_TOKEN;
  const adminPhone = process.env.WATZAP_ADMIN_PHONE;
  if (!apiKey || !accessToken || !adminPhone) return;

  const payLabel =
    params.paymentMethod === "qris"
      ? "QRIS"
      : params.paymentMethod === "transfer"
      ? "Transfer"
      : "Cash";

  let message =
    `🧾 *POS Order*\n\n` +
    `Ref: *${params.referenceCode}*\n` +
    `Total: Rp ${params.totalPrice.toLocaleString("id-ID")}\n` +
    `Bayar: ${payLabel}`;

  if (params.paymentMethod === "cash" && params.changeDue !== null) {
    message += `\nKembalian: Rp ${params.changeDue.toLocaleString("id-ID")}`;
  }
  if (params.notes) {
    message += `\nCatatan: ${params.notes}`;
  }

  await fetch(`${WATZAP_BASE}/waba_send_message`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      api_key: apiKey,
      access_token: accessToken,
      number_key: adminPhone,
      message,
    }),
  });
}

export async function notifyAdminReceiptUploaded(params: {
  referenceCode: string;
  name: string;
  phone: string;
  totalPrice: number;
  memo: string | null;
  receiptUrl: string;
}): Promise<void> {
  const apiKey = process.env.WATZAP_API_KEY;
  const accessToken = process.env.WATZAP_ACCESS_TOKEN;
  const adminPhone = process.env.WATZAP_ADMIN_PHONE;
  if (!apiKey || !accessToken || !adminPhone) return;

  const message =
    `📋 *Bukti bayar baru masuk!*\n\n` +
    `Ref: *${params.referenceCode}*\n` +
    `Nama: ${params.name}\n` +
    `HP: ${params.phone}\n` +
    `Total: Rp ${params.totalPrice.toLocaleString("id-ID")}\n` +
    `Lokasi: ${params.memo ?? "-"}\n\n` +
    `Lihat bukti: ${params.receiptUrl}`;

  await fetch(`${WATZAP_BASE}/waba_send_message`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      api_key: apiKey,
      access_token: accessToken,
      number_key: adminPhone,
      message,
    }),
  });
}

export async function notifyCustomerConfirmed(params: {
  phone: string;
  name: string;
  referenceCode: string;
  totalPrice: number;
}): Promise<void> {
  const apiKey = process.env.WATZAP_API_KEY;
  if (!apiKey) return;

  const customerPhone = normalizePhone(params.phone);

  await fetch(`${WATZAP_BASE}/waba_send_message_template`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      api_key: apiKey,
      phone_no: customerPhone,
      template_name: "confirmed_order_tmp",
      template_language: "en",
      parameter: [
        {
          name: params.name,
          order_reference: params.referenceCode,
          total_price: `Rp ${params.totalPrice.toLocaleString("id-ID")}`,
        },
      ],
      apps_source: null,
    }),
  });
}

export async function notifyCustomerOrderReceived(params: {
  phone: string;
  name: string;
  referenceCode: string;
  totalPrice: number;
}): Promise<void> {
  const apiKey = process.env.WATZAP_API_KEY;
  if (!apiKey) return;

  const customerPhone = normalizePhone(params.phone);

  await fetch(`${WATZAP_BASE}/waba_send_message_template`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      api_key: apiKey,
      phone_no: customerPhone,
      template_name: "thankyou_order_tmp2",
      template_language: "en",
      parameter: [
        {
          name: params.name,
          order_reference: params.referenceCode,
          total_price: `Rp ${params.totalPrice.toLocaleString("id-ID")}`,
        },
      ],
      apps_source: null,
    }),
  });
}
