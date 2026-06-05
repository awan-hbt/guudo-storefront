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
    "Authentic yakitori & rice bowls in Jakarta. Order now before it sells out.",
  metadataBase: new URL("https://guudo.id"),
  openGraph: {
    title: "Guudo — Japanese Street Food",
    description: "Authentic yakitori & rice bowls in Jakarta.",
    url: "https://guudo.id",
    siteName: "Guudo",
    locale: "en_US",
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
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable}`}
    >
      <body className="min-h-screen">{children}</body>
    </html>
  );
}
