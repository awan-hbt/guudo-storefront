-- Idempotency log for WhatsApp notifications (prevents duplicate QRIS confirmations)
create table if not exists whatsapp_sent (
  id uuid primary key default gen_random_uuid(),
  reference_code text not null,
  event_type text not null,
  sent_at timestamptz not null default now(),
  unique (reference_code, event_type)
);

create index if not exists whatsapp_sent_reference_code_idx on whatsapp_sent (reference_code);
