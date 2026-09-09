-- Migration: Create short_links table and click tracking
CREATE TABLE IF NOT EXISTS public.short_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text UNIQUE NOT NULL,
  title text NOT NULL,
  target_url text NOT NULL,
  phone text,
  message text,
  clicks_count integer NOT NULL DEFAULT 0,
  last_clicked_at timestamptz,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_short_links_slug ON public.short_links (slug);
CREATE INDEX IF NOT EXISTS idx_short_links_created_at ON public.short_links (created_at DESC);

ALTER TABLE public.short_links ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'short_links' AND policyname = 'Allow public read active short links'
  ) THEN
    CREATE POLICY Allow public read active short links
      ON public.short_links
      FOR SELECT
      TO anon, authenticated
      USING (is_active = true);
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'short_links' AND policyname = 'Allow staff full access to short links'
  ) THEN
    CREATE POLICY Allow staff full access to short links
      ON public.short_links
      FOR ALL
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.profiles
          WHERE profiles.id = auth.uid()
            AND profiles.role IN ('admin', 'editor')
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.profiles
          WHERE profiles.id = auth.uid()
            AND profiles.role IN ('admin', 'editor')
        )
      );
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.increment_short_link_clicks(p_slug text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.short_links
  SET clicks_count = clicks_count + 1,
      last_clicked_at = now()
  WHERE lower(slug) = lower(p_slug) AND is_active = true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.increment_short_link_clicks(text) TO anon, authenticated;

-- Seed inicial de links padrão se não existirem
INSERT INTO public.short_links (slug, title, phone, message, target_url)
VALUES 
  ('bio', 'Link da Bio Instagram', '5551989601662', 'Olá, Lara! Vim pelo Instagram e quero agendar meu procedimento.', 'https://wa.me/5551989601662?text=Ol%C3%A1%2C%20Lara!%20Vim%20pelo%20Instagram%20e%20quero%20agendar%20meu%20procedimento.'),
  ('promo80', 'Promoção 1ª Visita (R$ 80)', '5551989601662', 'Olá, Lara! Vi a promoção de 1ª vez por R$ 80 e quero agendar meu horário.', 'https://wa.me/5551989601662?text=Ol%C3%A1%2C%20Lara!%20Vi%20a%20promo%C3%A7%C3%A3o%20de%201%C2%AA%20vez%20por%20R%24%2080%20e%20quero%20agendar%20meu%20hor%C3%A1rio.'),
  ('agendar', 'Agendamento Direto WhatsApp', '5551989601662', 'Olá, Lara! Gostaria de consultar os horários disponíveis para atendimento.', 'https://wa.me/5551989601662?text=Ol%C3%A1%2C%20Lara!%20Gostaria%20de%20consultar%20os%20hor%C3%A1rios%20dispon%C3%ADveis%20para%20atendimento.')
ON CONFLICT (slug) DO NOTHING;
