import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase-server";
import {
  checkIpaymuTransaction,
  checkIpaymuByReference,
  type IpaymuStatusResult,
} from "@/lib/ipaymu";
import {
  isAlreadyPaid,
  notifyPaymentConfirmedOnce,
} from "@/lib/whatsapp-idempotency";

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
    .select("payment_status, ipaymu_trx_id, phone, name, total_price, reference_code")
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
  let ipaymuCheck: IpaymuStatusResult | null = null;
  let checkedVia: "trxId" | "reference" | null = null;

  // Webhook callbacks aren't reliably wired up, so when an order is still
  // pending we ask iPaymu directly and self-heal the order to "paid".
  //
  // For QRIS there's usually no transaction id until the customer pays, so the
  // reliable path is to look the payment up by our reference (the iPaymu "Ref
  // ID"). We try the fast trx-id check first when we happen to have one.
  if (paymentStatus !== "paid") {
    if (trxId) {
      ipaymuCheck = await checkIpaymuTransaction(trxId);
      checkedVia = "trxId";
    }

    if (!ipaymuCheck?.paid) {
      const byRef = await checkIpaymuByReference(referenceCode);
      // Prefer the reference result if it's conclusive or the trx check failed.
      if (byRef.paid || !ipaymuCheck) {
        ipaymuCheck = byRef;
        checkedVia = "reference";
      }
    }

    if (ipaymuCheck?.paid) {
      const wasPending = !isAlreadyPaid(paymentStatus);
      paymentStatus = "paid";
      const update: Record<string, unknown> = { payment_status: "paid" };
      // Backfill the real transaction id once we learn it from the lookup.
      if (!trxId && ipaymuCheck.trxId) update.ipaymu_trx_id = ipaymuCheck.trxId;
      await supabase
        .from("orders")
        .update(update)
        .eq("reference_code", referenceCode);
      console.log(`[status] iPaymu confirmed paid for ${referenceCode} (via ${checkedVia})`);

      if (wasPending) {
        notifyPaymentConfirmedOnce(supabase, {
          phone: data.phone,
          name: data.name,
          referenceCode: data.reference_code,
          totalPrice: data.total_price,
        }).catch(() => {});
      }
    } else if (ipaymuCheck?.error) {
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
        checkedVia,
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
