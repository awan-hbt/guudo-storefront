# Guudo Storefront — Build Brief

## What This Is

A new Next.js storefront for **Guudo** (`guudo.id`) — a Japanese food stall selling yakitori and rice bowls in Indonesia. This is a separate project from the existing pre-order app (`open-po.guudo.id`), but shares the same Supabase database.

---

## Relationship to Existing App

| | Storefront (this project) | Pre-order app |
|---|---|---|
| Domain | `guudo.id` | `open-po.guudo.id` |
| Repo | New separate repo | `awan-hbt/guudo-po` |
| Deployment | New Vercel project | Existing Vercel project |
| Database | Same Supabase project | Same Supabase project |
| Admin | `open-po.guudo.id/admin` | `open-po.guudo.id/admin` |

- The pre-order app stays **untouched** — its URL, admin, and functionality remain the same.
- All orders from both apps appear in the **same admin dashboard** (same DB).

---

## Key Decisions Made

1. **Full checkout on the storefront** — customers never leave `guudo.id` to order. No redirect to `open-po.guudo.id`.
2. **Separate repo** — not a monorepo. Simpler, no restructuring of the existing app.
3. **Same Supabase** — storefront reads `menu_items` directly and writes orders via its own API routes (duplicated from the pre-order app).
4. **iPaymu QRIS + receipt upload** — both payment methods available on the storefront too.
5. **WhatsApp notifications** — same Watzap setup, same admin phone.
6. **Admin stays on `open-po.guudo.id/admin`** — extended later to handle storefront-specific things (product images, visibility toggles). Not built in this phase.

### Pending decision (before iPaymu goes live on storefront)
- The iPaymu payment callback requires a proxy (`proxy.ts`) to forward webhooks. Options:
  - Deploy a second proxy instance pointing to `guudo.id/api/orders/payment-callback`
  - Or reuse the existing proxy with routing logic
- **Not a blocker for building** — receipt upload (manual transfer) works without it.

---

## Storefront Pages & Structure

### `/` — Landing / Home
- Full-width hero with food photo, brand name **Guudo**, and CTA button to scroll to menu or go straight to order
- Menu section (card grid)
- About / story section
- How to Order (3-step visual)
- Footer

### `/order` or inline on `/` — Full Order Flow
- Menu cards with photos, names, prices
- Cart (persistent, sidebar or bottom drawer)
- Checkout form (name, phone, delivery info)
- Payment: QRIS (iPaymu) or manual bank transfer (receipt upload)
- Order confirmation with reference code

### `/faq`, `/refund-policy`, `/terms`
- Copy from existing app — same content, new styling

---

## Design Direction

- **Aesthetic:** Clean, minimal, slightly warm. Japanese-inspired but readable in Indonesian.
- **Colors:** Dark charcoal or off-white background, amber/orange accents (matches yakitori theme)
- **Layout:** Card/grid for menu items (not the current list/form layout)
- **Language:** Mix of Indonesian and English (same as existing app)

---

## Database Changes Needed

Add `image_url` column to `menu_items` for product photos:

```sql
alter table menu_items add column if not exists image_url text;
```

Images stored in Supabase Storage (new bucket e.g. `menu-images`, public).

---

## Environment Variables (same values as `open-po.guudo.id`)

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

PROXY_SECRET=            # same secret, new proxy instance for storefront
IPAYMU_VA=
IPAYMU_API_KEY=

WATZAP_API_KEY=
WATZAP_ACCESS_TOKEN=
WATZAP_ADMIN_PHONE=
```

No `ADMIN_PASSWORD` or `JWT_SECRET` — no admin auth in this project.

---

## API Routes to Build (duplicated + adapted from pre-order app)

| Route | Method | Purpose |
|---|---|---|
| `/api/stock` | GET | Fetch menu items with live stock |
| `/api/config` | GET | Returns `{ ipaymuEnabled }` |
| `/api/orders` | POST | Place order (atomic stock deduction via `place_order` RPC) |
| `/api/orders/receipt` | PATCH | Attach uploaded receipt URL to order |
| `/api/orders/status` | GET | Poll `payment_status` for an order |
| `/api/orders/payment-callback` | POST | iPaymu webhook (guarded by `PROXY_SECRET`) |
| `/api/orders/qrcode` | GET | Proxy to `api.qrserver.com` for QR image |
| `/api/upload-receipt` | POST | Generate Supabase signed upload URL |

Source files for all of these are in this folder under `app/api/`.

---

## Shared Library Files (copy as-is)

- `lib/supabase-browser.ts` — browser Supabase client
- `lib/supabase-server.ts` — server-side service role client
- `lib/watzap.ts` — WhatsApp notification helpers

---

## Tech Stack (same as pre-order app)

| Layer | Technology |
|---|---|
| Framework | Next.js (App Router) |
| Language | TypeScript 5 |
| UI | React 19, Tailwind CSS v4 |
| Database | Supabase (PostgreSQL + Realtime + Storage) |
| Payments | iPaymu (QRIS) |
| WhatsApp | Watzap API |

---

## What NOT to Build (in this phase)

- Admin dashboard — stays on `open-po.guudo.id/admin`
- Admin auth (JWT, login/logout routes)
- Proof of order page (exists on pre-order app, link from order confirmation is fine)
- `proxy.ts` — decide separately

---

## Reference

Full DB schema, RPC details, and pre-order app internals: see `CODEBASE.md` in this folder.
