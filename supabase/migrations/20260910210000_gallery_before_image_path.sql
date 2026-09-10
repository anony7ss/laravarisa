-- Keep the before/after gallery field in sync with the application schema.
-- Older installations created gallery_items without this optional column.
BEGIN;

ALTER TABLE public.gallery_items
  ADD COLUMN IF NOT EXISTS before_image_path text;

COMMIT;
