-- Tea latte drink line from Guudo menu board
update menu_items
set
  name = 'Matcha Latte',
  description = 'Iced matcha latte with milk.',
  price = 16000,
  category = 'drinks',
  unit = 'Cup',
  sort_order = 1,
  stock_available = coalesce(nullif(stock_available, 0), 20)
where id = 'matcha-latte';

insert into menu_items
  (id, name, description, price, category, unit, stock_group_id, stock_available, sort_order, image_url)
values
  ('genmaicha-latte', 'Genmaicha Latte', 'Iced roasted brown rice green tea latte.', 17000, 'drinks', 'Cup', null, 20, 2, null),
  ('hojicha-latte',   'Hojicha Latte',   'Iced roasted green tea latte.',           17000, 'drinks', 'Cup', null, 20, 3, null),
  ('creamy-matcha',   'Creamy Matcha',   'Matcha latte topped with whipped cream and matcha drizzle.', 20000, 'drinks', 'Cup', null, 20, 4, null)
on conflict (id) do update set
  name            = excluded.name,
  description     = excluded.description,
  price           = excluded.price,
  category        = excluded.category,
  unit            = excluded.unit,
  sort_order      = excluded.sort_order;
