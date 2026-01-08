CREATE TABLE IF NOT EXISTS orders (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    customer_name TEXT NOT NULL,
    customer_phone TEXT,
    customer_address TEXT,
    total NUMERIC NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'pending', -- pending, confirmed, completed, cancelled
    items JSONB NOT NULL DEFAULT '[]'::jsonb,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

-- Policy: Public can insert (create order)
CREATE POLICY "Public create orders" ON orders FOR INSERT WITH CHECK (true);

-- Policy: Only Admin can read/update (authenticated)
-- Assuming 'authenticated' role for admin panel usage
CREATE POLICY "Admin read orders" ON orders FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Admin update orders" ON orders FOR UPDATE USING (auth.role() = 'authenticated');
