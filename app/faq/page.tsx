import Link from "next/link";

export const metadata = {
  title: "FAQ — Guudo",
};

const faqs = [
  {
    q: "Apakah stok bisa habis?",
    a: "Ya. Kami memasak dalam jumlah terbatas setiap hari untuk menjaga kualitas. Pesan lebih awal untuk menghindari kehabisan.",
  },
  {
    q: "Bagaimana cara mengambil pesanan?",
    a: "Setelah order dikonfirmasi, datang ke booth Guudo dan tunjukkan kode referensimu (contoh: GD-1234). Pesananmu akan langsung diproses.",
  },
  {
    q: "Berapa lama proses konfirmasi transfer?",
    a: "Kami konfirmasi manual setiap hari. Biasanya dalam 1–2 jam selama jam operasional. Kamu akan dapat notifikasi WhatsApp.",
  },
  {
    q: "Apakah bisa refund atau cancel?",
    a: "Pesanan yang sudah dikonfirmasi tidak bisa dicancel karena bahan makanan sudah disiapkan. Lihat kebijakan lengkapnya di halaman Kebijakan Refund.",
  },
  {
    q: "Metode pembayaran apa yang tersedia?",
    a: "QRIS (GoPay, OVO, Dana, ShopeePay, dll.) dan transfer bank manual.",
  },
  {
    q: "Ada minimum order?",
    a: "Tidak ada minimum order. Kamu bisa pesan 1 porsi saja.",
  },
  {
    q: "Apakah ada layanan delivery?",
    a: "Untuk saat ini Guudo hanya tersedia untuk pickup di lokasi. Tidak ada layanan delivery.",
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
        <p className="text-stone-500 mb-10">Pertanyaan yang sering ditanyakan.</p>

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
            Pesan Sekarang
          </Link>
        </div>
      </main>
    </div>
  );
}
