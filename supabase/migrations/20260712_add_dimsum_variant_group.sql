-- Add variant_group for size-variant menu items (e.g. Dim Sum 4pc/6pc)
alter table menu_items
  add column if not exists variant_group text;

-- Dim Sum SKUs: 3 flavors × 2 sizes (independent stock per SKU)
insert into menu_items
  (id, name, description, price, category, unit, stock_group_id, stock_available, sort_order, variant_group)
values
  ('dimsum-wasabi-4pc',      'Dimsum Wasabi',     'Wasabi-flavored dim sum.',      22000, 'main', '4pc', null, 20, 10, 'dimsum-wasabi'),
  ('dimsum-wasabi-6pc',      'Dimsum Wasabi',     'Wasabi-flavored dim sum.',      27000, 'main', '6pc', null, 20, 11, 'dimsum-wasabi'),
  ('dimsum-mentai-4pc',      'Dimsum Mentai',     'Mentai-flavored dim sum.',      21000, 'main', '4pc', null, 20, 12, 'dimsum-mentai'),
  ('dimsum-mentai-6pc',      'Dimsum Mentai',     'Mentai-flavored dim sum.',      26000, 'main', '6pc', null, 20, 13, 'dimsum-mentai'),
  ('dimsum-chilli-oil-4pc',  'Dimsum Chilli Oil', 'Chilli oil dim sum.',           20000, 'main', '4pc', null, 20, 14, 'dimsum-chilli-oil'),
  ('dimsum-chilli-oil-6pc',  'Dimsum Chilli Oil', 'Chilli oil dim sum.',           25000, 'main', '6pc', null, 20, 15, 'dimsum-chilli-oil')
on conflict (id) do update set
  name           = excluded.name,
  description    = excluded.description,
  price          = excluded.price,
  category       = excluded.category,
  unit           = excluded.unit,
  sort_order     = excluded.sort_order,
  variant_group  = excluded.variant_group;
