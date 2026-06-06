import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from("app_config")
    .select("key, value")
    .in("key", ["ipaymu_enabled", "pos_pin"]);

  const configMap = Object.fromEntries(
    (data ?? []).map((row) => [row.key, row.value])
  );

  return NextResponse.json({
    ipaymuEnabled: configMap["ipaymu_enabled"] === "true",
    posPin: configMap["pos_pin"] ?? "",
  });
}
