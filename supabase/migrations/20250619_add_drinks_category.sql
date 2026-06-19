-- Allow "drinks" as a menu item category
alter table menu_items drop constraint if exists menu_items_category_check;

alter table menu_items add constraint menu_items_category_check
  check (category in ('main', 'addon', 'frozen', 'drinks'));
