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

-- Idempotent Policy Creation
do $$
begin
  if not exists (select 1 from pg_policies where policyname = 'Service role can manage order history' and tablename = 'order_history') then
    create policy "Service role can manage order history" on order_history for all to service_role using (true) with check (true);
  end if;
end
$$;
