import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Guudo — Japanese Street Food",
  description:
    "Yakitori & rice bowls autentik di Jakarta. Pesan sekarang sebelum habis.",
  metadataBase: new URL("https://guudo.id"),
  openGraph: {
    title: "Guudo — Japanese Street Food",
    description: "Yakitori & rice bowls autentik di Jakarta.",
    url: "https://guudo.id",
    siteName: "Guudo",
    locale: "id_ID",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="id"
      className={`${geistSans.variable} ${geistMono.variable}`}
    >
      <body className="min-h-screen">{children}</body>
    </html>
  );
}
