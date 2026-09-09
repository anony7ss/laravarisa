-- Migration: Enable RLS on whatsapp_lid_mapping and clean up synced contacts
-- Date: 2026-09-09

-- 1. Enable Row Level Security on whatsapp_lid_mapping
ALTER TABLE public.whatsapp_lid_mapping ENABLE ROW LEVEL SECURITY;

-- 2. Clean up any existing policies on whatsapp_lid_mapping
DROP POLICY IF EXISTS whatsapp_lid_mapping_select ON public.whatsapp_lid_mapping;
DROP POLICY IF EXISTS whatsapp_lid_mapping_insert ON public.whatsapp_lid_mapping;
DROP POLICY IF EXISTS whatsapp_lid_mapping_update ON public.whatsapp_lid_mapping;
DROP POLICY IF EXISTS whatsapp_lid_mapping_delete ON public.whatsapp_lid_mapping;

-- 3. Staff/Admin policies for whatsapp_lid_mapping (service_role automatically bypasses RLS)
CREATE POLICY whatsapp_lid_mapping_select ON public.whatsapp_lid_mapping
  FOR SELECT TO authenticated
  USING (is_staff());

CREATE POLICY whatsapp_lid_mapping_insert ON public.whatsapp_lid_mapping
  FOR INSERT TO authenticated
  WITH CHECK (can_edit());

CREATE POLICY whatsapp_lid_mapping_update ON public.whatsapp_lid_mapping
  FOR UPDATE TO authenticated
  USING (can_edit())
  WITH CHECK (can_edit());

CREATE POLICY whatsapp_lid_mapping_delete ON public.whatsapp_lid_mapping
  FOR DELETE TO authenticated
  USING (is_admin());

-- 4. Purge all automatically captured address book contacts
TRUNCATE TABLE public.whatsapp_lid_mapping;
