-- Permitir fotos también en la tabla de Ingredientes
alter table public.ingredients add column if not exists image_url text;

-- Asegurar permisos (por si acaso)
grant update on public.ingredients to authenticated;
grant insert on public.ingredients to authenticated;
