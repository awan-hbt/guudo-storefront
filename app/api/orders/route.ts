import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase-server";
import { notifyCustomerOrderReceived } from "@/lib/watzap";

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

  // Optionally create iPaymu QRIS payment
  const proxyUrl = process.env.IPAYMU_PROXY_URL?.trim();
  const proxySecret = process.env.PROXY_SECRET?.trim();
  const baseUrl = (process.env.NEXT_PUBLIC_BASE_URL ?? "https://guudo.id").trim();

  let qrisUrl: string | null = null;

  if (ipaymuEnabled && proxyUrl && proxySecret) {
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
      const ipaymuData = await proxyRes.json();
      if (ipaymuData?.Data) {
        const trxId = ipaymuData.Data.TransactionId
          ? String(ipaymuData.Data.TransactionId)
          : null;
        qrisUrl = ipaymuData.Data.QrString ?? null;
        if (trxId) {
          await supabase
            .from("orders")
            .update({ ipaymu_trx_id: trxId })
            .eq("id", order.id);
        }
      }
    } catch (err) {
      console.error("[iPaymu proxy error]", err);
    }
  }

  return NextResponse.json(
    { success: true, referenceCode, qrString: qrisUrl },
    { status: 201 }
  );
}
