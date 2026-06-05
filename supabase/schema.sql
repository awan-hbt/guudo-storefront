-- ============================================================
-- Guudo Storefront — Database Addendum
-- Run these in your Supabase SQL Editor.
-- The base schema (tables, RPC, RLS) already exists from
-- the pre-order app. This file only adds what is new.
-- ============================================================

-- 1. Add image_url column to menu_items (for product photos)
alter table menu_items
  add column if not exists image_url text;

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

-- ============================================================
-- Optional: seed image_url values for existing menu items
-- Replace the URLs with actual paths from your Supabase Storage
-- ============================================================
-- update menu_items set image_url = 'https://<project>.supabase.co/storage/v1/object/public/menu-images/yakitori-chilli-oil.jpg'
--   where id = 'yakitori-chilli-oil';
-- update menu_items set image_url = 'https://<project>.supabase.co/storage/v1/object/public/menu-images/hamburg.jpg'
--   where id = 'hamburg';
