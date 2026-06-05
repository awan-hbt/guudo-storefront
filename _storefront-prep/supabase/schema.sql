-- ============================================================
-- Run this entire file in your Supabase SQL Editor (one paste)
-- WARNING: Drops and recreates all app tables.
-- ============================================================

-- Drop in reverse dependency order
drop table if exists order_items cascade;
drop table if exists orders      cascade;
drop table if exists menu_items  cascade;
drop table if exists stock_groups cascade;
drop table if exists settings    cascade;

drop function if exists place_order(int);
drop function if exists place_order(jsonb);

-- ============================================================
-- 1. Stock groups  (shared capacity pools)
-- ============================================================
create table stock_groups (
  id        text primary key,
  name      text not null,
  available int  not null default 0
);

insert into stock_groups (id, name, available) values
  ('yakitori', 'Yakitori', 40);

-- ============================================================
-- 2. Menu items
-- ============================================================
create table menu_items (
  id              text primary key,
  name            text not null,
  description     text,
  price           int  not null,          -- IDR, whole number
  category        text not null check (category in ('main', 'addon')),
  unit            text not null default 'porsi',
  stock_group_id  text references stock_groups(id),
  stock_available int,                    -- null when managed via stock_group
  sort_order      int  not null default 0
);

insert into menu_items
  (id, name, description, price, category, unit, stock_group_id, stock_available, sort_order)
values
  ('yakitori-chilli-oil', 'Yakitori Chilli Oil', 'Grilled chicken skewers with spicy chilli oil served with rice.', 22000, 'main',  'porsi', 'yakitori', null, 1),
  ('yakitori-original',   'Yakitori Original',   'Classic grilled chicken skewers served with rice.',               20000, 'main',  'porsi', 'yakitori', null, 2),
  ('gyudon',              'Gyudon',              'Japanese beef bowl with rice.',                                   28000, 'main',  'porsi', null,        20,   3),
  ('yakitori-kawa',       'Yakitori Kawa',        'Chicken skin skewer.',                                           3500,  'addon', 'pcs',  null,        30,   4),
  ('yakitori-momo',       'Yakitori Momo',        'Chicken thigh skewer.',                                          3500,  'addon', 'pcs',  null,        30,   5),
  ('yakitori-tsukune',    'Yakitori Tsukune',     'Chicken meatball skewer.',                                       3500,  'addon', 'pcs',  null,        30,   6),
  ('yakitori-negi',       'Yakitori Negi',        'Chicken & spring onion skewer.',                                 3500,  'addon', 'pcs',  null,        30,   7),
  ('chilli-oil',          'Chilli Oil',           'Extra chilli oil.',                                              2000,  'addon', 'pcs',  null,        30,   8);

-- ============================================================
-- 3. Orders
-- ============================================================
create table orders (
  id             uuid        primary key default gen_random_uuid(),
  reference_code text        unique not null,
  name           text        not null,
  phone          text        not null,
  total_price    int         not null,
  receipt_url    text,
  memo           text,
  created_at     timestamptz not null default now()
);

-- ============================================================
-- 4. Order items
-- ============================================================
create table order_items (
  id           uuid primary key default gen_random_uuid(),
  order_id     uuid not null references orders(id) on delete cascade,
  menu_item_id text not null references menu_items(id),
  quantity     int  not null check (quantity >= 1),
  unit_price   int  not null
);

-- ============================================================
-- 5. Atomic place_order RPC
--    p_items: [{"menu_item_id": "gyudon", "quantity": 2}, ...]
--    All-or-nothing: raises INSUFFICIENT_STOCK if any item short
-- ============================================================
create or replace function place_order(p_items jsonb)
returns void
language plpgsql
security definer
as $$
declare
  v_group_id  text;
  v_group_qty int;
  v_item_id   text;
  v_item_qty  int;
  v_available int;
begin
  -- Phase 1a: lock + check group-tracked items
  for v_group_id, v_group_qty in
    select mi.stock_group_id,
           sum((elem->>'quantity')::int)
    from   jsonb_array_elements(p_items) elem
    join   menu_items mi on mi.id = (elem->>'menu_item_id')
    where  mi.stock_group_id is not null
    group  by mi.stock_group_id
  loop
    select available into v_available
    from   stock_groups
    where  id = v_group_id
    for update;

    if v_available < v_group_qty then
      raise exception 'INSUFFICIENT_STOCK';
    end if;
  end loop;

  -- Phase 1b: lock + check standalone items
  for v_item_id, v_item_qty in
    select mi.id,
           (elem->>'quantity')::int
    from   jsonb_array_elements(p_items) elem
    join   menu_items mi on mi.id = (elem->>'menu_item_id')
    where  mi.stock_group_id is null
  loop
    select stock_available into v_available
    from   menu_items
    where  id = v_item_id
    for update;

    if v_available is null or v_available < v_item_qty then
      raise exception 'INSUFFICIENT_STOCK';
    end if;
  end loop;

  -- Phase 2a: deduct group stock
  update stock_groups sg
  set    available = sg.available - agg.total_qty
  from (
    select mi.stock_group_id,
           sum((elem->>'quantity')::int) as total_qty
    from   jsonb_array_elements(p_items) elem
    join   menu_items mi on mi.id = (elem->>'menu_item_id')
    where  mi.stock_group_id is not null
    group  by mi.stock_group_id
  ) agg
  where sg.id = agg.stock_group_id;

  -- Phase 2b: deduct standalone item stock
  update menu_items mi
  set    stock_available = mi.stock_available - agg.qty
  from (
    select (elem->>'menu_item_id') as item_id,
           (elem->>'quantity')::int as qty
    from   jsonb_array_elements(p_items) elem
    join   menu_items m2 on m2.id = (elem->>'menu_item_id')
    where  m2.stock_group_id is null
  ) agg
  where mi.id = agg.item_id;
end;
$$;

-- ============================================================
-- 6. Row Level Security
-- ============================================================
alter table stock_groups enable row level security;
alter table menu_items   enable row level security;
alter table orders       enable row level security;
alter table order_items  enable row level security;

drop policy if exists "stock_groups_select_public" on stock_groups;
drop policy if exists "menu_items_select_public"   on menu_items;
drop policy if exists "orders_insert_public"       on orders;
drop policy if exists "order_items_insert_public"  on order_items;

create policy "stock_groups_select_public" on stock_groups for select using (true);
create policy "menu_items_select_public"   on menu_items   for select using (true);
create policy "orders_insert_public"       on orders       for insert with check (true);
create policy "order_items_insert_public"  on order_items  for insert with check (true);

-- ============================================================
-- 7. Realtime
-- ============================================================
do $$
begin
  begin
    alter publication supabase_realtime add table menu_items;
  exception when others then null;
  end;
  begin
    alter publication supabase_realtime add table stock_groups;
  exception when others then null;
  end;
end $$;

-- ============================================================
-- Storage
-- ============================================================
insert into storage.buckets (id, name, public)
values ('receipts', 'receipts', true)
on conflict (id) do nothing;

drop policy if exists "receipts_insert_signed" on storage.objects;
drop policy if exists "receipts_select_public" on storage.objects;

create policy "receipts_insert_signed"
  on storage.objects for insert
  to anon, authenticated
  with check (bucket_id = 'receipts');

create policy "receipts_select_public"
  on storage.objects for select
  using (bucket_id = 'receipts');
