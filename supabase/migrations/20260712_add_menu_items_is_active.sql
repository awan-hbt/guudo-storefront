-- Soft-hide menu items that still appear on past orders
alter table menu_items
  add column if not exists is_active boolean not null default true;

alter table menu_items drop constraint if exists menu_items_category_check;

alter table menu_items add constraint menu_items_category_check
  check (category in ('main', 'addon', 'frozen', 'drinks', 'hidden'));

update menu_items
set is_active = false, category = 'hidden', stock_available = 0
where id = 'premium-ice-chocolate-';
