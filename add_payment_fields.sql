-- Add payment columns to orders table

ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'unpaid',
ADD COLUMN IF NOT EXISTS payment_method TEXT DEFAULT 'card';

-- Optional: Create an index for performance if table grows
-- CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
