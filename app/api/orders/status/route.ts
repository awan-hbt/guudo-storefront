import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase-server";

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
    .select("payment_status")
    .eq("reference_code", referenceCode)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: "Failed to fetch order status" }, { status: 500 });
  }

  if (!data) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  return NextResponse.json({ paymentStatus: data.payment_status ?? "pending" });
}
