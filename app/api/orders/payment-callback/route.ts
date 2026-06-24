import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase-server";
import {
  isAlreadyPaid,
  notifyPaymentConfirmedOnce,
} from "@/lib/whatsapp-idempotency";

export async function POST(req: NextRequest) {
  const secret = req.headers.get("x-proxy-secret");
  if (!secret || secret !== process.env.PROXY_SECRET) {
    console.warn("[payment-callback] UNAUTHORIZED — missing/incorrect x-proxy-secret header");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  console.log("[payment-callback] received:", JSON.stringify(body));

  const { reference_id, status, status_code, trx_id } = body;

  const isPaid =
    status === "berhasil" || status_code === "1" || status_code === 1;

  if (!isPaid) {
    console.log("[payment-callback] not a paid status — ignoring", { status, status_code });
    return NextResponse.json({ ok: true });
  }

  if (!reference_id && !trx_id) {
    console.warn("[payment-callback] paid but no reference_id or trx_id in payload");
    return NextResponse.json({ ok: true });
  }

  const supabase = createServiceClient();

  let order: {
    reference_code: string;
    phone: string;
    name: string;
    total_price: number;
    payment_status: string | null;
  } | null = null;

  if (reference_id) {
    const { data } = await supabase
      .from("orders")
      .select("reference_code, phone, name, total_price, payment_status")
      .eq("reference_code", String(reference_id))
      .maybeSingle();
    order = data;
  } else if (trx_id) {
    const { data } = await supabase
      .from("orders")
      .select("reference_code, phone, name, total_price, payment_status")
      .eq("ipaymu_trx_id", String(trx_id))
      .maybeSingle();
    order = data;
  }

  if (order && isAlreadyPaid(order.payment_status)) {
    console.log(
      `[payment-callback] already paid — skip notify ref=${order.reference_code}`
    );
    return NextResponse.json({ ok: true });
  }

  let matched = 0;
  if (reference_id) {
    const { error, count } = await supabase
      .from("orders")
      .update({ payment_status: "paid" }, { count: "exact" })
      .eq("reference_code", String(reference_id));
    if (error) {
      console.error("[payment-callback] update by reference_code failed:", error.message);
      return NextResponse.json({ error: "Failed to update order" }, { status: 500 });
    }
    matched = count ?? 0;
  }

  if (matched === 0 && trx_id) {
    const { error, count } = await supabase
      .from("orders")
      .update({ payment_status: "paid" }, { count: "exact" })
      .eq("ipaymu_trx_id", String(trx_id));
    if (error) {
      console.error("[payment-callback] update by ipaymu_trx_id failed:", error.message);
      return NextResponse.json({ error: "Failed to update order" }, { status: 500 });
    }
    matched = count ?? 0;

    if (matched > 0 && !order) {
      const { data } = await supabase
        .from("orders")
        .select("reference_code, phone, name, total_price, payment_status")
        .eq("ipaymu_trx_id", String(trx_id))
        .maybeSingle();
      order = data;
    }
  }

  if (matched === 0) {
    console.warn(
      `[payment-callback] NO ORDER MATCHED — reference_id=${reference_id} trx_id=${trx_id}`
    );
  } else {
    console.log(
      `[payment-callback] marked paid (rows=${matched}) reference_id=${reference_id} trx_id=${trx_id}`
    );

    if (order) {
      notifyPaymentConfirmedOnce(supabase, {
        phone: order.phone,
        name: order.name,
        referenceCode: order.reference_code,
        totalPrice: order.total_price,
      }).catch(() => {});
    }
  }

  return NextResponse.json({ ok: true });
}
