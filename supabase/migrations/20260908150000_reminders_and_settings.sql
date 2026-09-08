-- Migration: Adiciona configurações de lembretes e templates de mensagens
ALTER TABLE public.site_settings
  ADD COLUMN IF NOT EXISTS reminder_active boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS reminder_hours_before integer DEFAULT 24,
  ADD COLUMN IF NOT EXISTS reminder_message_template text DEFAULT 'Oi, {nome}! ✨ Passando para lembrar do seu horário de *{procedimento}* amanhã ({data}) às *{horario}* no Studio Lara Varisa.\n\n📍 Local: {local}\n\nPodemos confirmar sua presença? Responda *1* para Confirmar ou me avise se precisar reagendar! 💕',
  ADD COLUMN IF NOT EXISTS reminder_same_day_active boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS reminder_same_day_hours_before integer DEFAULT 2,
  ADD COLUMN IF NOT EXISTS reminder_same_day_message_template text DEFAULT 'Oi, {nome}! Tudo pronto para te receber hoje às *{horario}* para seu *{procedimento}*! ✨\n\n📍 Studio Lara Varisa: {local}\n\nAté logo! 💕',
  ADD COLUMN IF NOT EXISTS whatsapp_booking_message text DEFAULT 'Oi, {nome}! Tudo bem? Aqui é a Lara. ✨\n\nRecebi o seu agendamento feito pelo nosso site e já confirmei tudinho no sistema:\n\n✨ *Procedimento:* {procedimento}\n📅 *Data:* {data}\n⏰ *Horário:* {horario}\n📍 *Local:* Studio Lara Varisa ({local})\n\nJá reservei esse momento com muito carinho para cuidar de você! Se precisar alterar a data ou tirar alguma dúvida, pode me responder diretamente por aqui.\n\nAté logo! 💕';

ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS reminder_sent_at timestamptz DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS reminder_same_day_sent_at timestamptz DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS whatsapp_notification_sent_at timestamptz DEFAULT NULL;
