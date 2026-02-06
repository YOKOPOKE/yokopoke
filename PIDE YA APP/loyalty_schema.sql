-- Editor SQL para Sistema de Lealtad (Pide Ya)

-- 1. Tabla de Clientes
create table if not exists public.clients (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  phone text unique not null,
  points int default 0,
  total_orders int default 0,
  last_active timestamp with time zone default now(),
  created_at timestamp with time zone default now()
);

-- 2. Tabla de Historial de Actividad
create table if not exists public.activity_log (
  id uuid default gen_random_uuid() primary key,
  client_id uuid references public.clients(id) on delete cascade not null,
  type text not null check (type in ('delivery', 'redemption', 'manual_adjustment')),
  description text,
  points_change int not null, -- Positivo para ganar, negativo para gastar
  created_at timestamp with time zone default now()
);

-- 3. Índices para búsqueda rápida
create index if not exists clients_phone_idx on public.clients(phone);
create index if not exists activity_client_id_idx on public.activity_log(client_id);

-- 4. Habilitar Realtime (Opcional, para actualización en vivo)
alter publication supabase_realtime add table public.clients;
alter publication supabase_realtime add table public.activity_log;

-- 5. Helper Functions (Opcional)

-- Función para agregar puntos y registrar actividad en una sola transacción
create or replace function add_points(
  p_client_id uuid,
  p_points int,
  p_description text,
  p_type text
) returns void as $$
begin
  -- Actualizar cliente
  update public.clients
  set 
    points = points + p_points,
    total_orders = case when p_type = 'delivery' then total_orders + 1 else total_orders end,
    last_active = now()
  where id = p_client_id;

  -- Registrar actividad
  insert into public.activity_log (client_id, type, description, points_change)
  values (p_client_id, p_type, p_description, p_points);
end;
$$ language plpgsql;
