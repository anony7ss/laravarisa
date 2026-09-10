-- Índices para as consultas quentes do bot (nome/telefone e agenda futura).
-- Mantêm o atendimento rápido sem expor novas colunas ou permissões.
CREATE INDEX IF NOT EXISTS clients_phone_idx
  ON public.clients (phone);

CREATE INDEX IF NOT EXISTS appointments_client_phone_starts_idx
  ON public.appointments (client_phone, starts_at);

CREATE INDEX IF NOT EXISTS appointments_status_starts_idx
  ON public.appointments (status, starts_at);
