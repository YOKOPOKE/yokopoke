-- FIX PERMISSIONS (RLS)
-- Run this in your Supabase SQL Editor to allow Updates/Inserts/Deletes for Menu Items.

-- 1. Enable RLS (Just in case)
alter table public.menu_items enable row level security;
alter table public.ingredients enable row level security;

-- 2. Create Policies for ALL operations (Insert, Update, Delete, Select)
-- Note: 'using (true)' means ANYONE (even anonymous users with the key) can modify. 
-- For a real production app, you'd use 'to authenticated' and check roles, 
-- but for this Setup, we want to ensure the Admin Panel works locally immediately.

-- Drop existing restricted policies if they exist
drop policy if exists "Public Menu Access 2024" on public.menu_items;
drop policy if exists "Public Ingred Access 2024" on public.ingredients;
drop policy if exists "Menu Full Access" on public.menu_items;
drop policy if exists "Ingredients Full Access" on public.ingredients;

-- Create Permissive Policies
create policy "Menu Full Access" on public.menu_items for all using (true) with check (true);
create policy "Ingredients Full Access" on public.ingredients for all using (true) with check (true);

-- 3. Verify Storage Bucket Policies (Images)
-- Ensure 'menu-images' bucket is public
insert into storage.buckets (id, name, public) 
values ('menu-images', 'menu-images', true)
on conflict (id) do update set public = true;

-- Allow public access to storage objects
drop policy if exists "Public Storage Access" on storage.objects;
create policy "Public Storage Access" on storage.objects for all using ( bucket_id = 'menu-images' ) with check ( bucket_id = 'menu-images' );
