-- 1. SOLUCIÓN DE PERMISOS (Indispensable para que se vea algo)
alter table public.menu_items enable row level security;
alter table public.ingredients enable row level security;

create policy "Public Menu Access 2024" on public.menu_items for select using (true);
create policy "Public Ingred Access 2024" on public.ingredients for select using (true);
create policy "Public Products 2024" on public.products for select using (true); -- Por si acaso

-- 2. DATOS DE EJEMPLO (Solo si tu menú está vacío)
insert into public.menu_items (name, description, price, category, is_available, image_url)
values 
('Yoko Bowl', 'Atún fresco, aguacate, edamame, pepino y salsa de la casa.', 189.00, 'bowls', true, 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c'),
('Spicy Tuna', 'Atún picante, masago, cebollín y salsa spicy mayo.', 195.00, 'bowls', true, 'https://images.unsplash.com/photo-1519708227418-e8d316e88549'),
('Salmon Lover', 'Doble porción de salmón, queso crema, aguacate y ajonjolí.', 210.00, 'bowls', true, 'https://images.unsplash.com/photo-1579871494447-9811cf80d66c'),
('Sushi Burger', 'Hamburguesa de arroz empanizado rellena de salmón y tampico.', 150.00, 'burgers', true, 'https://images.unsplash.com/photo-1553621042-f6e147245754');
