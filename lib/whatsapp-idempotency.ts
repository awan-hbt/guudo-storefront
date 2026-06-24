import type { SupabaseClient } from "@supabase/supabase-js";
import { notifyCustomerConfirmed, notifyAdminPaymentConfirmed } from "@/lib/whatsapp";

const PAID_STATUSES = new Set(["paid", "confirmed"]);

/**
 * Send payment_confirmed WhatsApp once per order (webhook + status poller safe).
 */
export async function notifyPaymentConfirmedOnce(
  supabase: SupabaseClient,
  params: {
    phone: string;
    name: string;
    referenceCode: string;
    totalPrice: number;
  }
): Promise<void> {
  const ref = String(params.referenceCode);

  const { data: existing } = await supabase
    .from("whatsapp_sent")
    .select("id")
    .eq("reference_code", ref)
    .eq("event_type", "payment_confirmed")
    .maybeSingle();

  if (existing) return;

  const { error: insertError } = await supabase.from("whatsapp_sent").insert({
    reference_code: ref,
    event_type: "payment_confirmed",
  });

  if (insertError) {
    if (insertError.code === "23505") return;
    console.error("[whatsapp] idempotency insert failed:", insertError.message);
    return;
  }

  await notifyCustomerConfirmed(params).catch((err) => {
    console.error("[whatsapp] notifyCustomerConfirmed failed:", err);
  });

  await notifyAdminPaymentConfirmed(params).catch((err) => {
    console.error("[whatsapp] notifyAdminPaymentConfirmed failed:", err);
  });
}

export function isAlreadyPaid(paymentStatus: string | null | undefined): boolean {
  return PAID_STATUSES.has(String(paymentStatus ?? "").toLowerCase());
}
