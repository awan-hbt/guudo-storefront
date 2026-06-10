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

  // Append ?debug=1 to inspect the full confirmation chain on the live site.
  const debug = req.nextUrl.searchParams.get("debug") === "1";

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
  const trxId = data.ipaymu_trx_id ? String(data.ipaymu_trx_id) : null;
  let ipaymuCheck: Awaited<ReturnType<typeof checkIpaymuTransaction>> | null = null;

  // Webhook callbacks aren't reliably wired up, so when an order is still
  // pending and has an iPaymu transaction id, ask iPaymu directly and
  // self-heal the order to "paid".
  if (paymentStatus !== "paid" && trxId) {
    ipaymuCheck = await checkIpaymuTransaction(trxId);
    if (ipaymuCheck.paid) {
      paymentStatus = "paid";
      await supabase
        .from("orders")
        .update({ payment_status: "paid" })
        .eq("reference_code", referenceCode);
      console.log(`[status] iPaymu confirmed paid for ${referenceCode}`);
    } else if (ipaymuCheck.error) {
      console.error("[status] iPaymu check error:", ipaymuCheck.error);
    }
  }

  if (debug) {
    return NextResponse.json({
      paymentStatus,
      debug: {
        referenceCode,
        storedTrxId: trxId,
        hasTrxId: Boolean(trxId),
        envConfigured: {
          IPAYMU_VA: Boolean(process.env.IPAYMU_VA),
          IPAYMU_API_KEY: Boolean(process.env.IPAYMU_API_KEY),
          IPAYMU_BASE_URL: process.env.IPAYMU_BASE_URL ?? "https://my.ipaymu.com (default)",
        },
        ipaymuCheck,
      },
    });
  }

  return NextResponse.json({ paymentStatus });
}
