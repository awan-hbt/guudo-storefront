# Parallel cutover (Watzap + self-hosted)

Run both providers for ~1 week before removing Watzap.

## Vercel env (guudo-storefront + guudo-po)

```env
# Self-hosted (required for new path)
WHATSAPP_SERVICE_URL=https://YOUR_VPS/whatsapp

# Keep existing Watzap keys during parallel week
WATZAP_API_KEY=...
WATZAP_ACCESS_TOKEN=...
WATZAP_ADMIN_PHONE=...

# Enable dual-send
WHATSAPP_PARALLEL=true

PROXY_SECRET=...  # same secret on VPS queue service
```

## VPS env (`/opt/guudo-whatsapp/.env`)

```env
PROXY_SECRET=...           # match Vercel
EVOLUTION_INSTANCE_NAME=guudo
ADMIN_PHONE=628...         # admin receipt alerts
```

## After 1 week stable

1. Confirm delivery logs in `curl https://YOUR_VPS/whatsapp/health`
2. Remove from Vercel: `WATZAP_API_KEY`, `WATZAP_ACCESS_TOKEN`, `WATZAP_ADMIN_PHONE`, `WHATSAPP_PARALLEL`
3. Keep only `WHATSAPP_SERVICE_URL` + `PROXY_SECRET`
4. Optionally delete `lib/watzap.ts` after cutover

## Rollback

Unset `WHATSAPP_SERVICE_URL` and remove `WHATSAPP_PARALLEL`. Watzap alone resumes if keys remain.
