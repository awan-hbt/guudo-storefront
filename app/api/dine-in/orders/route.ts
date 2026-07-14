import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase-server";

interface OrderItemInput {
  menuItemId: string;
  quantity: number;
  unitPrice: number;
}

async function generateReferenceCode(
  supabase: ReturnType<typeof createServiceClient>
): Promise<string | null> {
  for (let i = 0; i < 10; i++) {
    const code = `DI-${Math.floor(1000 + Math.random() * 9000)}`;
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
  const { name, items, totalPrice } = body;

  if (
    !name ||
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

  const rpcItems = (items as OrderItemInput[]).map((i) => ({
    menu_item_id: i.menuItemId,
    quantity: i.quantity,
  }));

  const { error: rpcError } = await supabase.rpc("place_order", { p_items: rpcItems });

  if (rpcError) {
    if (rpcError.message.includes("INSUFFICIENT_STOCK")) {
      return NextResponse.json(
        { error: "Stok tidak cukup untuk item yang dipilih." },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: "Failed to place order" }, { status: 500 });
  }

  const { data: order, error: orderError } = await supabase
    .from("orders")
    .insert({
      reference_code: referenceCode,
      name: String(name).trim(),
      phone: "-",
      total_price: totalPrice,
      receipt_url: "",
      memo: "Dine-in",
      order_source: "dine_in",
      payment_status: "unpaid",
    })
    .select("id")
    .single();

  if (orderError || !order) {
    console.error("[dine-in] order insert failed", orderError);
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

  return NextResponse.json({ success: true, referenceCode }, { status: 201 });
}
