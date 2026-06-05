import Link from "next/link";

export const metadata = {
  title: "Refund Policy — Guudo",
};

export default function RefundPolicyPage() {
  return (
    <div className="min-h-screen" style={{ background: "#faf8f3" }}>
      <nav className="bg-stone-900 px-4 sm:px-6 py-4">
        <div className="max-w-3xl mx-auto flex items-center gap-4">
          <Link href="/" className="text-white font-bold text-lg tracking-widest uppercase">
            Guudo
          </Link>
          <span className="text-white/30">/</span>
          <span className="text-white/60 text-sm">Refund Policy</span>
        </div>
      </nav>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-12 prose prose-stone prose-sm max-w-none">
        <h1 className="text-3xl font-bold text-stone-900 mb-8 not-prose">Refund Policy</h1>

        <div className="space-y-6 text-stone-700 text-sm leading-relaxed">
          <section>
            <h2 className="text-lg font-bold text-stone-900 mb-2">1. Order Cancellation</h2>
            <p>
              Because food is prepared immediately after an order is confirmed, we cannot accept
              cancellations once payment has been successfully processed. Please ensure your order
              is correct before proceeding to payment.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-stone-900 mb-2">2. Eligible Refund Conditions</h2>
            <p>Refunds are only processed in the following cases:</p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li>An order cannot be fulfilled due to stock running out after payment is confirmed.</li>
              <li>A technical error causes a double charge.</li>
              <li>The food received does not match the order (wrong item).</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold text-stone-900 mb-2">3. Refund Process</h2>
            <p>
              To request a refund, contact us via WhatsApp with your order reference code.
              Refunds will be processed within 3–5 business days via the original payment method.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-stone-900 mb-2">4. Exclusions</h2>
            <p>
              We do not accept refund claims based on taste preferences or failure to pick up an order.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-stone-900 mb-2">5. Contact</h2>
            <p>
              Refund inquiries can be submitted via the WhatsApp number listed on our profile
              or by email at <span className="font-medium">support@guudo.id</span>.
            </p>
          </section>
        </div>

        <div className="mt-10">
          <Link href="/" className="text-amber-600 hover:text-amber-700 text-sm font-medium transition-colors">
            ← Back to Home
          </Link>
        </div>
      </main>
    </div>
  );
}
