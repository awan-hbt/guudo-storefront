import { createServiceClient } from "@/lib/supabase-server";
import Link from "next/link";
import Image from "next/image";

interface MenuItem {
  id: string;
  name: string;
  description: string | null;
  price: number;
  category: string;
  unit: string;
  image_url: string | null;
  sort_order: number;
}

async function getMenuItems(): Promise<MenuItem[]> {
  try {
    const supabase = createServiceClient();
    const { data } = await supabase
      .from("menu_items")
      .select("id, name, description, price, category, unit, image_url, sort_order")
      .order("sort_order", { ascending: true });
    return data ?? [];
  } catch {
    return [];
  }
}

function formatPrice(price: number) {
  return `Rp ${price.toLocaleString("id-ID")}`;
}

function MenuItemCard({ item }: { item: MenuItem }) {
  return (
    <div className="bg-white rounded-2xl overflow-hidden shadow-sm border border-stone-100 flex flex-col">
      <div className="relative aspect-[4/3] bg-gradient-to-br from-amber-900 to-stone-800 flex items-center justify-center">
        {item.image_url ? (
          <Image
            src={item.image_url}
            alt={item.name}
            fill
            className="object-cover"
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
          />
        ) : (
          <span className="text-5xl select-none">🍢</span>
        )}
      </div>
      <div className="p-4 flex flex-col flex-1">
        <h3 className="font-semibold text-stone-900 text-base leading-snug">{item.name}</h3>
        {item.description && (
          <p className="text-stone-500 text-sm mt-1 flex-1 leading-relaxed">{item.description}</p>
        )}
        <div className="mt-3 flex items-center justify-between">
          <span className="font-bold text-amber-600 text-base">
            {formatPrice(item.price)}
            {item.unit !== "porsi" && (
              <span className="font-normal text-stone-400 text-sm">/{item.unit}</span>
            )}
          </span>
        </div>
      </div>
    </div>
  );
}

function AddonCard({ item }: { item: MenuItem }) {
  return (
    <div className="bg-white rounded-xl p-3 border border-stone-100 shadow-sm flex items-center gap-3">
      <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-amber-900 to-stone-800 flex items-center justify-center flex-shrink-0 overflow-hidden relative">
        {item.image_url ? (
          <Image src={item.image_url} alt={item.name} fill className="object-cover" sizes="48px" />
        ) : (
          <span className="text-xl select-none">🍢</span>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-stone-900 text-sm leading-tight truncate">{item.name}</p>
        <p className="text-amber-600 text-sm font-semibold mt-0.5">
          {formatPrice(item.price)}
          {item.unit !== "porsi" && (
            <span className="font-normal text-stone-400">/{item.unit}</span>
          )}
        </p>
      </div>
    </div>
  );
}

export default async function HomePage() {
  const items = await getMenuItems();
  const mainItems = items.filter((i) => i.category === "main");
  const addonItems = items.filter((i) => i.category === "addon");

  return (
    <div className="min-h-screen" style={{ background: "#faf8f3" }}>
      {/* ─── Navbar ─── */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-stone-900/90 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex items-center justify-between h-16">
          <span className="text-white font-bold text-xl tracking-widest uppercase">
            Guudo
          </span>
          <div className="flex items-center gap-4 sm:gap-6">
            <a
              href="#menu"
              className="text-white/60 hover:text-white text-sm transition-colors hidden sm:inline"
            >
              Menu
            </a>
            <a
              href="#how-to-order"
              className="text-white/60 hover:text-white text-sm transition-colors hidden sm:inline"
            >
              How to Order
            </a>
            <Link
              href="/order"
              className="bg-amber-500 hover:bg-amber-400 text-white text-sm font-semibold px-4 py-2 rounded-full transition-colors"
            >
              Order Now
            </Link>
          </div>
        </div>
      </nav>

      {/* ─── Hero ─── */}
      <section className="relative min-h-screen flex items-center justify-center bg-stone-900 overflow-hidden">
        {/* Ambient glow */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              "radial-gradient(ellipse 70% 60% at 65% 50%, rgba(245,158,11,0.18) 0%, transparent 70%)",
          }}
        />
        {/* Subtle dot grid */}
        <div
          className="absolute inset-0 pointer-events-none opacity-20"
          style={{
            backgroundImage:
              "radial-gradient(circle, rgba(255,255,255,0.15) 1px, transparent 1px)",
            backgroundSize: "32px 32px",
          }}
        />

        <div className="relative z-10 text-center px-4 max-w-2xl mx-auto">
          <p className="text-amber-400 text-xs font-semibold tracking-[0.35em] uppercase mb-5">
            Japanese Street Food · Jakarta
          </p>
          <h1 className="text-white font-bold tracking-tight mb-5"
            style={{ fontSize: "clamp(3rem, 10vw, 6rem)", lineHeight: 1 }}>
            Guudo Foods
          </h1>
          <p className="text-white/55 text-lg sm:text-xl leading-relaxed mb-10 max-w-sm mx-auto">
            Authentic yakitori & rice bowls. Made fresh, sold fast.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              href="/order"
              className="inline-flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-400 active:bg-amber-600 text-white font-semibold px-8 py-4 rounded-full text-base transition-all hover:scale-105 active:scale-100 shadow-lg shadow-amber-500/25"
            >
              Order Now
            </Link>
            <a
              href="#menu"
              className="inline-flex items-center justify-center gap-2 bg-white/8 hover:bg-white/15 text-white/80 font-semibold px-8 py-4 rounded-full text-base transition-all border border-white/15"
            >
              View Menu
            </a>
          </div>
        </div>

        {/* Scroll chevron */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 text-white/25 animate-bounce">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M6 9l6 6 6-6" />
          </svg>
        </div>
      </section>

      {/* ─── Menu ─── */}
      <section id="menu" className="py-20 px-4 sm:px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <p className="text-amber-600 text-xs font-semibold tracking-[0.3em] uppercase mb-2">
              Our Menu
            </p>
            <h2 className="text-3xl sm:text-4xl font-bold text-stone-900">
              Our Menu
            </h2>
            <p className="text-stone-500 mt-3 text-base max-w-sm mx-auto">
              All made fresh with quality ingredients.
            </p>
          </div>

          {mainItems.length > 0 && (
            <>
              <h3 className="text-xs font-bold text-amber-600 tracking-[0.25em] uppercase mb-5">
                Main Dish
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 mb-12">
                {mainItems.map((item) => (
                  <MenuItemCard key={item.id} item={item} />
                ))}
              </div>
            </>
          )}

          {addonItems.length > 0 && (
            <>
              <h3 className="text-xs font-bold text-amber-600 tracking-[0.25em] uppercase mb-5">
                Add-ons
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {addonItems.map((item) => (
                  <AddonCard key={item.id} item={item} />
                ))}
              </div>
            </>
          )}

          <div className="text-center mt-14">
            <Link
              href="/order"
              className="inline-flex items-center gap-2 bg-stone-900 hover:bg-stone-800 text-white font-semibold px-10 py-4 rounded-full text-base transition-all"
            >
              Start Order
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </Link>
          </div>
        </div>
      </section>

      {/* ─── About ─── */}
      <section id="about" className="py-20 px-4 sm:px-6 bg-stone-900">
        <div className="max-w-3xl mx-auto text-center">
          <p className="text-amber-400 text-xs font-semibold tracking-[0.3em] uppercase mb-3">
            Our Story
          </p>
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-6">
            About Guudo
          </h2>
          <p className="text-white/60 text-base sm:text-lg leading-relaxed mb-4">
            Guudo was born from a love of Japanese street food — especially
            yakitori made with binchotan charcoal and our secret tare sauce.
          </p>
          <p className="text-white/60 text-base sm:text-lg leading-relaxed">
            Every portion is made fresh when you order. We sell in limited
            quantities each day to ensure consistent quality.
          </p>
        </div>
      </section>

      {/* ─── How to Order ─── */}
      <section id="how-to-order" className="py-20 px-4 sm:px-6">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-14">
            <p className="text-amber-600 text-xs font-semibold tracking-[0.3em] uppercase mb-2">
              Simple & Fast
            </p>
            <h2 className="text-3xl sm:text-4xl font-bold text-stone-900">
              How to Order
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
            {[
              {
                step: "01",
                title: "Choose Your Menu",
                desc: "Pick your favorites and add them to your cart. Stock is limited!",
              },
              {
                step: "02",
                title: "Fill In Details & Pay",
                desc: "Enter your name, phone number, and pay via QRIS or bank transfer.",
              },
              {
                step: "03",
                title: "Pick Up Your Order",
                desc: "Show your reference code at pickup. Done!",
              },
            ].map(({ step, title, desc }) => (
              <div key={step} className="flex flex-col items-center text-center sm:items-start sm:text-left">
                <div className="w-12 h-12 rounded-full bg-amber-500 flex items-center justify-center mb-4 flex-shrink-0">
                  <span className="text-white font-bold text-sm">{step}</span>
                </div>
                <h3 className="font-bold text-stone-900 text-lg mb-2">{title}</h3>
                <p className="text-stone-500 text-sm leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>

          <div className="text-center mt-12">
            <Link
              href="/order"
              className="inline-flex items-center gap-2 bg-amber-500 hover:bg-amber-400 text-white font-semibold px-10 py-4 rounded-full text-base transition-all shadow-lg shadow-amber-500/20"
            >
              Order Now
            </Link>
          </div>
        </div>
      </section>

      {/* ─── Footer ─── */}
      <footer className="bg-stone-900 py-12 px-4 sm:px-6">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
            <div>
              <p className="text-white font-bold text-xl tracking-widest uppercase mb-1">Guudo</p>
              <p className="text-white/40 text-sm">Japanese Street Food · guudo.id</p>
            </div>
            <nav className="flex flex-wrap justify-center gap-5 text-sm text-white/50">
              <Link href="/faq" className="hover:text-white/80 transition-colors">FAQ</Link>
              <Link href="/refund-policy" className="hover:text-white/80 transition-colors">Refund Policy</Link>
              <Link href="/terms" className="hover:text-white/80 transition-colors">Terms & Conditions</Link>
            </nav>
          </div>
          <div className="mt-8 pt-8 border-t border-white/10 text-center text-white/30 text-xs">
            © {new Date().getFullYear()} Guudo. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}
