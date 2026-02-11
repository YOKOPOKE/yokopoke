-- 1. CONFIGURATION (Feature Flags)
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


-- 2. IDEMPOTENCY
create table if not exists processed_messages (
    message_id text primary key,
    processed_at timestamptz default now()
);

-- 3. RLS Policies
alter table app_config enable row level security;
alter table processed_messages enable row level security;

-- Idempotent Policy Creation
do $$
begin
  if not exists (select 1 from pg_policies where policyname = 'Service Role Full Access' and tablename = 'app_config') then
    create policy "Service Role Full Access" on app_config for all using (true) with check (true);
  end if;
end
$$;

do $$
begin
  if not exists (select 1 from pg_policies where policyname = 'Service Role Full Access' and tablename = 'processed_messages') then
    create policy "Service Role Full Access" on processed_messages for all using (true) with check (true);
  end if;
end
$$;
