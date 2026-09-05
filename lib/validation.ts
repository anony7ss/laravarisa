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
  created_from_lead: z.string().uuid().nullable().optional(),
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

export const appointmentSchema = z
  .object({
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
  })
  .refine((data) => new Date(data.ends_at) > new Date(data.starts_at), {
    message: 'O horário final deve ser posterior ao inicial.',
    path: ['ends_at'],
  });
