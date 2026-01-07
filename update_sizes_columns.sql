-- Agregar configuración para Bases y Extras
alter table public.sizes add column if not exists included_bases integer default 1;
alter table public.sizes add column if not exists price_extra_base numeric default 0;

alter table public.sizes add column if not exists included_extras integer default 0;
alter table public.sizes add column if not exists price_extra_extra numeric default 15;
