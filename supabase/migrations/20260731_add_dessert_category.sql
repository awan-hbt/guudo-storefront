-- Allow "dessert" as a menu item category
alter table menu_items drop constraint if exists menu_items_category_check;

alter table menu_items add constraint menu_items_category_check
  check (category in ('main', 'addon', 'frozen', 'drinks', 'hidden', 'dessert'));

insert into menu_items
  (id, name, description, price, category, unit, stock_group_id, stock_available, sort_order, image_url)
values
  ('matcha-tiramisu', 'Matcha Tiramisu', '144gr', 25000, 'dessert', 'porsi', null, 20, 1, null)
on conflict (id) do update set
  name            = excluded.name,
  description     = excluded.description,
  price           = excluded.price,
  category        = excluded.category,
  unit            = excluded.unit,
  sort_order      = excluded.sort_order;
