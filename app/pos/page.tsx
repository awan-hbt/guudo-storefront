"use client";

import { useState, useEffect, useRef } from "react";
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

type PaymentMethod = "cash" | "qris" | "transfer";
type AppStep = "pin" | "pos" | "confirmed";

interface ConfirmedOrder {
  referenceCode: string;
  total: number;
  changeDue: number | null;
  paymentMethod: PaymentMethod;
  items: Array<{ name: string; qty: number; unitPrice: number }>;
  notes: string | null;
  timestamp: Date;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmt(n: number) {
  return `Rp ${n.toLocaleString("id-ID")}`;
}

// ─── PIN Gate ────────────────────────────────────────────────────────────────

function PinGate({ pin, onUnlock }: { pin: string; onUnlock: () => void }) {
  const [input, setInput] = useState("");
  const [error, setError] = useState(false);

  function handleSubmit() {
    if (input === pin) {
      try {
        sessionStorage.setItem("guudo_pos_unlocked", "1");
      } catch {}
      onUnlock();
    } else {
      setError(true);
      setInput("");
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-stone-950">
      <div className="bg-stone-900 rounded-2xl p-8 w-80 text-center shadow-2xl">
        <div className="w-14 h-14 bg-amber-500/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <svg
            className="w-7 h-7 text-amber-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
            />
          </svg>
        </div>
        <h1 className="text-2xl font-bold text-white mb-1">Guudo POS</h1>
        <p className="text-stone-400 text-sm mb-6">Enter PIN to access</p>
        <input
          type="password"
          inputMode="numeric"
          maxLength={8}
          value={input}
          onChange={(e) => {
            setInput(e.target.value);
            setError(false);
          }}
          onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
          className={`w-full text-center text-2xl tracking-[0.5em] font-mono bg-stone-800 border rounded-xl px-4 py-3 text-white focus:outline-none transition-colors ${
            error
              ? "border-red-500"
              : "border-stone-700 focus:border-amber-500"
          }`}
          placeholder="••••"
          autoFocus
        />
        {error && (
          <p className="text-red-400 text-sm mt-2">Incorrect PIN. Try again.</p>
        )}
        <button
          onClick={handleSubmit}
          className="mt-4 w-full bg-amber-500 text-white font-semibold py-3 rounded-xl hover:bg-amber-400 active:bg-amber-600 transition-colors"
        >
          Unlock
        </button>
      </div>
    </div>
  );
}

// ─── Receipt ─────────────────────────────────────────────────────────────────

function ReceiptView({
  order,
  onNewOrder,
}: {
  order: ConfirmedOrder;
  onNewOrder: () => void;
}) {
  const timeStr = order.timestamp.toLocaleTimeString("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
  });
  const dateStr = order.timestamp.toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

  return (
    <>
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          #pos-receipt, #pos-receipt * { visibility: visible !important; }
          #pos-receipt {
            position: fixed !important;
            inset: 0 !important;
            background: white !important;
            display: flex !important;
            align-items: flex-start !important;
            justify-content: center !important;
            padding: 24px !important;
          }
        }
      `}</style>
      <div className="min-h-screen bg-stone-950 flex items-center justify-center p-4">
        <div
          id="pos-receipt"
          className="bg-white rounded-2xl shadow-2xl w-full max-w-sm text-stone-900 overflow-hidden"
        >
          {/* Receipt header */}
          <div className="bg-amber-500 px-6 py-5 text-center">
            <p className="text-white font-bold text-xl tracking-wide">
              Guudo Foods
            </p>
            <p className="text-amber-100 text-xs mt-0.5">
              Japanese Street Food
            </p>
          </div>

          <div className="px-6 py-5">
            {/* Order meta */}
            <div className="flex items-center justify-between text-xs text-stone-500 mb-4">
              <span>
                {dateStr} · {timeStr}
              </span>
              <span className="font-mono font-semibold text-stone-700">
                {order.referenceCode}
              </span>
            </div>

            {/* Items */}
            <div className="space-y-2.5 mb-4">
              {order.items.map((item, i) => (
                <div
                  key={i}
                  className="flex items-start justify-between gap-2"
                >
                  <div>
                    <p className="text-sm font-medium text-stone-900">
                      {item.name}
                    </p>
                    <p className="text-xs text-stone-400">
                      {item.qty} × {fmt(item.unitPrice)}
                    </p>
                  </div>
                  <p className="text-sm font-semibold text-stone-900 shrink-0">
                    {fmt(item.unitPrice * item.qty)}
                  </p>
                </div>
              ))}
            </div>

            {/* Divider */}
            <div className="border-t border-dashed border-stone-300 my-3" />

            {/* Totals */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-stone-700">Total</span>
                <span className="font-bold text-lg text-stone-900">
                  {fmt(order.total)}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-stone-500">Payment</span>
                <span className="font-medium text-stone-700 capitalize">
                  {order.paymentMethod === "qris"
                    ? "QRIS"
                    : order.paymentMethod === "transfer"
                    ? "Transfer"
                    : "Cash"}
                </span>
              </div>
              {order.paymentMethod === "cash" &&
                order.changeDue !== null && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-stone-500">Change</span>
                    <span className="font-semibold text-green-700">
                      {fmt(order.changeDue)}
                    </span>
                  </div>
                )}
            </div>

            {order.notes && (
              <p className="mt-3 text-xs text-stone-400">
                Note: {order.notes}
              </p>
            )}

            {/* Footer */}
            <div className="mt-5 pt-4 border-t border-dashed border-stone-300 text-center">
              <p className="text-xs text-stone-400">
                Terima kasih sudah makan di Guudo!
              </p>
              <p className="text-xs text-stone-400 mt-0.5">
                Thank you for dining with us.
              </p>
            </div>
          </div>
        </div>

        {/* Action buttons (hidden on print) */}
        <div className="fixed bottom-6 left-0 right-0 flex justify-center gap-3 print:hidden">
          <button
            onClick={() => window.print()}
            className="bg-stone-800 text-white px-6 py-3 rounded-xl font-semibold hover:bg-stone-700 transition-colors flex items-center gap-2 shadow-lg"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"
              />
            </svg>
            Print Receipt
          </button>
          <button
            onClick={onNewOrder}
            className="bg-amber-500 text-white px-6 py-3 rounded-xl font-bold hover:bg-amber-400 transition-colors shadow-lg"
          >
            New Order
          </button>
        </div>
      </div>
    </>
  );
}

// ─── Main POS Page ────────────────────────────────────────────────────────────

export default function PosPage() {
  const [appStep, setAppStep] = useState<AppStep>("pin");
  const [posPin, setPosPin] = useState<string>("");
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Cart
  const [cart, setCart] = useState<Record<string, number>>({});

  // Checkout
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cash");
  const [cashTendered, setCashTendered] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [orderError, setOrderError] = useState("");

  // Confirmed order
  const [confirmedOrder, setConfirmedOrder] = useState<ConfirmedOrder | null>(
    null
  );

  // Category filter
  const [categoryFilter, setCategoryFilter] = useState<
    "all" | "main" | "addon"
  >("all");

  const supabaseRef = useRef(createClient());

  // ── Load menu + config ──
  useEffect(() => {
    Promise.all([
      fetch("/api/stock").then((r) => r.json()),
      fetch("/api/config").then((r) => r.json()),
    ])
      .then(([stockData, configData]) => {
        setMenuItems(stockData.items ?? []);
        const pin: string = configData.posPin ?? "";
        setPosPin(pin);
        const unlocked = (() => {
          try {
            return sessionStorage.getItem("guudo_pos_unlocked") === "1";
          } catch {
            return false;
          }
        })();
        setAppStep(!pin || unlocked ? "pos" : "pin");
      })
      .catch(() => setAppStep("pos"))
      .finally(() => setLoading(false));
  }, []);

  // ── Real-time stock updates ──
  useEffect(() => {
    const supabase = supabaseRef.current;
    const channel = supabase
      .channel("pos-stock")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "menu_items" },
        (payload) => {
          const updated = payload.new as {
            id: string;
            stock_available: number;
          };
          setMenuItems((prev) =>
            prev.map((item) =>
              item.id === updated.id && !item.stockGroupId
                ? { ...item, stockAvailable: updated.stock_available }
                : item
            )
          );
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "stock_groups" },
        (payload) => {
          const updated = payload.new as { id: string; available: number };
          setMenuItems((prev) =>
            prev.map((item) =>
              item.stockGroupId === updated.id
                ? { ...item, stockAvailable: updated.available }
                : item
            )
          );
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // ── Cart helpers ──

  const cartTotal = Object.entries(cart).reduce((sum, [id, qty]) => {
    const item = menuItems.find((m) => m.id === id);
    return sum + (item ? item.price * qty : 0);
  }, 0);

  const cartCount = Object.values(cart).reduce((a, b) => a + b, 0);

  function addToCart(id: string) {
    const item = menuItems.find((m) => m.id === id);
    if (!item || item.stockAvailable <= 0) return;
    const currentQty = cart[id] ?? 0;
    if (currentQty >= item.stockAvailable) return;
    setCart((prev) => ({ ...prev, [id]: currentQty + 1 }));
  }

  function removeFromCart(id: string) {
    setCart((prev) => {
      const qty = prev[id] ?? 0;
      if (qty <= 1) {
        const next = { ...prev };
        delete next[id];
        return next;
      }
      return { ...prev, [id]: qty - 1 };
    });
  }

  function clearCart() {
    setCart({});
    setCashTendered("");
    setNotes("");
    setOrderError("");
  }

  const tendered = cashTendered ? parseInt(cashTendered, 10) : 0;
  const changeDue =
    paymentMethod === "cash" && tendered > 0 ? tendered - cartTotal : null;

  // ── Place order ──

  async function placeOrder() {
    if (cartCount === 0) return;
    if (paymentMethod === "cash") {
      if (!tendered || tendered < cartTotal) {
        setOrderError("Jumlah bayar kurang dari total.");
        return;
      }
    }

    const orderItems = Object.entries(cart)
      .filter(([, qty]) => qty > 0)
      .map(([id, qty]) => ({
        menuItemId: id,
        quantity: qty,
        unitPrice: menuItems.find((m) => m.id === id)!.price,
      }));

    setSubmitting(true);
    setOrderError("");

    try {
      const res = await fetch("/api/pos/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: orderItems,
          totalPrice: cartTotal,
          paymentMethod,
          cashTendered: paymentMethod === "cash" ? tendered : undefined,
          notes: notes.trim() || undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setOrderError(data.error ?? "Failed to place order.");
        return;
      }

      const confirmedItems = orderItems.map((oi) => ({
        name: menuItems.find((m) => m.id === oi.menuItemId)!.name,
        qty: oi.quantity,
        unitPrice: oi.unitPrice,
      }));

      setConfirmedOrder({
        referenceCode: data.referenceCode,
        total: cartTotal,
        changeDue: data.changeDue ?? null,
        paymentMethod,
        items: confirmedItems,
        notes: notes.trim() || null,
        timestamp: new Date(),
      });
      setAppStep("confirmed");
      clearCart();
    } catch {
      setOrderError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  // ── Render ──

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-950">
        <p className="text-stone-400 animate-pulse text-sm">Loading POS…</p>
      </div>
    );
  }

  if (appStep === "pin") {
    return <PinGate pin={posPin} onUnlock={() => setAppStep("pos")} />;
  }

  if (appStep === "confirmed" && confirmedOrder) {
    return (
      <ReceiptView
        order={confirmedOrder}
        onNewOrder={() => {
          setConfirmedOrder(null);
          setAppStep("pos");
        }}
      />
    );
  }

  const visibleItems = menuItems.filter(
    (item) => categoryFilter === "all" || item.category === categoryFilter
  );

  return (
    <div className="h-screen bg-stone-950 text-white flex flex-col overflow-hidden">
      {/* ── Header ── */}
      <header className="bg-stone-900 border-b border-stone-800 px-4 py-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <span className="text-amber-400 font-bold text-lg">Guudo POS</span>
          <span className="hidden sm:block text-stone-500 text-xs">
            {new Date().toLocaleDateString("id-ID", {
              weekday: "long",
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </span>
        </div>
        {posPin && (
          <button
            onClick={() => {
              try {
                sessionStorage.removeItem("guudo_pos_unlocked");
              } catch {}
              setAppStep("pin");
            }}
            className="text-stone-400 hover:text-stone-200 text-xs flex items-center gap-1.5 transition-colors"
          >
            <svg
              className="w-3.5 h-3.5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
              />
            </svg>
            Lock
          </button>
        )}
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* ── Left: Menu ── */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Category tabs */}
          <div className="px-4 pt-3 pb-2 flex gap-2 shrink-0">
            {(["all", "main", "addon"] as const).map((cat) => (
              <button
                key={cat}
                onClick={() => setCategoryFilter(cat)}
                className={`px-4 py-1.5 rounded-full text-sm font-semibold transition-colors ${
                  categoryFilter === cat
                    ? "bg-amber-500 text-white"
                    : "bg-stone-800 text-stone-300 hover:bg-stone-700"
                }`}
              >
                {cat === "all" ? "All" : cat === "main" ? "Main" : "Add-on"}
              </button>
            ))}
          </div>

          {/* Item grid */}
          <div className="flex-1 overflow-y-auto px-4 pb-4">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
              {visibleItems.map((item) => {
                const qty = cart[item.id] ?? 0;
                const soldOut = item.stockAvailable <= 0;
                const atMax = qty >= item.stockAvailable;
                return (
                  <button
                    key={item.id}
                    onClick={() => addToCart(item.id)}
                    disabled={soldOut || atMax}
                    className={`relative bg-stone-800 rounded-xl p-3 text-left transition-all select-none ${
                      soldOut
                        ? "opacity-40 cursor-not-allowed"
                        : atMax
                        ? "opacity-60 cursor-not-allowed"
                        : "hover:bg-stone-700 active:scale-95 cursor-pointer"
                    } ${qty > 0 ? "ring-2 ring-amber-500" : ""}`}
                  >
                    {/* Qty badge */}
                    {qty > 0 && (
                      <span className="absolute top-2 left-2 z-10 min-w-[1.5rem] h-6 bg-amber-500 text-white rounded-full flex items-center justify-center text-xs font-bold px-1.5">
                        {qty}
                      </span>
                    )}
                    {/* Stock badge */}
                    {!soldOut && item.stockAvailable <= 5 && (
                      <span className="absolute top-2 right-2 z-10 text-xs bg-amber-700 text-white rounded-full px-1.5 py-0.5 font-semibold">
                        {item.stockAvailable}
                      </span>
                    )}
                    {soldOut && (
                      <span className="absolute top-2 right-2 z-10 text-xs bg-red-700 text-white rounded-full px-1.5 py-0.5 font-semibold">
                        Sold Out
                      </span>
                    )}
                    {/* Image */}
                    {item.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={item.imageUrl}
                        alt={item.name}
                        className="w-full aspect-square object-cover rounded-lg mb-2"
                      />
                    ) : (
                      <div className="w-full aspect-square bg-stone-700 rounded-lg mb-2 flex items-center justify-center text-2xl">
                        🍱
                      </div>
                    )}
                    <p className="text-sm font-semibold text-white truncate leading-tight">
                      {item.name}
                    </p>
                    <p className="text-amber-400 font-bold text-sm mt-0.5">
                      {fmt(item.price)}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* ── Right: Cart + Checkout ── */}
        <div className="w-72 xl:w-80 bg-stone-900 border-l border-stone-800 flex flex-col shrink-0">
          {/* Cart header */}
          <div className="px-4 py-3 border-b border-stone-800 flex items-center justify-between shrink-0">
            <span className="font-semibold text-white text-sm">
              Order{" "}
              {cartCount > 0 && (
                <span className="text-amber-400">({cartCount})</span>
              )}
            </span>
            {cartCount > 0 && (
              <button
                onClick={clearCart}
                className="text-stone-500 hover:text-red-400 text-xs transition-colors"
              >
                Clear all
              </button>
            )}
          </div>

          {/* Cart items */}
          <div className="flex-1 overflow-y-auto px-3 py-2">
            {cartCount === 0 ? (
              <p className="text-stone-600 text-sm text-center mt-10">
                Tap items to add
              </p>
            ) : (
              <div className="space-y-1.5">
                {Object.entries(cart).map(([id, qty]) => {
                  const item = menuItems.find((m) => m.id === id);
                  if (!item) return null;
                  return (
                    <div
                      key={id}
                      className="flex items-center gap-2 bg-stone-800 rounded-lg px-2.5 py-2"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-white truncate leading-tight">
                          {item.name}
                        </p>
                        <p className="text-xs text-stone-400">
                          {fmt(item.price)} × {qty}
                        </p>
                      </div>
                      <p className="text-xs font-semibold text-amber-400 shrink-0">
                        {fmt(item.price * qty)}
                      </p>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => removeFromCart(id)}
                          className="w-5 h-5 rounded-full bg-stone-700 text-white flex items-center justify-center text-xs hover:bg-red-900 transition-colors"
                        >
                          −
                        </button>
                        <button
                          onClick={() => addToCart(id)}
                          disabled={qty >= item.stockAvailable}
                          className="w-5 h-5 rounded-full bg-stone-700 text-white flex items-center justify-center text-xs hover:bg-stone-600 disabled:opacity-40 transition-colors"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Checkout */}
          <div className="px-4 py-4 border-t border-stone-800 space-y-3 shrink-0">
            {/* Total */}
            <div className="flex items-center justify-between">
              <span className="text-stone-400 text-sm font-medium">Total</span>
              <span className="text-white text-xl font-bold">
                {fmt(cartTotal)}
              </span>
            </div>

            {/* Payment method */}
            <div className="grid grid-cols-3 gap-1.5">
              {(["cash", "qris", "transfer"] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => {
                    setPaymentMethod(m);
                    setOrderError("");
                  }}
                  className={`py-2 rounded-lg text-xs font-semibold transition-colors ${
                    paymentMethod === m
                      ? "bg-amber-500 text-white"
                      : "bg-stone-800 text-stone-300 hover:bg-stone-700"
                  }`}
                >
                  {m === "cash" ? "Cash" : m === "qris" ? "QRIS" : "Transfer"}
                </button>
              ))}
            </div>

            {/* Cash tendered */}
            {paymentMethod === "cash" && (
              <div className="space-y-1">
                <label className="text-xs text-stone-400">Cash Tendered</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-500 text-xs pointer-events-none">
                    Rp
                  </span>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={cashTendered}
                    onChange={(e) => {
                      setCashTendered(e.target.value.replace(/\D/g, ""));
                      setOrderError("");
                    }}
                    placeholder="50000"
                    className="w-full bg-stone-800 border border-stone-700 rounded-lg pl-8 pr-3 py-2 text-white text-sm focus:outline-none focus:border-amber-500 transition-colors"
                  />
                </div>
                {changeDue !== null && changeDue >= 0 && (
                  <p className="text-green-400 text-sm font-semibold">
                    Change: {fmt(changeDue)}
                  </p>
                )}
                {changeDue !== null && changeDue < 0 && (
                  <p className="text-red-400 text-xs">
                    Short by {fmt(Math.abs(changeDue))}
                  </p>
                )}
              </div>
            )}

            {/* QRIS note */}
            {paymentMethod === "qris" && (
              <p className="text-stone-500 text-xs bg-stone-800 rounded-lg px-3 py-2 leading-relaxed">
                Ask customer to scan your QRIS. Place order once payment is
                confirmed.
              </p>
            )}

            {/* Transfer note */}
            {paymentMethod === "transfer" && (
              <p className="text-stone-500 text-xs bg-stone-800 rounded-lg px-3 py-2 leading-relaxed">
                Confirm bank transfer before placing order.
              </p>
            )}

            {/* Notes */}
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Order notes (optional)"
              className="w-full bg-stone-800 border border-stone-700 rounded-lg px-3 py-2 text-white text-xs focus:outline-none focus:border-amber-500 transition-colors placeholder:text-stone-600"
            />

            {orderError && (
              <p className="text-red-400 text-xs leading-tight">{orderError}</p>
            )}

            {/* Place order */}
            <button
              onClick={placeOrder}
              disabled={
                cartCount === 0 ||
                submitting ||
                (paymentMethod === "cash" &&
                  (!tendered || tendered < cartTotal))
              }
              className="w-full bg-amber-500 text-white font-bold py-3 rounded-xl hover:bg-amber-400 active:bg-amber-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-sm"
            >
              {submitting
                ? "Processing…"
                : cartCount === 0
                ? "Add items to order"
                : `Place Order · ${fmt(cartTotal)}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
