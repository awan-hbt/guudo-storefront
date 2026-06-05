import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase-server";

export async function POST(req: NextRequest) {
  const secret = req.headers.get("x-proxy-secret");
  if (!secret || secret !== process.env.PROXY_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { reference_id, status, status_code } = body;

  // iPaymu sends status 'berhasil' or status_code '1' for successful payments
  const isPaid =
    status === "berhasil" || status_code === "1" || status_code === 1;

  if (!isPaid || !reference_id) {
    return NextResponse.json({ ok: true });
  }

  const supabase = createServiceClient();

  const { error } = await supabase
    .from("orders")
    .update({ payment_status: "paid" })
    .eq("reference_code", String(reference_id));

  if (error) {
    return NextResponse.json({ error: "Failed to update order" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
