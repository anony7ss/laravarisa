import { z } from 'zod';

const cleanText = (max: number) => z.string().trim().min(1).max(max);

export const leadSchema = z.object({
  name: cleanText(80).min(2),
  email: z
    .string()
    .trim()
    .email()
    .max(254)
    .transform((v) => v.toLowerCase()),
  phone: z.string().trim().max(24).default(''),
  message: cleanText(1500).min(10),
  website: z.string().max(0).optional().default(''),
  turnstileToken: z.string().max(4096).optional().default(''),
});

export const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .email()
    .max(254)
    .transform((v) => v.toLowerCase()),
  password: z.string().min(8).max(256),
  remember_me: z.boolean().optional().default(true),
});

export const leadUpdateSchema = z.object({
  status: z.enum(['new', 'contacted', 'qualified', 'converted', 'archived']),
});

export const clientSchema = z.object({
  name: cleanText(80).min(2),
  email: z
    .union([z.literal(''), z.string().trim().email().max(254)])
    .default(''),
  phone: z.string().trim().max(24).default(''),
  notes: z.string().trim().max(3000).default(''),
  origin: z.string().trim().max(32).default('manual').optional(),
  created_from_lead: z.string().uuid().nullable().optional(),
  lash_mapping: z.string().trim().max(100).nullable().optional(),
  lash_curl: z.string().trim().max(50).nullable().optional(),
  lash_thickness: z.string().trim().max(50).nullable().optional(),
  lash_length: z.string().trim().max(100).nullable().optional(),
  lash_adhesive: z.string().trim().max(100).nullable().optional(),
  lash_notes: z.string().trim().max(2000).nullable().optional(),
});

export const serviceSchema = z.object({
  slug: z
    .string()
    .trim()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
    .max(120),
  name: cleanText(100).min(2),
  category: cleanText(80).min(2),
  description: cleanText(500).min(10),
  price_label: cleanText(60).min(2),
  duration_label: cleanText(40).min(2),
  duration_minutes: z.coerce.number().int().min(10).max(720),
  maintenance: cleanText(160).min(2),
  intensity: z.coerce.number().int().min(1).max(3),
  sort_order: z.coerce.number().int().min(-10000).max(10000).default(0),
  active: z.boolean().default(true),
});

export const gallerySchema = z.object({
  title: cleanText(100).min(2),
  subtitle: z.string().trim().max(160).default(''),
  image_path: cleanText(500),
  before_image_path: z.string().trim().max(500).nullable().optional(),
  alt_text: cleanText(220).min(5),
  object_position: z.string().trim().max(40).default('50% 50%'),
  zoom: z.coerce.number().min(1).max(2.5).default(1),
  sort_order: z.coerce.number().int().min(-10000).max(10000).default(0),
  active: z.boolean().default(true),
});

export const appointmentBaseSchema = z.object({
  client_id: z.string().uuid().nullable().optional(),
  lead_id: z.string().uuid().nullable().optional(),
  service_id: z.string().uuid().nullable().optional(),
  client_name: cleanText(80).min(2),
  client_phone: z.string().trim().max(24).default(''),
  starts_at: z.string().datetime({ offset: true }),
  ends_at: z.string().datetime({ offset: true }),
  status: z.enum([
    'scheduled',
    'confirmed',
    'completed',
    'cancelled',
    'no_show',
  ]),
  notes: z.string().trim().max(2000).default(''),
  origin: z.string().trim().max(40).optional(),
  is_blocked: z.boolean().default(false).optional(),
});

export const appointmentSchema = appointmentBaseSchema.refine(
  (data) => new Date(data.ends_at) > new Date(data.starts_at),
  {
    message: 'O horário final deve ser posterior ao inicial.',
    path: ['ends_at'],
  },
);

export const appointmentUpdateSchema = appointmentBaseSchema.partial();

export const anamnesisSchema = z.object({
  client_name: cleanText(100).min(2),
  client_phone: z.string().trim().min(10).max(24),
  has_allergies: z.boolean().default(false),
  allergies_detail: z.string().trim().max(1000).nullable().optional(),
  pregnant: z.boolean().default(false),
  eye_surgery: z.boolean().default(false),
  thyroid_issues: z.boolean().default(false),
  signature: cleanText(150).min(2),
});

export const settingsSchema = z.object({
  promo_active: z.boolean().default(false),
  promo_text: z.string().trim().max(280).default(''),
  promo_conditions: z.string().trim().max(500).default(''),
  promo_link_text: z.string().trim().max(80).default(''),
  promo_link_url: z.string().trim().max(255).default(''),
  // Operating rules & hours
  booking_enabled: z.boolean().default(true),
  booking_closed_message: z.string().trim().max(500).default(''),
  open_days: z.array(z.coerce.number().int().min(0).max(6)).default([1, 2, 3, 4, 5, 6]),
  open_time: z.string().regex(/^(\d{2}:\d{2})?$/, 'Formato HH:MM inválido').default('09:00'),
  close_time: z.string().regex(/^(\d{2}:\d{2})?$/, 'Formato HH:MM inválido').default('19:00'),
  break_start: z.string().trim().max(5).default(''),
  break_end: z.string().trim().max(5).default(''),
  buffer_minutes: z.coerce.number().int().min(0).max(60).default(0),
  slot_interval_minutes: z.coerce.number().int().min(10).max(180).default(30),
  min_lead_hours: z.coerce.number().int().min(0).max(72).default(2),
  max_future_days: z.coerce.number().int().min(1).max(120).default(30),
  // Communication & studio
  whatsapp_phone: z.string().trim().max(25).default('5551989601662'),
  whatsapp_confirmation_message: z.string().trim().max(1500).default(''),
  whatsapp_booking_message: z.string().trim().max(1500).default(''),
  booking_alert: z.string().trim().max(300).default(''),
  studio_name: z.string().trim().max(100).default('Lara Varisa - Lash Designer'),
  studio_instagram: z.string().trim().max(100).default('@laravarisa.lashes'),
  studio_instagram_url: z.string().trim().max(255).default('https://www.instagram.com/laravarisa.lashes/'),
  studio_email: z.string().trim().max(120).default('contato@laravarisa.com.br'),
  studio_address: z.string().trim().max(255).default('Atendimento presencial na Zona Norte'),
  studio_city: z.string().trim().max(255).default('Porto Alegre, RS — Endereço completo enviado no agendamento'),
  studio_hours: z.string().trim().max(255).default('Segunda a sábado · com agendamento'),
  studio_map_url: z.string().trim().max(1000).default('https://www.google.com/maps/embed?origin=mfe&pb=!1m2!2m1!1sZona+Norte,+Porto+Alegre+-+RS'),
  studio_directions_url: z.string().trim().max(1000).default('https://www.google.com/maps/search/?api=1&query=Zona+Norte%2C+Porto+Alegre+-+RS'),
  // Reminders (Lembretes Automáticos)
  reminder_active: z.boolean().default(true),
  reminder_hours_before: z.coerce.number().int().min(1).max(168).default(24),
  reminder_message_template: z.string().trim().max(1500).default(''),
  reminder_same_day_active: z.boolean().default(true),
  reminder_same_day_hours_before: z.coerce.number().int().min(1).max(24).default(2),
  reminder_same_day_message_template: z.string().trim().max(1500).default(''),
  // Post-Care & Satisfaction Survey (Pós-Atendimento & Google Review)
  post_care_active: z.boolean().default(true),
  post_care_hours_after: z.coerce.number().int().min(1).max(168).default(24),
  google_review_url: z.string().trim().max(500).default(''),
  post_care_message_template: z.string().trim().max(1500).default(''),
  // Status change notifications
  notify_on_status_change: z.boolean().default(true),
  msg_cancelled_template: z.string().trim().max(1500).default(''),
  msg_no_show_template: z.string().trim().max(1500).default(''),
  msg_completed_template: z.string().trim().max(1500).default(''),
  // Audio & Voice responses
  whatsapp_audio_mode: z.enum(['direct_request', 'mirror', 'always', 'disabled']).default('direct_request'),
  whatsapp_audio_voice: z.string().trim().max(100).default('pt-BR-FranciscaNeural'),
  // Personalização da Página de Agendamento (/agendar)
  booking_layout_style: z.string().trim().max(50).default('modern-app'),
  booking_theme: z.string().trim().max(50).default('classic-noir'),
  booking_bg_color: z.string().trim().max(30).default('#e7e7e2'),
  booking_card_bg: z.string().trim().max(30).default('#ffffff'),
  booking_primary_color: z.string().trim().max(30).default('#121211'),
  booking_accent_color: z.string().trim().max(30).default('#cca352'),
  booking_text_color: z.string().trim().max(30).default('#121211'),
  booking_border_color: z.string().trim().max(30).default('#cfcfc9'),
  booking_font_heading: z.string().trim().max(50).default('Anton'),
  booking_font_body: z.string().trim().max(50).default('DM Sans'),
  booking_cover_url: z.string().trim().max(500000).default('/lara-lashes-optimized.webp'),
  booking_avatar_url: z.string().trim().max(500000).default('/logo-emblem.png'),
  booking_title: z.string().trim().max(100).default('Lara Varisa'),
  booking_subtitle: z.string().trim().max(150).default('Lash Designer ︱ Especialista no Olhar'),
  booking_location_label: z.string().trim().max(150).default('Zona Norte, Porto Alegre - RS'),
  booking_promo_tag: z.string().trim().max(150).default('1ª visita: R$ 80 qualquer procedimento'),
  booking_guarantee_text: z.string().trim().max(500).default('Procedimentos realizados com isolamento perfeito, fios hipoalergênicos e biossegurança rigorosa.'),
});


export const testimonialSchema = z.object({
  client_name: cleanText(100).min(2),
  client_role: z.string().trim().max(100).default('Cliente'),
  content: cleanText(1000).min(5),
  rating: z.coerce.number().int().min(1).max(5).default(5),
  sort_order: z.coerce.number().int().min(-10000).max(10000).default(0),
  active: z.boolean().default(true),
});

export const expenseSchema = z.object({
  description: cleanText(150).min(2),
  amount: z.coerce.number().positive('O valor deve ser maior que zero'),
  category: z.string().trim().max(50).default('materiais'),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato YYYY-MM-DD inválido'),
  notes: z.string().trim().max(1000).nullable().optional(),
});

export const shortLinkSchema = z.object({
  title: cleanText(100).min(2),
  slug: z
    .string()
    .trim()
    .min(2, 'O slug deve ter pelo menos 2 caracteres')
    .max(60, 'O slug deve ter no máximo 60 caracteres')
    .regex(/^[a-zA-Z0-9_-]+$/, 'O slug deve conter apenas letras, números, hífen (-) ou sublinhado (_)'),
  target_url: z.string().trim().url('URL de destino inválida').max(2000),
  phone: z.string().trim().max(30).optional().default(''),
  message: z.string().trim().max(1500).optional().default(''),
  is_active: z.boolean().optional().default(true),
});


