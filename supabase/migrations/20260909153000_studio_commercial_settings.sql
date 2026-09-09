-- Migration: studio_commercial_settings
ALTER TABLE public.site_settings 
ADD COLUMN IF NOT EXISTS studio_name text DEFAULT 'Lara Varisa · Lash Designer',
ADD COLUMN IF NOT EXISTS studio_instagram text DEFAULT '@laravarisa.lashes',
ADD COLUMN IF NOT EXISTS studio_instagram_url text DEFAULT 'https://www.instagram.com/laravarisa.lashes/',
ADD COLUMN IF NOT EXISTS studio_email text DEFAULT 'contato@laravarisa.com.br',
ADD COLUMN IF NOT EXISTS studio_address text DEFAULT 'Atendimento presencial na Zona Norte',
ADD COLUMN IF NOT EXISTS studio_city text DEFAULT 'Porto Alegre, RS — Endereço completo enviado no agendamento',
ADD COLUMN IF NOT EXISTS studio_hours text DEFAULT 'Segunda a sábado · com agendamento',
ADD COLUMN IF NOT EXISTS studio_map_url text DEFAULT 'https://www.google.com/maps/embed?origin=mfe&pb=!1m2!2m1!1sZona+Norte,+Porto+Alegre+-+RS',
ADD COLUMN IF NOT EXISTS studio_directions_url text DEFAULT 'https://www.google.com/maps/search/?api=1&query=Zona+Norte%2C+Porto+Alegre+-+RS';
