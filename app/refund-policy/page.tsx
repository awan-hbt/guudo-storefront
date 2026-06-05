import Link from "next/link";

export const metadata = {
  title: "Kebijakan Refund — Guudo",
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
          <span className="text-white/60 text-sm">Kebijakan Refund</span>
        </div>
      </nav>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-12 prose prose-stone prose-sm max-w-none">
        <h1 className="text-3xl font-bold text-stone-900 mb-8 not-prose">Kebijakan Refund</h1>

        <div className="space-y-6 text-stone-700 text-sm leading-relaxed">
          <section>
            <h2 className="text-lg font-bold text-stone-900 mb-2">1. Pembatalan Pesanan</h2>
            <p>
              Karena makanan disiapkan segera setelah pesanan dikonfirmasi, kami tidak dapat menerima
              pembatalan setelah pembayaran berhasil diproses. Pastikan pesananmu sudah benar sebelum
              melanjutkan ke pembayaran.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-stone-900 mb-2">2. Kondisi yang Memenuhi Syarat Refund</h2>
            <p>Refund hanya diproses dalam kondisi berikut:</p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li>Pesanan tidak dapat dipenuhi karena kehabisan stok setelah pembayaran dikonfirmasi.</li>
              <li>Terjadi kesalahan teknis yang menyebabkan double charge.</li>
              <li>Makanan yang diterima tidak sesuai dengan pesanan (item salah).</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold text-stone-900 mb-2">3. Proses Refund</h2>
            <p>
              Untuk mengajukan refund, hubungi kami via WhatsApp dengan menyertakan kode referensi
              pesananmu. Refund akan diproses dalam 3–5 hari kerja melalui metode pembayaran yang sama.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-stone-900 mb-2">4. Pengecualian</h2>
            <p>
              Kami tidak menerima klaim refund berdasarkan preferensi rasa atau ketidakhadiran untuk
              mengambil pesanan.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-stone-900 mb-2">5. Kontak</h2>
            <p>
              Pertanyaan tentang refund dapat diajukan melalui WhatsApp yang tertera di profil kami
              atau email ke <span className="font-medium">support@guudo.id</span>.
            </p>
          </section>
        </div>

        <div className="mt-10">
          <Link href="/" className="text-amber-600 hover:text-amber-700 text-sm font-medium transition-colors">
            ← Kembali ke Beranda
          </Link>
        </div>
      </main>
    </div>
  );
}
