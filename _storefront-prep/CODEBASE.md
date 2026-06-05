# Guudo P.O. — Codebase Reference

## Overview

**Guudo P.O.** is a food pre-order booking web app for a Japanese food stall (yakitori/rice bowls). Customers browse the menu, select quantities, place an order, and pay via QRIS (iPaymu) or manual bank transfer (receipt upload). An admin dashboard manages orders, stock levels, and payment confirmation.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16.2.6 (App Router) |
| Language | TypeScript 5 |
| UI | React 19, Tailwind CSS v4 |
| Database | Supabase (PostgreSQL + Realtime + Storage) |
| Auth (admin) | JWT via `jose`, stored as HttpOnly cookie (`admin_token`) |
| Payments | iPaymu (QRIS) — togglable via `app_config` table |
| WhatsApp | Watzap API (`lib/watzap.ts`) |
| Fonts | Geist Sans & Geist Mono (Google Fonts) |

---

## Environment Variables

All secrets live in `.env.local` (never committed).

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

ADMIN_PASSWORD=          # plain-text password for /admin login
JWT_SECRET=              # HS256 secret for admin JWT

PROXY_SECRET=            # shared secret between proxy.ts and payment-callback route
IPAYMU_VA=               # iPaymu virtual account number (shown in QR)
IPAYMU_API_KEY=          # iPaymu API key

WATZAP_API_KEY=          # Watzap API key
WATZAP_ACCESS_TOKEN=     # Watzap access token
WATZAP_ADMIN_PHONE=      # Admin WhatsApp number (receives receipt notifications)
```

---

## Project Structure

```
app/
  page.tsx                  # Customer order page (main UI) — no tagline
  layout.tsx                # Root layout, metadata, fonts
  globals.css               # Tailwind base styles
  proof/
    [referenceCode]/
      page.tsx              # Server component — passes referenceCode to ProofClient
      ProofClient.tsx       # Client component — displays order proof/details
  admin/
    page.tsx                # Admin dashboard (orders, stock, config)
    login/page.tsx          # Admin login form
  api/
    config/route.ts         # GET  — returns { ipaymuEnabled }
    stock/route.ts          # GET  — returns menu items with live stock
    orders/
      route.ts              # POST — place order (atomic stock deduction)
      receipt/route.ts      # PATCH — attach receipt URL to order
      status/route.ts       # GET  — poll payment_status for an order
      proof/route.ts        # GET  — fetch order details by reference code (public)
      payment-callback/     # POST — iPaymu webhook (guarded by PROXY_SECRET)
      qrcode/route.ts       # GET  — proxy to api.qrserver.com for QR image
    upload-receipt/route.ts # POST — generate Supabase signed upload URL
    admin/
      login/route.ts        # POST — verify password, issue JWT cookie
      logout/route.ts       # POST — clear JWT cookie
      orders/route.ts       # GET  — list all orders (admin-only)
      orders/confirm/       # POST — mark order payment_status='paid' + WhatsApp notification
      orders/complete/      # POST — bulk mark orders as completed (no notification)
      stock/route.ts        # PATCH — update stock levels
      config/route.ts       # GET/PATCH — manage app_config (ipaymuEnabled)
components/
  StockCounter.tsx          # Inline stock badge shown on menu items
lib/
  supabase-browser.ts       # createClient() — browser-side Supabase client
  supabase-server.ts        # createServiceClient() — server-side service role client
  watzap.ts                 # WhatsApp notification helpers
supabase/
  schema.sql                # Full DB schema (run once in Supabase SQL editor)
proxy.ts                    # Standalone proxy for iPaymu callbacks
public/                     # Static assets
```

---

## Database Schema

### Tables

**`stock_groups`** — Shared capacity pools (e.g. all Yakitori variants share one pool).
```sql
id text PK, name text, available int
```

**`menu_items`** — Menu catalogue.
```sql
id text PK, name text, description text, price int (IDR),
category ('main'|'addon'), unit text, stock_group_id text FK,
stock_available int (null when managed via group), sort_order int
```

**`orders`**
```sql
id uuid PK, reference_code text UNIQUE (e.g. "GD-4821"),
name text, phone text, total_price int,
payment_status text (null|'paid'), receipt_url text,
memo text (floor info), created_at timestamptz
```

**`order_items`**
```sql
id uuid PK, order_id uuid FK, menu_item_id text FK,
quantity int, unit_price int
```

**`settings`** — Dropped/unused (see `app_config` below).

**`app_config`** — Key/value config store.
```
key='ipaymu_enabled', value='true'|'false'
```

### RPC

**`place_order(p_items jsonb)`** — Atomic stock-check + deduction + order insert. Raises `INSUFFICIENT_STOCK` on shortage. Called from `POST /api/orders`.

### Storage

Bucket: `receipts` (public). Receipt images are uploaded client-side via a Supabase signed URL obtained from `POST /api/upload-receipt`.

### Realtime

`supabase_realtime` publication includes `menu_items` and `stock_groups`. The customer page subscribes via `@supabase/ssr` to update displayed stock counters live.

---

## Key Flows

### Customer Order Flow
1. Page loads: `GET /api/stock` (menu + stock) + `GET /api/config` (payment toggle).
2. Real-time Supabase subscription keeps stock counts live.
3. Customer fills name, phone, floor, selects items → `POST /api/orders`.
4. If iPaymu enabled: QR code displayed via `GET /api/orders/qrcode?data=...`. Page polls `GET /api/orders/status?referenceCode=...` every 5 s until `paymentStatus === 'paid'`.
5. If manual transfer: customer uploads receipt image → `POST /api/upload-receipt` (get signed URL) → PUT to Supabase Storage → `PATCH /api/orders/receipt` (save URL). WhatsApp notification sent to admin via Watzap.

### Payment Callback (iPaymu)
- iPaymu calls an external proxy (`proxy.ts`) which forwards to `POST /api/orders/payment-callback` with `x-proxy-secret` header.
- Route validates secret, checks `status === 'berhasil'` or `status_code === '1'`, then sets `payment_status = 'paid'`.

### Admin Flow
1. `POST /api/admin/login` with password → JWT cookie set (1 day, HttpOnly).
2. All `/api/admin/*` routes verify JWT from cookie.
3. Dashboard: view/confirm orders, edit stock quantities, toggle iPaymu, copy order report.
4. `POST /api/admin/orders/confirm` marks order as paid + sends WhatsApp confirmation to customer.
5. `POST /api/admin/logout` clears cookie.

---

## Menu Items (seed data)

| ID | Name | Price | Category | Stock |
|---|---|---|---|---|
| yakitori-chilli-oil | Yakitori Chilli Oil | Rp 22,000 | main | shared `yakitori` group (40) |
| yakitori-original | Yakitori Original | Rp 20,000 | main | shared `yakitori` group |
| gyudon | Gyudon | Rp 28,000 | main | standalone (20) |
| yakitori-kawa | Yakitori Kawa | Rp 3,500/pcs | addon | standalone (30) |
| yakitori-momo | Yakitori Momo | Rp 3,500/pcs | addon | standalone (30) |
| yakitori-tsukune | Yakitori Tsukune | Rp 3,500/pcs | addon | standalone (30) |
| yakitori-negi | Yakitori Negi | Rp 3,500/pcs | addon | standalone (30) |
| chilli-oil | Chilli Oil | Rp 2,000/pcs | addon | standalone (30) |

---

## Admin Auth Details

- Login: `POST /api/admin/login` with `{ password }`.
- JWT payload: `{ role: 'admin' }`, HS256, expires 1 day.
- Cookie name: `admin_token` (HttpOnly, SameSite=lax, Secure in production).
- Protected routes read and verify the cookie using `jose` `jwtVerify`.

---

## WhatsApp Notifications (`lib/watzap.ts`)

Two functions, both no-op if env vars are missing:

- **`notifyAdminReceiptUploaded`** — Sends admin a message with order details + receipt link when a customer uploads proof of payment.
- **`notifyCustomerConfirmed`** — Sends customer a confirmation message when admin confirms payment.

Phone numbers are normalized to Indonesian format (`62...`).

---

## Reference Code Format

Orders get a code like `GD-XXXX` (4-digit random, collision-checked up to 10 retries).

---

## Pages

| Route | Description |
|---|---|
| `/` | Customer order page |
| `/proof/[referenceCode]` | Public order proof/details page |
| `/admin` | Admin dashboard (redirects to login if unauthenticated) |
| `/admin/login` | Admin login |
| `/faq` | FAQ page |
| `/refund-policy` | Refund policy |
| `/terms` | Terms of service |

---

## Development

```bash
npm run dev    # Start dev server (localhost:3000)
npm run build  # Production build
npm run start  # Start production server
```

Supabase schema: run `supabase/schema.sql` once in the Supabase SQL Editor (it drops and recreates all tables).
