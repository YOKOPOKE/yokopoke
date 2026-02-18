-- Fix Orders Table Schema to match Checkout Logic
-- Runs via Supabase Dashboard or psql

-- 1. Ensure columns exist
ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_name TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_method TEXT; -- 'pickup', 'delivery'
ALTER TABLE orders ADD COLUMN IF NOT EXISTS pickup_time TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS address TEXT; -- Full address
ALTER TABLE orders ADD COLUMN IF NOT EXISTS address_references TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS location JSONB; -- {latitude, longitude}
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'pending';

-- 2. Handle 'total' vs 'total_amount' ambiguity
ALTER TABLE orders ADD COLUMN IF NOT EXISTS total NUMERIC;

-- 3. Policy Update (Public/Anon Insert)
DROP POLICY IF EXISTS "Enable insert for everyone" ON orders;
CREATE POLICY "Enable insert for everyone" ON orders FOR INSERT WITH CHECK (true);

-- 4. Grant permissions
GRANT ALL ON orders TO anon;
GRANT ALL ON orders TO authenticated;
GRANT ALL ON orders TO service_role;
