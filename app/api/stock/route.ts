import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = createServiceClient();

  const [itemsResult, groupsResult] = await Promise.all([
    supabase
      .from("menu_items")
      .select(
        "id, name, description, price, category, unit, image_url, stock_group_id, stock_available, sort_order, variant_group"
      )
      .eq("is_active", true)
      .order("sort_order", { ascending: true }),
    supabase.from("stock_groups").select("id, available"),
  ]);

  if (itemsResult.error || groupsResult.error) {
    return NextResponse.json({ error: "Failed to fetch menu" }, { status: 500 });
  }

  const groupMap = Object.fromEntries(
    (groupsResult.data ?? []).map((g) => [g.id, g.available])
  );

  const items = (itemsResult.data ?? []).map((item) => ({
    id: item.id,
    name: item.name,
    description: item.description,
    price: item.price,
    category: item.category,
    unit: item.unit,
    imageUrl: item.image_url ?? null,
    stockGroupId: item.stock_group_id ?? null,
    stockAvailable: item.stock_group_id
      ? (groupMap[item.stock_group_id] ?? 0)
      : (item.stock_available ?? 0),
    sortOrder: item.sort_order,
    variantGroup: item.variant_group ?? null,
  }));

  return NextResponse.json({ items });
}
