-- Solo Lash Features Migration
-- 1. Buffer minutes in site_settings
ALTER TABLE public.site_settings 
ADD COLUMN IF NOT EXISTS buffer_minutes integer DEFAULT 0;

-- 2. is_blocked in appointments
ALTER TABLE public.appointments 
ADD COLUMN IF NOT EXISTS is_blocked boolean DEFAULT false;

-- 3. Lash mapping in clients
ALTER TABLE public.clients 
ADD COLUMN IF NOT EXISTS lash_mapping text,
ADD COLUMN IF NOT EXISTS lash_curl text,
ADD COLUMN IF NOT EXISTS lash_thickness text,
ADD COLUMN IF NOT EXISTS lash_length text,
ADD COLUMN IF NOT EXISTS lash_adhesive text,
ADD COLUMN IF NOT EXISTS lash_notes text;

-- 4. Expenses table
CREATE TABLE IF NOT EXISTS public.expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  description text NOT NULL,
  amount numeric(10,2) NOT NULL CHECK (amount > 0),
  category text NOT NULL DEFAULT 'materiais',
  date date NOT NULL DEFAULT CURRENT_DATE,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'expenses' AND policyname = 'Admin can manage expenses'
  ) THEN
    CREATE POLICY "Admin can manage expenses" 
    ON public.expenses 
    FOR ALL 
    TO authenticated 
    USING (true) 
    WITH CHECK (true);
  END IF;
END $$;
