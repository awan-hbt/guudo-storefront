import Link from "next/link";

export const metadata = {
  title: "Syarat & Ketentuan — Guudo",
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
          <span className="text-white/60 text-sm">Syarat & Ketentuan</span>
        </div>
      </nav>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-12">
        <h1 className="text-3xl font-bold text-stone-900 mb-2">Syarat & Ketentuan</h1>
        <p className="text-stone-400 text-sm mb-8">Terakhir diperbarui: Juni 2025</p>

        <div className="space-y-6 text-stone-700 text-sm leading-relaxed">
          <section>
            <h2 className="text-lg font-bold text-stone-900 mb-2">1. Penerimaan Syarat</h2>
            <p>
              Dengan menggunakan layanan pemesanan online Guudo di guudo.id, kamu menyetujui syarat
              dan ketentuan yang tertera di halaman ini.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-stone-900 mb-2">2. Layanan</h2>
            <p>
              Guudo menyediakan platform pemesanan makanan online untuk menu yakitori dan rice bowl
              yang dijual di booth fisik kami. Semua pesanan bersifat pickup — tidak ada layanan
              delivery.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-stone-900 mb-2">3. Pemesanan & Pembayaran</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>Pesanan dianggap sah setelah pembayaran dikonfirmasi.</li>
              <li>Harga yang tertera adalah harga final dalam Rupiah (IDR).</li>
              <li>Stok bersifat terbatas dan dapat berubah secara real-time.</li>
              <li>Guudo berhak membatalkan pesanan jika stok tidak tersedia setelah pembayaran,
                dengan mengembalikan dana penuh.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold text-stone-900 mb-2">4. Data Pribadi</h2>
            <p>
              Data yang kamu berikan (nama, nomor HP) hanya digunakan untuk keperluan pemrosesan
              pesanan dan komunikasi terkait pesananmu. Kami tidak menjual data ke pihak ketiga.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-stone-900 mb-2">5. Batasan Tanggung Jawab</h2>
            <p>
              Guudo tidak bertanggung jawab atas kerugian yang timbul akibat keterlambatan atau
              kegagalan sistem di luar kendali kami, termasuk gangguan jaringan atau sistem
              pembayaran pihak ketiga.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-stone-900 mb-2">6. Perubahan Syarat</h2>
            <p>
              Guudo berhak mengubah syarat dan ketentuan ini sewaktu-waktu. Perubahan akan
              diinformasikan melalui website ini.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-stone-900 mb-2">7. Hukum yang Berlaku</h2>
            <p>
              Syarat ini diatur oleh hukum Republik Indonesia. Setiap sengketa diselesaikan melalui
              musyawarah terlebih dahulu.
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
