# iPaymu integration — settings and export

This document collects the iPaymu-related configuration used by the project and describes safe ways to export non-secret settings to the storefront checkout.

**Summary**
- **Purpose**: centralize iPaymu config discovery and provide guidance for exporting non-secret values to the storefront.

**Config keys & environment variables**
- `IPAYMU_PROXY_URL` — URL of the VPS proxy that creates iPaymu payments (server-only).
- `PROXY_SECRET` — secret header value used by the proxy (`x-proxy-secret`) (server-only, do NOT expose).
- `IPAYMU_VA` — iPaymu virtual account number (may be displayed to customers; treat as semi-public).
- `IPAYMU_API_KEY` — iPaymu API key (secret, server-only).
- `NEXT_PUBLIC_BASE_URL` — public base URL used for return/cancel (already public if prefixed `NEXT_PUBLIC_`).

**Database flag**
- `app_config` key `ipaymu_enabled` — toggles whether iPaymu QRIS is available. This value is read by the storefront via `GET /api/config`.

**Where the code reads these values**
- [app/api/orders/route.ts](app/api/orders/route.ts) — server logic creating orders and calling the proxy. Uses `IPAYMU_PROXY_URL` and `PROXY_SECRET` from env.
- [app/api/orders/payment-callback/route.ts](app/api/orders/payment-callback/route.ts) — webhook handling for iPaymu callbacks.
- [app/api/admin/config/route.ts](app/api/admin/config/route.ts) — admin route to update `ipaymu_enabled` flag.
- [app/api/config/route.ts](app/api/config/route.ts) — storefront GET endpoint that returns `{ ipaymuEnabled }`.
- [app/page.tsx](app/page.tsx) and [app/admin/page.tsx](app/admin/page.tsx) — frontend reads `GET /api/config` to show/hide iPaymu options.
- [CODEBASE.md](CODEBASE.md) — documents `IPAYMU_VA` and `IPAYMU_API_KEY` env hints.

**Notes on secrets vs public values**
- Never expose `PROXY_SECRET` or `IPAYMU_API_KEY` to client-side code or commit them to the repo.
- `IPAYMU_VA` (virtual account number) can be exposed to customers if required — consider using a `NEXT_PUBLIC_IPAYMU_VA` env var or storing a non-secret `ipaymu_va` app_config value.

**Recommended export approaches (choose one)**

1) Expose non-secret values via the existing `/api/config` endpoint

- Add non-secret keys to the response of `app/api/config/route.ts` (server route). Example response:

```
{ "ipaymuEnabled": true, "ipaymuVa": "1234567890" }
```

- This keeps secrets server-only and lets the storefront fetch all values it needs.

2) Use `NEXT_PUBLIC_` env var for public values

- Add `NEXT_PUBLIC_IPAYMU_VA` to environment configuration. Next will expose this variable to client bundles.
- Example `.env` entry (do not commit secrets):

```
NEXT_PUBLIC_IPAYMU_VA=1234567890
```

3) Store a non-secret `ipaymu_va` in `app_config`

- Admin UI can be extended to upsert an `ipaymu_va` key (similar to `ipaymu_enabled`). The `GET /api/config` route can include it in the response.

**Suggested next steps I can implement**
- Add `ipaymuVa` to `app/api/config/route.ts` response (non-secret only).
- Add `NEXT_PUBLIC_IPAYMU_VA` to `.env.example` and update `CODEBASE.md`.
- Extend admin UI to manage `ipaymu_va` in `app_config`.

If you want, I can implement any of the suggested changes — tell me which one to do next.
