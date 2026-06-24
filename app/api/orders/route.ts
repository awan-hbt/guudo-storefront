import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase-server";
import { notifyCustomerOrderReceived, notifyAdminNewOrder } from "@/lib/whatsapp";

interface OrderItemInput {
  menuItemId: string;
  quantity: number;
  unitPrice: number;
}

async function generateReferenceCode(
  supabase: ReturnType<typeof createServiceClient>
): Promise<string | null> {
  for (let i = 0; i < 10; i++) {
    const code = `GD-${Math.floor(1000 + Math.random() * 9000)}`;
    const { data } = await supabase
      .from("orders")
      .select("id")
      .eq("reference_code", code)
      .maybeSingle();
    if (!data) return code;
  }
  return null;
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { name, phone, items, totalPrice, memo, ipaymuEnabled = false } = body;

  if (
    !name ||
    !phone ||
    totalPrice === undefined ||
    !Array.isArray(items) ||
    items.length === 0
  ) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  for (const item of items as OrderItemInput[]) {
    if (!item.menuItemId || !Number.isInteger(item.quantity) || item.quantity < 1) {
      return NextResponse.json({ error: "Invalid items" }, { status: 400 });
    }
  }

  const supabase = createServiceClient();

  const referenceCode = await generateReferenceCode(supabase);
  if (!referenceCode) {
    return NextResponse.json({ error: "Failed to generate reference code" }, { status: 500 });
  }

  // Atomically deduct stock — raises INSUFFICIENT_STOCK if any item is short
  const rpcItems = (items as OrderItemInput[]).map((i) => ({
    menu_item_id: i.menuItemId,
    quantity: i.quantity,
  }));

  const { error: rpcError } = await supabase.rpc("place_order", { p_items: rpcItems });

  if (rpcError) {
    if (rpcError.message.includes("INSUFFICIENT_STOCK")) {
      return NextResponse.json({ error: "Stok tidak cukup untuk item yang dipilih." }, { status: 409 });
    }
    return NextResponse.json({ error: "Failed to place order" }, { status: 500 });
  }

  const { data: order, error: orderError } = await supabase
    .from("orders")
    .insert({
      reference_code: referenceCode,
      name: String(name).trim(),
      phone: String(phone).trim(),
      total_price: totalPrice,
      receipt_url: "",
      memo: memo ? String(memo).trim() : null,
    })
    .select("id")
    .single();

  if (orderError || !order) {
    return NextResponse.json({ error: "Failed to save order" }, { status: 500 });
  }

  const orderItemsData = (items as OrderItemInput[]).map((i) => ({
    order_id: order.id,
    menu_item_id: i.menuItemId,
    quantity: i.quantity,
    unit_price: i.unitPrice,
  }));

  const { error: itemsError } = await supabase.from("order_items").insert(orderItemsData);
  if (itemsError) {
    return NextResponse.json({ error: "Failed to save order items" }, { status: 500 });
  }

  await notifyCustomerOrderReceived({ phone, name, referenceCode, totalPrice }).catch(() => {});
  await notifyAdminNewOrder({
    phone,
    name,
    referenceCode,
    totalPrice,
    memo: memo ? String(memo).trim() : null,
  }).catch(() => {});

  // Optionally create iPaymu QRIS payment
  const proxyUrl = process.env.IPAYMU_PROXY_URL?.trim();
  const proxySecret = process.env.PROXY_SECRET?.trim();
  const baseUrl = (process.env.NEXT_PUBLIC_BASE_URL ?? "https://guudo.id").trim();

  let qrisUrl: string | null = null;
  // Debug trail so iPaymu failures are visible in the Network tab + server logs.
  let proxyDebug: Record<string, unknown> = { attempted: false };

  if (ipaymuEnabled && proxyUrl && proxySecret) {
    proxyDebug = { attempted: true, proxyUrl, referenceCode };
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
          price: [String(totalPrice)],
          amount: String(totalPrice),
          referenceId: referenceCode,
          buyerName: String(name).trim(),
          buyerPhone: String(phone).trim(),
          returnUrl: baseUrl,
          cancelUrl: baseUrl,
        }),
      });
      const ipaymuData = await proxyRes.json().catch(() => null);
      proxyDebug = {
        ...proxyDebug,
        httpStatus: proxyRes.status,
        ok: proxyRes.ok,
        response: ipaymuData,
      };
      console.log("[iPaymu proxy] order create →", JSON.stringify(proxyDebug));
      if (ipaymuData?.Data) {
        const d = ipaymuData.Data;
        const rawTrx =
          d.TransactionId ?? d.transactionId ?? d.TrxId ?? d.trx_id ?? null;
        const trxId = rawTrx != null ? String(rawTrx) : null;
        qrisUrl = d.QrString ?? null;
        if (trxId) {
          await supabase
            .from("orders")
            .update({ ipaymu_trx_id: trxId })
            .eq("id", order.id);
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      proxyDebug = { ...proxyDebug, error: message };
      console.error("[iPaymu proxy error]", message);
    }
  } else {
    proxyDebug = {
      attempted: false,
      reason: !ipaymuEnabled
        ? "ipaymuEnabled is false (QRIS not selected, or ipaymu_enabled config is off)"
        : "IPAYMU_PROXY_URL or PROXY_SECRET not set in environment",
    };
    console.warn("[iPaymu] skipped:", proxyDebug.reason);
  }

  return NextResponse.json(
    { success: true, referenceCode, qrString: qrisUrl, proxyDebug },
    { status: 201 }
  );
}
