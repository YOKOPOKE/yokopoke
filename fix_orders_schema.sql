-- Add columns if they don't exist
ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_address TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_phone TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS items JSONB DEFAULT '[]'::jsonb;

-- Ensure RLS is enabled
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

-- Re-apply policies just in case (Drop first to avoid errors if they exist)
DROP POLICY IF EXISTS "Public create orders" ON orders;
CREATE POLICY "Public create orders" ON orders FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Admin read orders" ON orders;
CREATE POLICY "Admin read orders" ON orders FOR SELECT USING (auth.role() = 'authenticated');
