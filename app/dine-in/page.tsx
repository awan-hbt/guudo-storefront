"use client";

import { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import { createClient } from "@/lib/supabase-browser";

interface MenuItem {
  id: string;
  name: string;
  description: string | null;
  price: number;
  category: "main" | "addon" | "frozen" | "drinks" | "dessert";
  unit: string;
  imageUrl: string | null;
  stockAvailable: number;
  stockGroupId: string | null;
  sortOrder: number;
  variantGroup: string | null;
}

interface VariantGroup {
  key: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  variants: MenuItem[];
  sortOrder: number;
}

type Step = "browsing" | "checkout" | "confirmed";

function formatPrice(n: number) {
  return `Rp ${n.toLocaleString("id-ID")}`;
}

function formatUnitLabel(unit: string) {
  if (/^\d+pc$/i.test(unit)) {
    return unit.replace(/^(\d+)pc$/i, "$1 pc");
  }
  return unit;
}

function groupVariantItems(items: MenuItem[]): {
  standalone: MenuItem[];
  groups: VariantGroup[];
} {
  const standalone: MenuItem[] = [];
  const groupMap = new Map<string, VariantGroup>();

  for (const item of items) {
    if (!item.variantGroup) {
      standalone.push(item);
      continue;
    }
    const existing = groupMap.get(item.variantGroup);
    if (existing) {
      existing.variants.push(item);
      existing.sortOrder = Math.min(existing.sortOrder, item.sortOrder);
      if (!existing.imageUrl && item.imageUrl) existing.imageUrl = item.imageUrl;
      if (!existing.description && item.description) existing.description = item.description;
    } else {
      groupMap.set(item.variantGroup, {
        key: item.variantGroup,
        name: item.name,
        description: item.description,
        imageUrl: item.imageUrl,
        variants: [item],
        sortOrder: item.sortOrder,
      });
    }
  }

  const groups = Array.from(groupMap.values())
    .map((g) => ({
      ...g,
      variants: [...g.variants].sort((a, b) => a.price - b.price),
    }))
    .sort((a, b) => a.sortOrder - b.sortOrder);

  return { standalone, groups };
}

function StockBadge({ stock }: { stock: number }) {
  if (stock <= 0) return <span className="text-xs font-semibold text-red-500">Sold Out</span>;
  if (stock <= 5) return <span className="text-xs font-semibold text-amber-600">{stock} left</span>;
  return null;
}

function QtyControl({
  qty,
  onAdd,
  onRemove,
  disabled,
}: {
  qty: number;
  onAdd: () => void;
  onRemove: () => void;
  disabled: boolean;
}) {
  if (qty === 0) {
    return (
      <button
        type="button"
        onClick={onAdd}
        disabled={disabled}
        className="px-3 py-1.5 text-sm font-semibold rounded-full bg-amber-500 text-white hover:bg-amber-400 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
      >
        {disabled ? "Sold Out" : "+ Add"}
      </button>
    );
  }
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={onRemove}
        className="w-8 h-8 rounded-full border-2 border-stone-300 flex items-center justify-center text-stone-600 hover:border-stone-500 transition-colors font-bold text-lg leading-none"
      >
        −
      </button>
      <span className="w-5 text-center font-semibold text-stone-900 text-sm">{qty}</span>
      <button
        type="button"
        onClick={onAdd}
        disabled={disabled}
        className="w-8 h-8 rounded-full bg-amber-500 flex items-center justify-center text-white hover:bg-amber-400 disabled:opacity-40 disabled:cursor-not-allowed transition-colors font-bold text-lg leading-none"
      >
        +
      </button>
    </div>
  );
}

export default function DineInPage() {
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [cart, setCart] = useState<Record<string, number>>({});
  const [cartOpen, setCartOpen] = useState(false);
  const [selectedVariants, setSelectedVariants] = useState<Record<string, string>>({});
  const [step, setStep] = useState<Step>("browsing");
  const [name, setName] = useState("");
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [referenceCode, setReferenceCode] = useState("");
  const [orderError, setOrderError] = useState("");
  const [confirmedName, setConfirmedName] = useState("");

  useEffect(() => {
    fetch("/api/stock")
      .then((r) => r.json())
      .then((stockData) => {
        const items: MenuItem[] = (stockData.items ?? []).map(
          (item: MenuItem & { variantGroup?: string | null }) => ({
            ...item,
            variantGroup: item.variantGroup ?? null,
          })
        );
        setMenuItems(items);

        const defaults: Record<string, string> = {};
        for (const item of items) {
          if (!item.variantGroup) continue;
          const current = defaults[item.variantGroup];
          if (!current) {
            defaults[item.variantGroup] = item.id;
          } else {
            const currentItem = items.find((i) => i.id === current);
            if (currentItem && item.price < currentItem.price) {
              defaults[item.variantGroup] = item.id;
            }
          }
        }
        setSelectedVariants(defaults);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (loading) return;
    const supabase = createClient();
    const channel = supabase
      .channel("dine-in-stock")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "menu_items" },
        (payload) => {
          setMenuItems((prev) =>
            prev.map((item) =>
              item.id === payload.new.id
                ? { ...item, stockAvailable: payload.new.stock_available ?? item.stockAvailable }
                : item
            )
          );
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "stock_groups" },
        (payload) => {
          setMenuItems((prev) =>
            prev.map((item) =>
              item.stockGroupId === payload.new.id
                ? { ...item, stockAvailable: payload.new.available }
                : item
            )
          );
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [loading]);

  const cartCount = Object.values(cart).reduce((a, b) => a + b, 0);
  const cartItems = Object.entries(cart)
    .filter(([, qty]) => qty > 0)
    .map(([id, qty]) => ({
      menuItem: menuItems.find((m) => m.id === id)!,
      quantity: qty,
    }))
    .filter((ci) => ci.menuItem);

  const totalPrice = cartItems.reduce(
    (sum, { menuItem, quantity }) => sum + menuItem.price * quantity,
    0
  );

  const addToCart = useCallback(
    (id: string) => {
      const item = menuItems.find((m) => m.id === id);
      if (!item) return;
      setCart((prev) => {
        const current = prev[id] ?? 0;
        if (current >= item.stockAvailable) return prev;
        return { ...prev, [id]: current + 1 };
      });
    },
    [menuItems]
  );

  const removeFromCart = useCallback((id: string) => {
    setCart((prev) => {
      const current = prev[id] ?? 0;
      if (current <= 0) return prev;
      const next = { ...prev, [id]: current - 1 };
      if (next[id] === 0) delete next[id];
      return next;
    });
  }, []);

  async function placeOrder() {
    setFormError("");
    if (!name.trim()) {
      setFormError("Please enter your name.");
      return;
    }
    if (cartItems.length === 0) {
      setFormError("Your cart is empty.");
      return;
    }

    setSubmitting(true);
    setOrderError("");

    try {
      const res = await fetch("/api/dine-in/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          items: cartItems.map(({ menuItem, quantity }) => ({
            menuItemId: menuItem.id,
            quantity,
            unitPrice: menuItem.price,
          })),
          totalPrice,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setOrderError(data.error ?? "Failed to place order. Please try again.");
        setSubmitting(false);
        return;
      }

      setReferenceCode(data.referenceCode);
      setConfirmedName(name.trim());
      setCart({});
      setStep("confirmed");
    } catch {
      setOrderError("Something went wrong. Check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  }

  const mainItems = menuItems.filter((i) => i.category === "main");
  const { standalone: standaloneMains, groups: mainVariantGroups } = groupVariantItems(mainItems);
  const addonItems = menuItems.filter((i) => i.category === "addon");
  const frozenItems = menuItems.filter((i) => i.category === "frozen");
  const drinksItems = menuItems.filter((i) => i.category === "drinks");
  const dessertItems = menuItems.filter((i) => i.category === "dessert");

  function renderMenuCard(
    item: MenuItem,
    accent: string,
    emoji: string
  ) {
    return (
      <div
        key={item.id}
        className="bg-white rounded-2xl overflow-hidden border border-stone-100 shadow-sm flex"
      >
        <div
          className={`relative w-28 flex-shrink-0 bg-gradient-to-br ${accent} flex items-center justify-center`}
        >
          {item.imageUrl ? (
            <Image
              src={item.imageUrl}
              alt={item.name}
              fill
              className="object-cover"
              sizes="112px"
            />
          ) : (
            <span className="text-3xl select-none">{emoji}</span>
          )}
        </div>
        <div className="p-4 flex flex-col flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 mb-1">
            <h3 className="font-semibold text-stone-900 text-sm leading-snug">{item.name}</h3>
            <StockBadge stock={item.stockAvailable} />
          </div>
          {item.description && (
            <p className="text-stone-400 text-xs leading-relaxed mb-3 line-clamp-2">
              {item.description}
            </p>
          )}
          <div className="mt-auto flex items-center justify-between gap-2">
            <span className="font-bold text-amber-600 text-sm">
              {formatPrice(item.price)}
              {item.unit !== "porsi" && (
                <span className="text-stone-400 font-normal text-xs">/{item.unit}</span>
              )}
            </span>
            <QtyControl
              qty={cart[item.id] ?? 0}
              onAdd={() => addToCart(item.id)}
              onRemove={() => removeFromCart(item.id)}
              disabled={item.stockAvailable <= 0 || (cart[item.id] ?? 0) >= item.stockAvailable}
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: "#faf8f3" }}>
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white border-b border-stone-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex items-center justify-between h-14">
          <div className="flex items-center gap-3">
            <span className="font-bold text-lg tracking-widest text-stone-900 uppercase">
              Guudo
            </span>
            <span className="text-xs font-semibold uppercase tracking-wider bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full">
              Dine-in
            </span>
          </div>
          <div className="flex items-center gap-4">
            {step === "browsing" && cartCount > 0 && (
              <button
                type="button"
                onClick={() => setCartOpen(true)}
                className="lg:hidden flex items-center gap-2 bg-amber-500 text-white text-sm font-semibold px-3 py-1.5 rounded-full"
              >
                Cart {cartCount}
              </button>
            )}
            {step !== "browsing" && step !== "confirmed" && (
              <button
                type="button"
                onClick={() => {
                  setStep("browsing");
                  setFormError("");
                  setOrderError("");
                }}
                className="text-stone-500 hover:text-stone-900 text-sm transition-colors"
              >
                ← Back
              </button>
            )}
          </div>
        </div>
      </nav>

      <main className="pt-14">
        {step === "browsing" && (
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
            <p className="text-stone-500 text-sm mb-6">
              Select your dishes, then send your order to the kitchen. Pay at the counter.
            </p>
            <div className="flex gap-8 items-start">
              <div className="flex-1 min-w-0">
                {loading ? (
                  <div className="text-center py-20 text-stone-400">Loading menu...</div>
                ) : (
                  <>
                    {(standaloneMains.length > 0 || mainVariantGroups.length > 0) && (
                      <section className="mb-10">
                        {standaloneMains.length > 0 && (
                          <>
                            <h2 className="text-xs font-bold text-amber-600 tracking-[0.25em] uppercase mb-4">
                              Main Dish
                            </h2>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
                              {standaloneMains.map((item) =>
                                renderMenuCard(item, "from-amber-900 to-stone-800", "🍢")
                              )}
                            </div>
                          </>
                        )}

                        {mainVariantGroups.length > 0 && (
                          <>
                            <h2 className="text-xs font-bold text-amber-600 tracking-[0.25em] uppercase mb-4">
                              Dim Sum
                            </h2>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                              {mainVariantGroups.map((group) => {
                                const selectedId =
                                  selectedVariants[group.key] ?? group.variants[0]?.id;
                                const selected =
                                  group.variants.find((v) => v.id === selectedId) ??
                                  group.variants[0];
                                if (!selected) return null;
                                return (
                                  <div
                                    key={group.key}
                                    className="bg-white rounded-2xl overflow-hidden border border-stone-100 shadow-sm flex"
                                  >
                                    <div className="relative w-28 flex-shrink-0 bg-gradient-to-br from-amber-900 to-stone-800 flex items-center justify-center">
                                      {group.imageUrl ? (
                                        <Image
                                          src={group.imageUrl}
                                          alt={group.name}
                                          fill
                                          className="object-cover"
                                          sizes="112px"
                                        />
                                      ) : (
                                        <span className="text-3xl select-none">🥟</span>
                                      )}
                                    </div>
                                    <div className="p-4 flex flex-col flex-1 min-w-0">
                                      <div className="flex items-start justify-between gap-2 mb-1">
                                        <h3 className="font-semibold text-stone-900 text-sm leading-snug">
                                          {group.name}
                                        </h3>
                                        <StockBadge stock={selected.stockAvailable} />
                                      </div>
                                      {group.description && (
                                        <p className="text-stone-400 text-xs leading-relaxed mb-2 line-clamp-2">
                                          {group.description}
                                        </p>
                                      )}
                                      <div className="flex gap-1.5 mb-3">
                                        {group.variants.map((v) => {
                                          const active = v.id === selected.id;
                                          return (
                                            <button
                                              key={v.id}
                                              type="button"
                                              onClick={() =>
                                                setSelectedVariants((prev) => ({
                                                  ...prev,
                                                  [group.key]: v.id,
                                                }))
                                              }
                                              className={`px-2.5 py-1 rounded-full text-xs font-semibold transition-colors ${
                                                active
                                                  ? "bg-amber-500 text-white"
                                                  : "bg-stone-100 text-stone-600 hover:bg-stone-200"
                                              }`}
                                            >
                                              {formatUnitLabel(v.unit)}
                                            </button>
                                          );
                                        })}
                                      </div>
                                      <div className="mt-auto flex items-center justify-between gap-2">
                                        <span className="font-bold text-amber-600 text-sm">
                                          {formatPrice(selected.price)}
                                        </span>
                                        <QtyControl
                                          qty={cart[selected.id] ?? 0}
                                          onAdd={() => addToCart(selected.id)}
                                          onRemove={() => removeFromCart(selected.id)}
                                          disabled={
                                            selected.stockAvailable <= 0 ||
                                            (cart[selected.id] ?? 0) >= selected.stockAvailable
                                          }
                                        />
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </>
                        )}
                      </section>
                    )}

                    {addonItems.length > 0 && (
                      <section className={frozenItems.length > 0 ? "mb-10" : ""}>
                        <h2 className="text-xs font-bold text-amber-600 tracking-[0.25em] uppercase mb-4">
                          Add-ons
                        </h2>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {addonItems.map((item) => (
                            <div
                              key={item.id}
                              className="bg-white rounded-xl border border-stone-100 shadow-sm p-3 flex items-center gap-3"
                            >
                              <div className="relative w-12 h-12 rounded-lg flex-shrink-0 bg-gradient-to-br from-amber-900 to-stone-800 flex items-center justify-center overflow-hidden">
                                {item.imageUrl ? (
                                  <Image
                                    src={item.imageUrl}
                                    alt={item.name}
                                    fill
                                    className="object-cover"
                                    sizes="48px"
                                  />
                                ) : (
                                  <span className="text-xl select-none">🍢</span>
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between gap-1 mb-0.5">
                                  <p className="font-medium text-stone-900 text-sm truncate">
                                    {item.name}
                                  </p>
                                  <StockBadge stock={item.stockAvailable} />
                                </div>
                                <p className="text-amber-600 text-sm font-bold">
                                  {formatPrice(item.price)}
                                  <span className="text-stone-400 font-normal text-xs">
                                    /{item.unit}
                                  </span>
                                </p>
                              </div>
                              <QtyControl
                                qty={cart[item.id] ?? 0}
                                onAdd={() => addToCart(item.id)}
                                onRemove={() => removeFromCart(item.id)}
                                disabled={
                                  item.stockAvailable <= 0 ||
                                  (cart[item.id] ?? 0) >= item.stockAvailable
                                }
                              />
                            </div>
                          ))}
                        </div>
                      </section>
                    )}

                    {frozenItems.length > 0 && (
                      <section className={drinksItems.length > 0 ? "mb-10" : ""}>
                        <h2 className="text-xs font-bold text-sky-600 tracking-[0.25em] uppercase mb-4">
                          Frozen
                        </h2>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          {frozenItems.map((item) =>
                            renderMenuCard(item, "from-sky-900 to-stone-800", "🧊")
                          )}
                        </div>
                      </section>
                    )}

                    {drinksItems.length > 0 && (
                      <section className={dessertItems.length > 0 ? "mb-10" : ""}>
                        <h2 className="text-xs font-bold text-violet-600 tracking-[0.25em] uppercase mb-4">
                          Drinks
                        </h2>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          {drinksItems.map((item) =>
                            renderMenuCard(item, "from-violet-900 to-stone-800", "🥤")
                          )}
                        </div>
                      </section>
                    )}

                    {dessertItems.length > 0 && (
                      <section>
                        <h2 className="text-xs font-bold text-rose-600 tracking-[0.25em] uppercase mb-4">
                          Dessert
                        </h2>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          {dessertItems.map((item) =>
                            renderMenuCard(item, "from-rose-900 to-stone-800", "🍰")
                          )}
                        </div>
                      </section>
                    )}
                  </>
                )}
              </div>

              <aside className="hidden lg:block w-80 flex-shrink-0 sticky top-20">
                <CartPanel
                  cartItems={cartItems}
                  totalPrice={totalPrice}
                  onProceed={() => {
                    if (cartItems.length === 0) return;
                    setStep("checkout");
                  }}
                />
              </aside>
            </div>
          </div>
        )}

        {step === "browsing" && cartCount > 0 && (
          <div className="fixed bottom-4 left-4 right-4 lg:hidden z-40">
            <button
              type="button"
              onClick={() => setCartOpen(true)}
              className="w-full bg-stone-900 text-white font-semibold py-4 rounded-2xl flex items-center justify-between px-5 shadow-xl"
            >
              <span className="bg-amber-500 text-white text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center">
                {cartCount}
              </span>
              <span>View Cart</span>
              <span className="text-stone-400 text-sm">{formatPrice(totalPrice)}</span>
            </button>
          </div>
        )}

        {cartOpen && (
          <div className="fixed inset-0 z-50 lg:hidden">
            <div
              className="absolute inset-0 bg-black/50"
              onClick={() => setCartOpen(false)}
            />
            <div className="absolute bottom-0 left-0 right-0 bg-white rounded-t-2xl p-5 max-h-[85vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-stone-900 text-lg">Cart</h3>
                <button
                  type="button"
                  onClick={() => setCartOpen(false)}
                  className="text-stone-400 hover:text-stone-700"
                >
                  ✕
                </button>
              </div>
              <CartPanel
                cartItems={cartItems}
                totalPrice={totalPrice}
                onProceed={() => {
                  setCartOpen(false);
                  setStep("checkout");
                }}
              />
            </div>
          </div>
        )}

        {step === "checkout" && (
          <div className="max-w-2xl mx-auto px-4 sm:px-6 py-10">
            <h1 className="text-2xl font-bold text-stone-900 mb-2">Send Order</h1>
            <p className="text-stone-500 text-sm mb-8">
              Enter your name so kitchen can call you. Pay at the counter when ready.
            </p>

            <div className="bg-white rounded-2xl border border-stone-100 p-5 mb-6">
              <h2 className="font-semibold text-stone-700 text-sm mb-3">Order Summary</h2>
              <div className="space-y-2 mb-4">
                {cartItems.map(({ menuItem, quantity }) => (
                  <div key={menuItem.id} className="flex justify-between text-sm">
                    <span className="text-stone-600">
                      {menuItem.name}
                      {menuItem.unit !== "porsi" ? ` (${formatUnitLabel(menuItem.unit)})` : ""}{" "}
                      <span className="text-stone-400">×{quantity}</span>
                    </span>
                    <span className="font-medium text-stone-900">
                      {formatPrice(menuItem.price * quantity)}
                    </span>
                  </div>
                ))}
              </div>
              <div className="border-t border-stone-100 pt-3 flex justify-between font-bold text-stone-900">
                <span>Total</span>
                <span className="text-amber-600">{formatPrice(totalPrice)}</span>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-stone-100 p-5 mb-6">
              <label className="block text-sm font-medium text-stone-700 mb-1.5">
                Your name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Name for your order"
                className="w-full border border-stone-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent transition"
                autoFocus
              />
            </div>

            {(formError || orderError) && (
              <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm mb-4">
                {formError || orderError}
              </div>
            )}

            <button
              type="button"
              onClick={placeOrder}
              disabled={submitting}
              className="w-full bg-amber-500 hover:bg-amber-400 disabled:bg-stone-200 disabled:text-stone-400 text-white font-bold py-4 rounded-2xl text-base transition-colors"
            >
              {submitting ? "Sending..." : "Send Order to Kitchen"}
            </button>
          </div>
        )}

        {step === "confirmed" && (
          <div className="max-w-md mx-auto px-4 sm:px-6 py-16 text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <svg
                className="w-8 h-8 text-green-600"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>

            <h1 className="text-2xl font-bold text-stone-900 mb-2">Order Sent!</h1>
            <p className="text-stone-500 text-base mb-6">
              Kitchen has your order. Please wait — we&apos;ll call your name.
            </p>

            <div className="bg-amber-50 border-2 border-amber-200 rounded-2xl p-6 mb-4">
              <p className="text-amber-700 text-xs font-semibold uppercase tracking-widest mb-2">
                Your name
              </p>
              <p className="text-stone-900 text-2xl font-bold">{confirmedName}</p>
            </div>

            <div className="bg-white border border-stone-100 rounded-2xl p-6 mb-8">
              <p className="text-stone-500 text-xs font-semibold uppercase tracking-widest mb-2">
                Order code
              </p>
              <p className="text-stone-900 text-3xl font-bold tracking-widest">{referenceCode}</p>
              <p className="text-stone-400 text-sm mt-2">Show this to staff if needed.</p>
            </div>

            <button
              type="button"
              onClick={() => {
                setStep("browsing");
                setName("");
                setReferenceCode("");
                setConfirmedName("");
                setOrderError("");
              }}
              className="inline-flex items-center gap-2 bg-stone-900 hover:bg-stone-800 text-white font-semibold px-8 py-4 rounded-full transition-all"
            >
              Order again
            </button>
          </div>
        )}
      </main>
    </div>
  );
}

function CartPanel({
  cartItems,
  totalPrice,
  onProceed,
}: {
  cartItems: { menuItem: MenuItem; quantity: number }[];
  totalPrice: number;
  onProceed: () => void;
}) {
  return (
    <div className="bg-white rounded-2xl border border-stone-100 shadow-sm p-5">
      <h3 className="font-bold text-stone-900 mb-4">Cart</h3>
      {cartItems.length === 0 ? (
        <p className="text-stone-400 text-sm text-center py-4">No items yet</p>
      ) : (
        <>
          <div className="space-y-3 mb-4">
            {cartItems.map(({ menuItem, quantity }) => (
              <div key={menuItem.id} className="flex justify-between items-start text-sm">
                <span className="text-stone-700 flex-1 pr-2 leading-snug">
                  {menuItem.name}{" "}
                  <span className="text-stone-400">
                    ×{quantity}
                    {menuItem.unit !== "porsi" ? ` · ${formatUnitLabel(menuItem.unit)}` : ""}
                  </span>
                </span>
                <span className="font-semibold text-stone-900 flex-shrink-0">
                  {formatPrice(menuItem.price * quantity)}
                </span>
              </div>
            ))}
          </div>
          <div className="border-t border-stone-100 pt-3 flex justify-between font-bold text-stone-900 mb-5">
            <span>Total</span>
            <span className="text-amber-600">{formatPrice(totalPrice)}</span>
          </div>
          <button
            type="button"
            onClick={onProceed}
            className="w-full bg-amber-500 hover:bg-amber-400 text-white font-bold py-3 rounded-xl text-sm transition-colors"
          >
            Checkout →
          </button>
        </>
      )}
    </div>
  );
}
