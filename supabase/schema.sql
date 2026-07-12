-- ============================================================
-- Guudo Storefront — Database Addendum
-- Run these in your Supabase SQL Editor.
-- The base schema (tables, RPC, RLS) already exists from
-- the pre-order app. This file only adds what is new.
-- ============================================================

-- 1. Add image_url column to menu_items (for product photos)
alter table menu_items
  add column if not exists image_url text;

-- Soft-hide items that are retired but still referenced by past orders
alter table menu_items
  add column if not exists is_active boolean not null default true;

-- 2. Add payment_status column to orders (if not already present)
alter table orders
  add column if not exists payment_status text;

-- 3. Add ipaymu_trx_id column to orders (for QRIS transaction tracking)
alter table orders
  add column if not exists ipaymu_trx_id text;

-- 4. Create app_config table (if not already present)
create table if not exists app_config (
  key   text primary key,
  value text not null
);

-- 5. Seed default config
insert into app_config (key, value)
values ('ipaymu_enabled', 'false')
on conflict (key) do nothing;

-- 6. Create menu-images storage bucket for product photos (public)
insert into storage.buckets (id, name, public)
values ('menu-images', 'menu-images', true)
on conflict (id) do nothing;

-- 7. Allow service role to update orders (payment_status, receipt_url, etc.)
--    The existing RLS policies only allow insert; update is done via
--    service role key (bypasses RLS), so no additional policy needed.

-- 8. Add Hamburg menu item
insert into menu_items
  (id, name, description, price, category, unit, stock_group_id, stock_available, sort_order)
values
  ('hamburg', 'Hamburg', 'Japanese-style beef hamburg steak served with rice.', 32000, 'main', 'porsi', null, 20, 4)
on conflict (id) do nothing;

-- 9. Variant groups for size options (e.g. Dim Sum 4pc / 6pc)
alter table menu_items
  add column if not exists variant_group text;

-- 10. Dim Sum SKUs
insert into menu_items
  (id, name, description, price, category, unit, stock_group_id, stock_available, sort_order, variant_group)
values
  ('dimsum-wasabi-4pc',      'Dimsum Wasabi',     'Wasabi-flavored dim sum.', 22000, 'main', '4pc', null, 20, 10, 'dimsum-wasabi'),
  ('dimsum-wasabi-6pc',      'Dimsum Wasabi',     'Wasabi-flavored dim sum.', 27000, 'main', '6pc', null, 20, 11, 'dimsum-wasabi'),
  ('dimsum-mentai-4pc',      'Dimsum Mentai',     'Mentai-flavored dim sum.', 21000, 'main', '4pc', null, 20, 12, 'dimsum-mentai'),
  ('dimsum-mentai-6pc',      'Dimsum Mentai',     'Mentai-flavored dim sum.', 26000, 'main', '6pc', null, 20, 13, 'dimsum-mentai'),
  ('dimsum-chilli-oil-4pc',  'Dimsum Chilli Oil', 'Chilli oil dim sum.',      20000, 'main', '4pc', null, 20, 14, 'dimsum-chilli-oil'),
  ('dimsum-chilli-oil-6pc',  'Dimsum Chilli Oil', 'Chilli oil dim sum.',      25000, 'main', '6pc', null, 20, 15, 'dimsum-chilli-oil')
on conflict (id) do nothing;

-- 11. Tea latte drinks
insert into menu_items
  (id, name, description, price, category, unit, stock_group_id, stock_available, sort_order)
values
  ('matcha-latte',    'Matcha Latte',    'Iced matcha latte with milk.', 16000, 'drinks', 'Cup', null, 20, 1),
  ('genmaicha-latte', 'Genmaicha Latte', 'Iced roasted brown rice green tea latte.', 17000, 'drinks', 'Cup', null, 20, 2),
  ('hojicha-latte',   'Hojicha Latte',   'Iced roasted green tea latte.', 17000, 'drinks', 'Cup', null, 20, 3),
  ('creamy-matcha',   'Creamy Matcha',   'Matcha latte topped with whipped cream and matcha drizzle.', 20000, 'drinks', 'Cup', null, 20, 4)
on conflict (id) do update set
  name           = excluded.name,
  description    = excluded.description,
  price          = excluded.price,
  category       = excluded.category,
  unit           = excluded.unit,
  sort_order     = excluded.sort_order;

-- Replace the URLs with actual paths from your Supabase Storage
-- ============================================================
-- update menu_items set image_url = 'https://<project>.supabase.co/storage/v1/object/public/menu-images/yakitori-chilli-oil.jpg'
--   where id = 'yakitori-chilli-oil';
-- update menu_items set image_url = 'https://<project>.supabase.co/storage/v1/object/public/menu-images/hamburg.jpg'
--   where id = 'hamburg';
