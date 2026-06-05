import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from("app_config")
    .select("value")
    .eq("key", "ipaymu_enabled")
    .maybeSingle();

  return NextResponse.json({ ipaymuEnabled: data?.value === "true" });
}
