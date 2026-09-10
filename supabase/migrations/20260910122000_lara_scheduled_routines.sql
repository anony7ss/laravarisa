-- Migração: Rotinas Agendadas e Briefings Automáticos para a Lara no WhatsApp

CREATE TABLE IF NOT EXISTS public.lara_scheduled_routines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  actor_phone text NOT NULL,
  title text NOT NULL,
  routine_type text NOT NULL, -- 'daily_agenda_briefing', 'weekly_agenda_briefing', 'financial_report', 'inactive_clients_alert'
  time_of_day text NOT NULL, -- '08:00' (HH:MM fuso Brasília)
  days_of_week integer[] DEFAULT '{1,2,3,4,5,6}', -- 0=domingo, 1=segunda ... 6=sábado
  active boolean NOT NULL DEFAULT true,
  last_run_at timestamptz,
  created_via text DEFAULT 'whatsapp'
);

ALTER TABLE public.lara_scheduled_routines ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff full access on lara_scheduled_routines" ON public.lara_scheduled_routines;
CREATE POLICY "Staff full access on lara_scheduled_routines" ON public.lara_scheduled_routines
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Insere rotina padrão ativa: Resumo da Agenda Diária às 08:00 (seg-sáb)
INSERT INTO public.lara_scheduled_routines (actor_phone, title, routine_type, time_of_day, days_of_week, active, created_via)
SELECT '5551989601662', 'Resumo Matinal da Agenda', 'daily_agenda_briefing', '08:00', '{1,2,3,4,5,6}', true, 'system'
WHERE NOT EXISTS (
  SELECT 1 FROM public.lara_scheduled_routines WHERE routine_type = 'daily_agenda_briefing'
);
