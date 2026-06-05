import Link from "next/link";

export const metadata = {
  title: "FAQ — Guudo",
};

const faqs = [
  {
    q: "Can stock run out?",
    a: "Yes. We cook in limited quantities each day to maintain quality. Order early to avoid missing out.",
  },
  {
    q: "How do I pick up my order?",
    a: "Once your order is confirmed, come to the Guudo booth and show your reference code (e.g. GD-1234). Your order will be prepared right away.",
  },
  {
    q: "How long does transfer confirmation take?",
    a: "We confirm manually every day — usually within 1–2 hours during operating hours. You’ll receive a WhatsApp notification.",
  },
  {
    q: "Can I refund or cancel my order?",
    a: "Confirmed orders cannot be cancelled because ingredients are already prepared. See our full policy on the Refund Policy page.",
  },
  {
    q: "What payment methods are available?",
    a: "QRIS (GoPay, OVO, Dana, ShopeePay, etc.) and manual bank transfer.",
  },
  {
    q: "Is there a minimum order?",
    a: "No minimum order. You can order just 1 portion.",
  },
  {
    q: "Is delivery available?",
    a: "Guudo is currently pickup-only. No delivery service.",
  },
];

export default function FAQPage() {
  return (
    <div className="min-h-screen" style={{ background: "#faf8f3" }}>
      <nav className="bg-stone-900 px-4 sm:px-6 py-4">
        <div className="max-w-3xl mx-auto flex items-center gap-4">
          <Link href="/" className="text-white font-bold text-lg tracking-widest uppercase">
            Guudo
          </Link>
          <span className="text-white/30">/</span>
          <span className="text-white/60 text-sm">FAQ</span>
        </div>
      </nav>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-12">
        <h1 className="text-3xl font-bold text-stone-900 mb-2">FAQ</h1>
        <p className="text-stone-500 mb-10">Frequently asked questions.</p>

        <div className="space-y-4">
          {faqs.map(({ q, a }, i) => (
            <div key={i} className="bg-white rounded-2xl border border-stone-100 p-5 shadow-sm">
              <h3 className="font-semibold text-stone-900 mb-2">{q}</h3>
              <p className="text-stone-600 text-sm leading-relaxed">{a}</p>
            </div>
          ))}
        </div>

        <div className="mt-10 text-center">
          <Link
            href="/order"
            className="inline-flex items-center gap-2 bg-amber-500 hover:bg-amber-400 text-white font-semibold px-8 py-3 rounded-full transition-colors"
          >
            Order Now
          </Link>
        </div>
      </main>
    </div>
  );
}
