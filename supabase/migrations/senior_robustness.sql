-- 1. CONFIGURATION (Feature Flags / Kill Switch)
create table if not exists app_config (
    key text primary key,
    value jsonb not null,
    description text,
    updated_at timestamptz default now()
);

-- Init Kill Switch (False by default)
insert into app_config (key, value, description)
values ('maintenance_mode', 'false'::jsonb, 'If true, bot responds with maintenance message and stops processing.')
on conflict (key) do nothing;

-- Alert Number (Admin)
insert into app_config (key, value, description)
values ('admin_phone', '"521..."'::jsonb, 'Phone number for critical alerts.')
on conflict (key) do nothing;


-- 2. IDEMPOTENCY (No Double Charge)
create table if not exists processed_messages (
    message_id text primary key,
    processed_at timestamptz default now()
);

-- Auto-expire old messages (optional, via pg_cron or manual cleanup)
-- For now, we just keep them. Index is cheap.

-- 3. RLS Policies
alter table app_config enable row level security;
alter table processed_messages enable row level security;

create policy "Service Role Full Access" on app_config
    for all using (true) with check (true);

create policy "Service Role Full Access" on processed_messages
    for all using (true) with check (true);
