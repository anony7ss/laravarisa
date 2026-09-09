-- Migration: Adiciona configurações de pós-atendimento e pesquisa de satisfação (Google Review)
ALTER TABLE public.site_settings
  ADD COLUMN IF NOT EXISTS post_care_active boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS post_care_hours_after integer DEFAULT 24,
  ADD COLUMN IF NOT EXISTS google_review_url text DEFAULT '',
  ADD COLUMN IF NOT EXISTS post_care_message_template text DEFAULT 'Oi, {nome}! ✨ Passando para saber como estão seus cílios e se você está amando o resultado! 💕

Lembre-se dos cuidados básicos:
• Evite vapor excessivo e água muito quente nos olhos
• Penteie suavemente com a escovinha sempre que acordar
• Lave a região com espuminha neutra

Sua opinião é super especial para nós! Se puder deixar uma avaliação com 5 estrelas no Google, nos ajuda demais:
⭐ {link_avaliacao}

Qualquer dúvida estou por aqui! Um beijo! 🥰';

ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS post_care_sent_at timestamptz DEFAULT NULL;
