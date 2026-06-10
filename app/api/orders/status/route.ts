import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase-server";
import { checkIpaymuTransaction } from "@/lib/ipaymu";

export async function GET(req: NextRequest) {
  const referenceCode = req.nextUrl.searchParams
    .get("referenceCode")
    ?.trim()
    .toUpperCase();

  if (!referenceCode) {
    return NextResponse.json({ error: "Missing reference code" }, { status: 400 });
  }

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("orders")
    .select("payment_status, ipaymu_trx_id")
    .eq("reference_code", referenceCode)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: "Failed to fetch order status" }, { status: 500 });
  }

  if (!data) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  let paymentStatus = data.payment_status ?? "pending";

  // Webhook callbacks aren't reliably wired up, so when an order is still
  // pending and has an iPaymu transaction id, ask iPaymu directly and
  // self-heal the order to "paid".
  if (paymentStatus !== "paid" && data.ipaymu_trx_id) {
    const result = await checkIpaymuTransaction(String(data.ipaymu_trx_id));
    if (result.paid) {
      paymentStatus = "paid";
      await supabase
        .from("orders")
        .update({ payment_status: "paid" })
        .eq("reference_code", referenceCode);
      console.log(`[status] iPaymu confirmed paid for ${referenceCode}`);
    } else if (result.error) {
      console.error("[status] iPaymu check error:", result.error);
    }
  }

  return NextResponse.json({ paymentStatus });
}
