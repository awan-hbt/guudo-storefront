import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase-server";
import { randomUUID } from "crypto";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const fileName: string = body?.fileName ?? "receipt";

  // Sanitise: keep only the file extension
  const parts = fileName.split(".");
  const ext =
    parts.length > 1
      ? parts[parts.length - 1].replace(/[^a-zA-Z0-9]/g, "")
      : "bin";
  const safePath = `${randomUUID()}.${ext}`;

  const supabase = createServiceClient();

  const { data, error } = await supabase.storage
    .from("receipts")
    .createSignedUploadUrl(safePath);

  if (error || !data) {
    return NextResponse.json({ error: "Failed to create upload URL" }, { status: 500 });
  }

  const { data: urlData } = supabase.storage
    .from("receipts")
    .getPublicUrl(safePath);

  return NextResponse.json({
    signedUrl: data.signedUrl,
    path: safePath,
    publicUrl: urlData.publicUrl,
  });
}
