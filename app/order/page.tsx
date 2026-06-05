"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import { createClient } from "@/lib/supabase-browser";

// ─── Types ───────────────────────────────────────────────────────────────────

interface MenuItem {
  id: string;
  name: string;
  description: string | null;
  price: number;
  category: "main" | "addon";
  unit: string;
  imageUrl: string | null;
  stockAvailable: number;
  stockGroupId: string | null;
  sortOrder: number;
}

type Step = "browsing" | "checkout" | "payment" | "confirmed";
type PaymentMethod = "qris" | "transfer";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatPrice(n: number) {
  return `Rp ${n.toLocaleString("id-ID")}`;
}

// ─── Sub-components ──────────────────────────────────────────────────────────

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
        onClick={onRemove}
        className="w-8 h-8 rounded-full border-2 border-stone-300 flex items-center justify-center text-stone-600 hover:border-stone-500 transition-colors font-bold text-lg leading-none"
      >
        −
      </button>
      <span className="w-5 text-center font-semibold text-stone-900 text-sm">{qty}</span>
      <button
        onClick={onAdd}
        disabled={disabled}
        className="w-8 h-8 rounded-full bg-amber-500 flex items-center justify-center text-white hover:bg-amber-400 disabled:opacity-40 disabled:cursor-not-allowed transition-colors font-bold text-lg leading-none"
      >
        +
      </button>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function OrderPage() {
  // ── Data ──
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [ipaymuEnabled, setIpaymuEnabled] = useState(false);
  const [loading, setLoading] = useState(true);

  // ── Cart ──
  const [cart, setCart] = useState<Record<string, number>>({});
  const [cartOpen, setCartOpen] = useState(false);

  // ── Flow ──
  const [step, setStep] = useState<Step>("browsing");

  // ── Form ──
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [building, setBuilding] = useState("");
  const [floor, setFloor] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("transfer");
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // ── Order result ──
  const [referenceCode, setReferenceCode] = useState("");
  const [qrString, setQrString] = useState<string | null>(null);
  const [orderError, setOrderError] = useState("");
  // totalPriceOverride is set when restoring from sessionStorage (cart is empty after refresh)
  const [totalPriceOverride, setTotalPriceOverride] = useState<number | null>(null);

  // ── Receipt upload ──
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [uploadState, setUploadState] = useState<"idle" | "uploading" | "done" | "error">("idle");
  const [uploadError, setUploadError] = useState("");

  // ── QRIS polling ──
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [qrisStatus, setQrisStatus] = useState<"waiting" | "paid" | "timeout">("waiting");
  const qrisStartRef = useRef<number>(0);

  // ── Restore payment state from sessionStorage on mount ──
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem("guudo_payment");
      if (saved) {
        const p = JSON.parse(saved);
        if (p.step === "payment" || p.step === "confirmed") {
          setStep(p.step);
          setReferenceCode(p.referenceCode ?? "");
          setQrString(p.qrString ?? null);
          setTotalPriceOverride(p.totalPrice ?? 0);
          setPaymentMethod(p.paymentMethod ?? "transfer");
          setName(p.name ?? "");
          setPhone(p.phone ?? "");
        }
      }
    } catch {}
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Load menu + config ──
  useEffect(() => {
    Promise.all([
      fetch("/api/stock").then((r) => r.json()),
      fetch("/api/config").then((r) => r.json()),
    ])
      .then(([stockData, configData]) => {
        setMenuItems(stockData.items ?? []);
        setIpaymuEnabled(configData.ipaymuEnabled ?? false);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  // ── Supabase Realtime stock updates ──
  useEffect(() => {
    if (loading) return;
    const supabase = createClient();
    const channel = supabase
      .channel("storefront-stock")
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

  // ── Cleanup polling on unmount ──
  useEffect(() => {
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, []);

  // ── Cart helpers ──
  const cartCount = Object.values(cart).reduce((a, b) => a + b, 0);
  const cartItems = Object.entries(cart)
    .filter(([, qty]) => qty > 0)
    .map(([id, qty]) => ({
      menuItem: menuItems.find((m) => m.id === id)!,
      quantity: qty,
    }))
    .filter((ci) => ci.menuItem);

  const totalPrice =
    totalPriceOverride !== null
      ? totalPriceOverride
      : cartItems.reduce((sum, { menuItem, quantity }) => sum + menuItem.price * quantity, 0);

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

  // ── Place order ──
  async function placeOrder() {
    setFormError("");
    if (!name.trim()) { setFormError("Please enter your name."); return; }
    if (!phone.trim()) { setFormError("Please enter your phone number."); return; }
    if (!building) { setFormError("Please select a building."); return; }
    if (cartItems.length === 0) { setFormError("Your cart is empty."); return; }

    setSubmitting(true);
    setOrderError("");

    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          phone: phone.trim(),
          memo: [building, floor.trim()].filter(Boolean).join(" – ") || null,
          items: cartItems.map(({ menuItem, quantity }) => ({
            menuItemId: menuItem.id,
            quantity,
            unitPrice: menuItem.price,
          })),
          totalPrice,
          ipaymuEnabled: ipaymuEnabled && paymentMethod === "qris",
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setOrderError(data.error ?? "Failed to place order. Please try again.");
        setSubmitting(false);
        return;
      }

      setReferenceCode(data.referenceCode);
      setQrString(data.qrString ?? null);
      setTotalPriceOverride(totalPrice);
      setStep("payment");

      // Persist so a page refresh restores the payment screen
      try {
        sessionStorage.setItem("guudo_payment", JSON.stringify({
          step: "payment",
          referenceCode: data.referenceCode,
          qrString: data.qrString ?? null,
          totalPrice,
          paymentMethod,
          name: name.trim(),
          phone: phone.trim(),
        }));
      } catch {}

      if (ipaymuEnabled && paymentMethod === "qris" && data.qrString) {
        startQrisPolling(data.referenceCode);
      }
    } catch {
      setOrderError("Something went wrong. Check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  }

  // ── QRIS polling ──
  function startQrisPolling(refCode: string) {
    qrisStartRef.current = Date.now();
    setQrisStatus("waiting");

    pollingRef.current = setInterval(async () => {
      // Timeout after 15 minutes
      if (Date.now() - qrisStartRef.current > 15 * 60 * 1000) {
        clearInterval(pollingRef.current!);
        setQrisStatus("timeout");
        return;
      }

      try {
        const res = await fetch(`/api/orders/status?referenceCode=${encodeURIComponent(refCode)}`);
        const data = await res.json();
        if (data.paymentStatus === "paid") {
          clearInterval(pollingRef.current!);
          setQrisStatus("paid");
          setStep("confirmed");
        }
      } catch {
        // ignore transient errors, keep polling
      }
    }, 5000);
  }

  // ── Receipt upload ──
  async function uploadReceipt() {
    if (!receiptFile) return;
    setUploadState("uploading");
    setUploadError("");

    try {
      // 1. Get signed URL
      const signRes = await fetch("/api/upload-receipt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileName: receiptFile.name }),
      });
      if (!signRes.ok) throw new Error("Failed to get upload URL");
      const { signedUrl, publicUrl } = await signRes.json();

      // 2. Upload file
      const uploadRes = await fetch(signedUrl, {
        method: "PUT",
        body: receiptFile,
        headers: { "Content-Type": receiptFile.type || "application/octet-stream" },
      });
      if (!uploadRes.ok) throw new Error("Failed to upload file");

      // 3. Save receipt URL to order
      const patchRes = await fetch("/api/orders/receipt", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ referenceCode, receiptUrl: publicUrl }),
      });
      if (!patchRes.ok) {
        const d = await patchRes.json();
        throw new Error(d.error ?? "Failed to save payment proof");
      }

      setUploadState("done");
      try {
        const saved = sessionStorage.getItem("guudo_payment");
        if (saved) {
          const p = JSON.parse(saved);
          sessionStorage.setItem("guudo_payment", JSON.stringify({ ...p, step: "confirmed" }));
        }
      } catch {}
      setTimeout(() => setStep("confirmed"), 1000);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Upload failed. Please try again.");
      setUploadState("error");
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Render helpers
  // ─────────────────────────────────────────────────────────────────────────

  const mainItems = menuItems.filter((i) => i.category === "main");
  const addonItems = menuItems.filter((i) => i.category === "addon");



  // ─────────────────────────────────────────────────────────────────────────
  // JSX
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen" style={{ background: "#faf8f3" }}>
      {/* ── Navbar ── */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white border-b border-stone-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex items-center justify-between h-14">
          <Link href="/" className="font-bold text-lg tracking-widest text-stone-900 uppercase">
            Guudo
          </Link>
          <div className="flex items-center gap-4">
            {step === "browsing" && cartCount > 0 && (
              <button
                onClick={() => setCartOpen(true)}
                className="lg:hidden flex items-center gap-2 bg-amber-500 text-white text-sm font-semibold px-3 py-1.5 rounded-full"
              >
                🛒 {cartCount}
              </button>
            )}
            {step !== "browsing" && (
              <button
                onClick={() => {
                  if (pollingRef.current) clearInterval(pollingRef.current);
                  try { sessionStorage.removeItem("guudo_payment"); } catch {}
                  setStep("browsing");
                  setTotalPriceOverride(null);
                  setOrderError("");
                  setUploadState("idle");
                  setUploadError("");
                  setReceiptFile(null);
                }}
                className="text-stone-500 hover:text-stone-900 text-sm transition-colors flex items-center gap-1"
              >
                ← Back
              </button>
            )}
          </div>
        </div>
      </nav>

      {/* ── Page breadcrumb ── */}
      {step !== "browsing" && (
        <div className="pt-14 bg-white border-b border-stone-100">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 py-3 flex items-center gap-2 text-sm text-stone-400">
            <span className={step === "checkout" ? "text-amber-600 font-semibold" : ""}>Checkout</span>
            <span>›</span>
            <span className={step === "payment" ? "text-amber-600 font-semibold" : ""}>Payment</span>
            <span>›</span>
            <span className={step === "confirmed" ? "text-amber-600 font-semibold" : ""}>Done</span>
          </div>
        </div>
      )}

      <main className="pt-14">
        {/* ══ STEP: BROWSING ══════════════════════════════════════════════════ */}
        {step === "browsing" && (
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
            <div className="flex gap-8 items-start">
              {/* Menu */}
              <div className="flex-1 min-w-0">
                {loading ? (
                  <div className="text-center py-20 text-stone-400">Loading menu...</div>
                ) : (
                  <>
                    {mainItems.length > 0 && (
                      <section className="mb-10">
                        <h2 className="text-xs font-bold text-amber-600 tracking-[0.25em] uppercase mb-4">
                          Main Dish
                        </h2>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          {mainItems.map((item) => (
                            <div
                              key={item.id}
                              className="bg-white rounded-2xl overflow-hidden border border-stone-100 shadow-sm flex"
                            >
                              <div className="relative w-28 flex-shrink-0 bg-gradient-to-br from-amber-900 to-stone-800 flex items-center justify-center">
                                {item.imageUrl ? (
                                  <Image
                                    src={item.imageUrl}
                                    alt={item.name}
                                    fill
                                    className="object-cover"
                                    sizes="112px"
                                  />
                                ) : (
                                  <span className="text-3xl select-none">🍢</span>
                                )}
                              </div>
                              <div className="p-4 flex flex-col flex-1 min-w-0">
                                <div className="flex items-start justify-between gap-2 mb-1">
                                  <h3 className="font-semibold text-stone-900 text-sm leading-snug">
                                    {item.name}
                                  </h3>
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
                          ))}
                        </div>
                      </section>
                    )}

                    {addonItems.length > 0 && (
                      <section>
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
                                  <Image src={item.imageUrl} alt={item.name} fill className="object-cover" sizes="48px" />
                                ) : (
                                  <span className="text-xl select-none">🍢</span>
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between gap-1 mb-0.5">
                                  <p className="font-medium text-stone-900 text-sm truncate">{item.name}</p>
                                  <StockBadge stock={item.stockAvailable} />
                                </div>
                                <p className="text-amber-600 text-sm font-bold">
                                  {formatPrice(item.price)}
                                  <span className="text-stone-400 font-normal text-xs">/{item.unit}</span>
                                </p>
                              </div>
                              <QtyControl
                                qty={cart[item.id] ?? 0}
                                onAdd={() => addToCart(item.id)}
                                onRemove={() => removeFromCart(item.id)}
                                disabled={item.stockAvailable <= 0 || (cart[item.id] ?? 0) >= item.stockAvailable}
                              />
                            </div>
                          ))}
                        </div>
                      </section>
                    )}
                  </>
                )}
              </div>

              {/* Desktop Cart Sidebar */}
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

        {/* Mobile floating cart button */}
        {step === "browsing" && cartCount > 0 && (
          <div className="fixed bottom-4 left-4 right-4 lg:hidden z-40">
            <button
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

        {/* Mobile Cart Drawer */}
        {cartOpen && (
          <div className="fixed inset-0 z-50 lg:hidden">
            <div
              className="absolute inset-0 bg-black/50"
              onClick={() => setCartOpen(false)}
            />
            <div className="absolute bottom-0 left-0 right-0 bg-white rounded-t-2xl p-5 max-h-[85vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-stone-900 text-lg">Cart</h3>
                <button onClick={() => setCartOpen(false)} className="text-stone-400 hover:text-stone-700">
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

        {/* ══ STEP: CHECKOUT ══════════════════════════════════════════════════ */}
        {step === "checkout" && (
          <div className="max-w-2xl mx-auto px-4 sm:px-6 py-10">
            <h1 className="text-2xl font-bold text-stone-900 mb-8">Order Details</h1>

            {/* Order summary */}
            <div className="bg-white rounded-2xl border border-stone-100 p-5 mb-6">
              <h2 className="font-semibold text-stone-700 text-sm mb-3">Order Summary</h2>
              <div className="space-y-2 mb-4">
                {cartItems.map(({ menuItem, quantity }) => (
                  <div key={menuItem.id} className="flex justify-between text-sm">
                    <span className="text-stone-600">
                      {menuItem.name}{" "}
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

            {/* Contact form */}
            <div className="bg-white rounded-2xl border border-stone-100 p-5 mb-6">
              <h2 className="font-semibold text-stone-700 text-sm mb-4">Your Details</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-stone-700 mb-1.5">
                    Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Your name"
                    className="w-full border border-stone-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent transition"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-stone-700 mb-1.5">
                    Phone Number (WhatsApp) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="08xxxxxxxxxx"
                    className="w-full border border-stone-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent transition"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-stone-700 mb-1.5">
                    Building <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={building}
                    onChange={(e) => { setBuilding(e.target.value); setFloor(""); }}
                    className="w-full border border-stone-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent transition bg-white"
                  >
                    <option value="">Select building…</option>
                    <option value="RDTX Square">RDTX Square</option>
                    <option value="Kuttab Ummul Quro Pusat">Kuttab Ummul Quro Pusat</option>
                    <option value="Petrolab Services-Utan Kayu">Petrolab Services-Utan Kayu</option>
                  </select>
                </div>
                {building === "RDTX Square" ? (
                  <div>
                    <label className="block text-sm font-medium text-stone-700 mb-1.5">
                      Floor
                    </label>
                    <select
                      value={floor}
                      onChange={(e) => setFloor(e.target.value)}
                      className="w-full border border-stone-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent transition bg-white"
                    >
                      <option value="">Select floor…</option>
                      <option value="3F">3F</option>
                      <option value="18F">18F</option>
                    </select>
                  </div>
                ) : (
                  <div>
                    <label className="block text-sm font-medium text-stone-700 mb-1.5">
                      Floor / Room Number / Other Notes
                    </label>
                    <input
                      type="text"
                      value={floor}
                      onChange={(e) => setFloor(e.target.value)}
                      placeholder="e.g. Floor 2, lobby, etc."
                      className="w-full border border-stone-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent transition"
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Payment method */}
            <div className="bg-white rounded-2xl border border-stone-100 p-5 mb-6">
              <h2 className="font-semibold text-stone-700 text-sm mb-4">Payment Method</h2>
              <div className="space-y-3">
                {ipaymuEnabled && (
                  <label className={`flex items-start gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all ${paymentMethod === "qris" ? "border-amber-400 bg-amber-50" : "border-stone-200 hover:border-stone-300"}`}>
                    <input
                      type="radio"
                      name="paymentMethod"
                      value="qris"
                      checked={paymentMethod === "qris"}
                      onChange={() => setPaymentMethod("qris")}
                      className="mt-0.5 accent-amber-500"
                    />
                    <div>
                      <p className="font-semibold text-stone-900 text-sm">QRIS</p>
                      <p className="text-stone-500 text-xs mt-0.5">
                        Pay via GoPay, OVO, Dana, ShopeePay, etc.
                      </p>
                    </div>
                  </label>
                )}
                <label className={`flex items-start gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all ${paymentMethod === "transfer" ? "border-amber-400 bg-amber-50" : "border-stone-200 hover:border-stone-300"}`}>
                  <input
                    type="radio"
                    name="paymentMethod"
                    value="transfer"
                    checked={paymentMethod === "transfer"}
                    onChange={() => setPaymentMethod("transfer")}
                    className="mt-0.5 accent-amber-500"
                  />
                  <div>
                    <p className="font-semibold text-stone-900 text-sm">QRIS</p>
                    <p className="text-stone-500 text-xs mt-0.5">
                      Scan QRIS kami, lalu upload bukti bayar.
                    </p>
                  </div>
                </label>
              </div>
            </div>

            {(formError || orderError) && (
              <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm mb-4">
                {formError || orderError}
              </div>
            )}

            <button
              onClick={placeOrder}
              disabled={submitting || cartItems.length === 0}
              className="w-full bg-amber-500 hover:bg-amber-400 disabled:bg-stone-200 disabled:text-stone-400 text-white font-bold py-4 rounded-2xl text-base transition-colors"
            >
              {submitting ? "Processing..." : `Place Order · ${formatPrice(totalPrice)}`}
            </button>
          </div>
        )}

        {/* ══ STEP: PAYMENT — QRIS ════════════════════════════════════════════ */}
        {step === "payment" && paymentMethod === "qris" && (
          <div className="max-w-md mx-auto px-4 sm:px-6 py-10 text-center">
            <h1 className="text-2xl font-bold text-stone-900 mb-2">Scan QR to Pay</h1>
            <p className="text-stone-500 text-sm mb-1">
              Reference Code: <span className="font-bold text-stone-900">{referenceCode}</span>
            </p>
            <p className="text-amber-600 font-bold text-xl mb-6">{formatPrice(totalPrice)}</p>

            {qrString ? (
              <div className="inline-block bg-white p-4 rounded-2xl border-2 border-stone-100 shadow-sm mb-6">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`/api/orders/qrcode?data=${encodeURIComponent(qrString)}`}
                  alt="QRIS Payment QR Code"
                  width={240}
                  height={240}
                  className="block"
                />
              </div>
            ) : (
              <div className="bg-amber-50 text-amber-700 rounded-xl px-4 py-3 text-sm mb-6">
                QR Code not available. Please use bank transfer.
              </div>
            )}

            {qrisStatus === "waiting" && (
              <div className="flex items-center justify-center gap-2 text-stone-500 text-sm mb-4">
                <span className="inline-block w-3 h-3 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
                Waiting for payment…
              </div>
            )}

            {qrisStatus === "timeout" && (
              <div className="bg-orange-50 border border-orange-200 text-orange-700 rounded-xl px-4 py-3 text-sm mb-4">
                Timed out. Contact us if you’ve already paid.
              </div>
            )}

            <p className="text-stone-400 text-xs mb-6">
              Scan with GoPay, OVO, Dana, ShopeePay, or any mobile banking app.
              Enter the amount manually.
            </p>

            <button
              onClick={() => {
                if (pollingRef.current) clearInterval(pollingRef.current);
                setPaymentMethod("transfer");
              }}
              className="text-stone-500 hover:text-stone-800 text-sm underline transition-colors"
            >
              Switch to Static QRIS
            </button>
          </div>
        )}

        {/* ══ STEP: PAYMENT — STATIC QRIS ═══════════════════════════════════ */}
        {step === "payment" && paymentMethod === "transfer" && (
          <div className="max-w-md mx-auto px-4 sm:px-6 py-10 text-center">
            <h1 className="text-2xl font-bold text-stone-900 mb-2">Pay with QRIS</h1>
            <p className="text-stone-500 text-sm mb-1">
              Reference Code: <span className="font-bold text-stone-900">{referenceCode}</span>
            </p>
            <p className="text-amber-600 font-bold text-xl mb-6">{formatPrice(totalPrice)}</p>

            {/* Static QRIS image */}
            <div className="inline-block bg-white p-3 rounded-2xl border-2 border-stone-100 shadow-sm mb-3">
              <Image
                src="/qris.png"
                alt="QRIS Guudo"
                width={260}
                height={340}
                className="block rounded-lg"
                priority
              />
            </div>
            <p className="text-stone-500 text-sm mb-6">
              Scan with GoPay, OVO, Dana, ShopeePay, or any mobile banking app.<br />
              Enter the amount <span className="font-bold text-stone-900">{formatPrice(totalPrice)}</span> manually.
            </p>

            {/* Receipt upload */}
            <div className="bg-white rounded-2xl border border-stone-100 p-5 mb-6 text-left">
              <p className="text-xs text-stone-400 uppercase tracking-wide font-semibold mb-3">
                Upload Payment Proof
              </p>

              <label className="block cursor-pointer">
                <div className={`border-2 border-dashed rounded-xl p-6 text-center transition-colors ${receiptFile ? "border-amber-400 bg-amber-50" : "border-stone-200 hover:border-stone-300"}`}>
                  {receiptFile ? (
                    <>
                      <p className="text-amber-700 font-medium text-sm">{receiptFile.name}</p>
                      <p className="text-amber-600 text-xs mt-1">
                        {(receiptFile.size / 1024).toFixed(0)} KB
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="text-stone-500 text-sm">Tap to choose a photo</p>
                      <p className="text-stone-400 text-xs mt-1">JPG, PNG, or PDF</p>
                    </>
                  )}
                </div>
                <input
                  type="file"
                  accept="image/*,.pdf"
                  className="sr-only"
                  onChange={(e) => {
                    const file = e.target.files?.[0] ?? null;
                    setReceiptFile(file);
                    setUploadState("idle");
                    setUploadError("");
                  }}
                />
              </label>
            </div>

            {uploadError && (
              <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm mb-4">
                {uploadError}
              </div>
            )}

            {uploadState === "done" && (
              <div className="bg-green-50 border border-green-200 text-green-700 rounded-xl px-4 py-3 text-sm mb-4">
                Payment proof sent! ✓
              </div>
            )}

            <button
              onClick={uploadReceipt}
              disabled={!receiptFile || uploadState === "uploading" || uploadState === "done"}
              className="w-full bg-amber-500 hover:bg-amber-400 disabled:bg-stone-200 disabled:text-stone-400 text-white font-bold py-4 rounded-2xl text-base transition-colors mb-3"
            >
              {uploadState === "uploading"
                ? "Uploading..."
                : uploadState === "done"
                ? "Sent ✓"
                : "Send Payment Proof"}
            </button>

            <button
              onClick={() => setStep("confirmed")}
              className="w-full text-stone-500 hover:text-stone-800 text-sm py-2 transition-colors"
            >
              Upload later →
            </button>
          </div>
        )}

        {/* ══ STEP: CONFIRMED ═════════════════════════════════════════════════ */}
        {step === "confirmed" && (
          <div className="max-w-md mx-auto px-4 sm:px-6 py-16 text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>

            <h1 className="text-2xl font-bold text-stone-900 mb-2">Order Received!</h1>
            <p className="text-stone-500 text-base mb-6">
              {paymentMethod === "qris"
                ? "Your payment has been confirmed."
                : "Your order is in. We\u2019ll confirm after reviewing your transfer proof."}
            </p>

            <div className="bg-amber-50 border-2 border-amber-200 rounded-2xl p-6 mb-8">
              <p className="text-amber-700 text-xs font-semibold uppercase tracking-widest mb-2">
                Reference Code
              </p>
              <p className="text-stone-900 text-3xl font-bold tracking-widest">{referenceCode}</p>
              <p className="text-stone-500 text-sm mt-2">
                Show this code when picking up your order.
              </p>
            </div>

            <p className="text-stone-400 text-sm mb-8">
              A notification will be sent to WhatsApp{" "}
              <span className="font-medium text-stone-600">{phone}</span>.
            </p>

            <Link
              href="/"
              onClick={() => { try { sessionStorage.removeItem("guudo_payment"); } catch {} }}
              className="inline-flex items-center gap-2 bg-stone-900 hover:bg-stone-800 text-white font-semibold px-8 py-4 rounded-full transition-all"
            >
              Back to Home
            </Link>
          </div>
        )}
      </main>
    </div>
  );
}

// ─── Cart Panel component ─────────────────────────────────────────────────────

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
                    {menuItem.unit !== "porsi" ? ` ${menuItem.unit}` : ""}
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
            onClick={onProceed}
            className="w-full bg-amber-500 hover:bg-amber-400 text-white font-bold py-3 rounded-xl text-sm transition-colors"
          >
            Proceed to Checkout →
          </button>
        </>
      )}
    </div>
  );
}
