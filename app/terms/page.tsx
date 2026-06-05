import Link from "next/link";

export const metadata = {
  title: "Terms & Conditions — Guudo",
};

export default function TermsPage() {
  return (
    <div className="min-h-screen" style={{ background: "#faf8f3" }}>
      <nav className="bg-stone-900 px-4 sm:px-6 py-4">
        <div className="max-w-3xl mx-auto flex items-center gap-4">
          <Link href="/" className="text-white font-bold text-lg tracking-widest uppercase">
            Guudo
          </Link>
          <span className="text-white/30">/</span>
          <span className="text-white/60 text-sm">Terms & Conditions</span>
        </div>
      </nav>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-12">
        <h1 className="text-3xl font-bold text-stone-900 mb-2">Terms & Conditions</h1>
        <p className="text-stone-400 text-sm mb-8">Last updated: June 2025</p>

        <div className="space-y-6 text-stone-700 text-sm leading-relaxed">
          <section>
            <h2 className="text-lg font-bold text-stone-900 mb-2">1. Acceptance of Terms</h2>
            <p>
              By using Guudo’s online ordering service at guudo.id, you agree to the terms
              and conditions stated on this page.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-stone-900 mb-2">2. Service</h2>
            <p>
              Guudo provides an online food ordering platform for yakitori and rice bowl menus
              sold at our physical booth. All orders are pickup-only — no delivery service.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-stone-900 mb-2">3. Ordering & Payment</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>An order is considered valid once payment is confirmed.</li>
              <li>Listed prices are final in Indonesian Rupiah (IDR).</li>
              <li>Stock is limited and may change in real-time.</li>
              <li>Guudo reserves the right to cancel an order if stock is unavailable after payment,
                with a full refund issued.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold text-stone-900 mb-2">4. Personal Data</h2>
            <p>
              The data you provide (name, phone number) is used solely for order processing
              and order-related communication. We do not sell data to third parties.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-stone-900 mb-2">5. Limitation of Liability</h2>
            <p>
              Guudo is not liable for losses arising from delays or system failures beyond our
              control, including network outages or third-party payment system issues.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-stone-900 mb-2">6. Changes to Terms</h2>
            <p>
              Guudo reserves the right to update these terms at any time. Changes will be
              communicated through this website.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-stone-900 mb-2">7. Governing Law</h2>
            <p>
              These terms are governed by the laws of the Republic of Indonesia. Any disputes
              will be resolved through deliberation first.
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
