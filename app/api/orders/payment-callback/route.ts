import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase-server";

export async function POST(req: NextRequest) {
  const secret = req.headers.get("x-proxy-secret");
  if (!secret || secret !== process.env.PROXY_SECRET) {
    console.warn("[payment-callback] UNAUTHORIZED — missing/incorrect x-proxy-secret header");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  // Log the full payload so we can confirm the webhook is arriving and inspect its shape.
  console.log("[payment-callback] received:", JSON.stringify(body));

  const { reference_id, status, status_code, trx_id } = body;

  // iPaymu sends status 'berhasil' or status_code '1' for successful payments
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

  // Primary match: our own reference code (what we sent as referenceId).
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

  // Fallback: match on the stored iPaymu transaction id if reference_code didn't hit.
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
  }

  if (matched === 0) {
    console.warn(
      `[payment-callback] NO ORDER MATCHED — reference_id=${reference_id} trx_id=${trx_id}`
    );
  } else {
    console.log(
      `[payment-callback] marked paid (rows=${matched}) reference_id=${reference_id} trx_id=${trx_id}`
    );
  }

  return NextResponse.json({ ok: true });
}
