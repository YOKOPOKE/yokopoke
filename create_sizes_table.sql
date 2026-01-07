-- Tabla para definir reglas del Builder (Tamaños)
create table public.sizes (
    id serial primary key,
    name text not null, -- Chico, Mediano, Grande
    base_price numeric not null default 0,
    included_proteins integer default 2,
    price_extra_protein numeric default 45,
    included_toppings integer default 4, -- Mixins
    price_extra_topping numeric default 0,
    included_crunches integer default 2, -- Toppings/Crunch
    price_extra_crunch numeric default 10,
    included_sauces integer default 2,
    price_extra_sauce numeric default 15
);

-- Habilitar RLS
alter table public.sizes enable row level security;
create policy "Public Select Sizes" on public.sizes for select using (true);
create policy "Admin All Sizes" on public.sizes for all using (true); -- Simplificado para admin

-- Insertar valores por defecto (Basados en lo que vi en el código)
insert into public.sizes (name, base_price, included_proteins, price_extra_protein, included_toppings, price_extra_topping, included_crunches, price_extra_crunch, included_sauces, price_extra_sauce)
values
('Chico', 160, 1, 45, 3, 0, 2, 10, 2, 15),
('Mediano', 189, 2, 45, 4, 0, 2, 10, 2, 15),
('Grande', 220, 3, 45, 5, 0, 3, 10, 3, 15);
