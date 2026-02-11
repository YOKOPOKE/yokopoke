-- Order History Table for Personalized Recommendations
CREATE TABLE IF NOT EXISTS order_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone text NOT NULL,
  customer_name text,
  order_date timestamptz DEFAULT now(),
  items jsonb NOT NULL,
  total numeric(10,2),
  delivery_method text,
  location jsonb, -- { latitude, longitude, address }
  full_address text,
  address_references text,
  created_at timestamptz DEFAULT now()
);

-- Indexes for fast lookup
CREATE INDEX IF NOT EXISTS idx_order_history_phone ON order_history(phone);
CREATE INDEX IF NOT EXISTS idx_order_history_date ON order_history(order_date DESC);

-- Enable RLS
ALTER TABLE order_history ENABLE ROW LEVEL SECURITY;

-- Policy: Allow service role to do everything
CREATE POLICY "Service role can manage order history"
  ON order_history
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
