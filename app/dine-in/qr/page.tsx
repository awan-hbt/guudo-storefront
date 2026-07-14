import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Guudo Dine-in QR",
  description: "Printable QR for Guudo dine-in ordering",
  robots: { index: false, follow: false },
};

const DINE_IN_URL = "https://guudo.id/dine-in";
const QR_IMG = `https://api.qrserver.com/v1/create-qr-code/?size=360x360&data=${encodeURIComponent(DINE_IN_URL)}`;

export default function DineInQrPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 py-12 bg-[#faf8f3]">
      <p className="font-bold text-2xl tracking-widest uppercase text-stone-900 mb-2">Guudo</p>
      <p className="text-amber-700 font-semibold text-sm uppercase tracking-wider mb-8">
        Scan to order · Dine-in
      </p>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={QR_IMG}
        alt={`QR code for ${DINE_IN_URL}`}
        width={360}
        height={360}
        className="bg-white p-4 rounded-2xl border border-stone-200 shadow-sm"
      />
      <p className="mt-6 text-stone-500 text-sm text-center max-w-xs">
        Point your camera at this code, pick your dishes, enter your name, and send to the kitchen.
      </p>
      <p className="mt-3 text-stone-400 text-xs font-mono">{DINE_IN_URL}</p>
      <p className="mt-8 text-stone-400 text-xs print:hidden">
        Print this page for table tents ·{" "}
        <a href={DINE_IN_URL} className="underline hover:text-stone-600">
          open menu
        </a>
      </p>
    </div>
  );
}
