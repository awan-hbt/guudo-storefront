import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase-server";
import { notifyAdminPosOrder } from "@/lib/watzap";

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
  const { items, totalPrice, paymentMethod, cashTendered, notes } = body;

  if (
    totalPrice === undefined ||
    !Array.isArray(items) ||
    items.length === 0
  ) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  for (const item of items as OrderItemInput[]) {
    if (
      !item.menuItemId ||
      !Number.isInteger(item.quantity) ||
      item.quantity < 1
    ) {
      return NextResponse.json({ error: "Invalid items" }, { status: 400 });
    }
  }

  const supabase = createServiceClient();

  const referenceCode = await generateReferenceCode(supabase);
  if (!referenceCode) {
    return NextResponse.json(
      { error: "Failed to generate reference code" },
      { status: 500 }
    );
  }

  // Atomically deduct stock
  const rpcItems = (items as OrderItemInput[]).map((i) => ({
    menu_item_id: i.menuItemId,
    quantity: i.quantity,
  }));

  const { error: rpcError } = await supabase.rpc("place_order", {
    p_items: rpcItems,
  });

  if (rpcError) {
    if (rpcError.message.includes("INSUFFICIENT_STOCK")) {
      return NextResponse.json(
        { error: "Stok tidak cukup untuk item yang dipilih." },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { error: "Failed to place order" },
      { status: 500 }
    );
  }

  const changeDue =
    paymentMethod === "cash" && typeof cashTendered === "number"
      ? cashTendered - totalPrice
      : null;

  const { data: order, error: orderError } = await supabase
    .from("orders")
    .insert({
      reference_code: referenceCode,
      name: "Walk-in",
      phone: "",
      total_price: totalPrice,
      receipt_url: "",
      memo: notes ? String(notes).trim() : null,
      source: "pos",
      cash_tendered: typeof cashTendered === "number" ? cashTendered : null,
      change_due: changeDue,
    })
    .select("id")
    .single();

  if (orderError || !order) {
    return NextResponse.json(
      { error: "Failed to save order" },
      { status: 500 }
    );
  }

  const orderItemsData = (items as OrderItemInput[]).map((i) => ({
    order_id: order.id,
    menu_item_id: i.menuItemId,
    quantity: i.quantity,
    unit_price: i.unitPrice,
  }));

  const { error: itemsError } = await supabase
    .from("order_items")
    .insert(orderItemsData);

  if (itemsError) {
    return NextResponse.json(
      { error: "Failed to save order items" },
      { status: 500 }
    );
  }

  await notifyAdminPosOrder({
    referenceCode,
    totalPrice,
    paymentMethod: String(paymentMethod),
    changeDue,
    notes: notes ? String(notes).trim() : null,
  }).catch(() => {});

  return NextResponse.json(
    { success: true, referenceCode, changeDue },
    { status: 201 }
  );
}
