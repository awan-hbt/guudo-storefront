-- Dine-in orders use order_source = 'dine_in' (no schema change required if migration_order_source.sql already applied).
-- payment_status 'unpaid' is free-form text on orders.

comment on column orders.order_source is
  'po = guudo-po booking, storefront = guudo.id online, dine_in = QR dine-in menu';
