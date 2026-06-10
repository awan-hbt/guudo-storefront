import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase-server";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const referenceCode = String(body.referenceCode ?? "").trim().toUpperCase();

  if (!referenceCode) {
    return NextResponse.json({ error: "Missing reference code" }, { status: 400 });
  }

  const supabase = createServiceClient();
  const { data: order, error } = await supabase
    .from("orders")
    .select("id, name, phone, total_price, payment_status")
    .eq("reference_code", referenceCode)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: "Failed to fetch order" }, { status: 500 });
  }

  if (!order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  if (order.payment_status === "paid") {
    return NextResponse.json({ error: "Order already paid" }, { status: 409 });
  }

  const proxyUrl = process.env.IPAYMU_PROXY_URL?.trim();
  const proxySecret = process.env.PROXY_SECRET?.trim();
  const baseUrl = (process.env.NEXT_PUBLIC_BASE_URL ?? "https://guudo.id").trim();

  if (!proxyUrl || !proxySecret) {
    return NextResponse.json(
      {
        error:
          "iPaymu proxy is not configured. Set IPAYMU_PROXY_URL and PROXY_SECRET in .env.local.",
      },
      { status: 500 }
    );
  }

  try {
    const proxyRes = await fetch(`${proxyUrl}/create-payment`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-proxy-secret": proxySecret,
      },
      body: JSON.stringify({
        product: [`Order ${referenceCode}`],
        qty: ["1"],
        price: [String(order.total_price)],
        amount: String(order.total_price),
        referenceId: referenceCode,
        buyerName: String(order.name).trim(),
        buyerPhone: String(order.phone).trim(),
        returnUrl: baseUrl,
        cancelUrl: baseUrl,
      }),
    });

    const ipaymuData = await proxyRes.json().catch(() => null);
    if (!proxyRes.ok || !ipaymuData?.Data) {
      console.error(
        "[iPaymu refresh error] proxy response",
        proxyRes.status,
        JSON.stringify(ipaymuData)
      );
      return NextResponse.json(
        {
          error: "Failed to generate iPaymu payment",
          detail:
            ipaymuData?.Message ?? ipaymuData?.message ?? `Proxy HTTP ${proxyRes.status}`,
          proxyDebug: {
            httpStatus: proxyRes.status,
            ok: proxyRes.ok,
            response: ipaymuData,
          },
        },
        { status: 502 }
      );
    }

    const qrisUrl = ipaymuData.Data.QrString ?? null;
    const trxId = ipaymuData.Data.TransactionId
      ? String(ipaymuData.Data.TransactionId)
      : null;

    if (trxId) {
      await supabase
        .from("orders")
        .update({ ipaymu_trx_id: trxId })
        .eq("id", order.id);
    }

    return NextResponse.json({ success: true, qrString: qrisUrl });
  } catch (err) {
    console.error("[iPaymu refresh error]", err);
    const message = err instanceof Error ? err.message : String(err);
    const unreachable =
      message.includes("fetch failed") ||
      message.includes("ECONNREFUSED") ||
      message.includes("ETIMEDOUT") ||
      message.includes("timeout");
    return NextResponse.json(
      {
        error: unreachable
          ? "iPaymu proxy is unreachable. Check that the VPS at IPAYMU_PROXY_URL is running and allowlists this server's IP."
          : "Failed to generate iPaymu payment",
        detail: message,
        proxyDebug: { proxyUrl, error: message, unreachable },
      },
      { status: 502 }
    );
  }
}
