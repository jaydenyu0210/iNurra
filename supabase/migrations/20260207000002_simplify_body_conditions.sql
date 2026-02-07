-- Migration: Simplify body_conditions table schema
-- Drop unused columns and add new numeric values for progression tracking

-- Drop unused columns
ALTER TABLE body_conditions DROP COLUMN IF EXISTS location_description;
ALTER TABLE body_conditions DROP COLUMN IF EXISTS width_mm;
ALTER TABLE body_conditions DROP COLUMN IF EXISTS height_mm;
ALTER TABLE body_conditions DROP COLUMN IF EXISTS area_mm2;
ALTER TABLE body_conditions DROP COLUMN IF EXISTS depth_mm;
ALTER TABLE body_conditions DROP COLUMN IF EXISTS texture;
ALTER TABLE body_conditions DROP COLUMN IF EXISTS shape;
ALTER TABLE body_conditions DROP COLUMN IF EXISTS severity;
ALTER TABLE body_conditions DROP COLUMN IF EXISTS annotated_image_path;
ALTER TABLE body_conditions DROP COLUMN IF EXISTS notes;

-- Rename color to color_depth and change type to numeric (0-1 scale)
ALTER TABLE body_conditions DROP COLUMN IF EXISTS color;
ALTER TABLE body_conditions ADD COLUMN IF NOT EXISTS color_depth NUMERIC;

-- Add size column for area of impact
ALTER TABLE body_conditions ADD COLUMN IF NOT EXISTS size NUMERIC;

-- Add comment for clarity
COMMENT ON COLUMN body_conditions.color_depth IS 'Color depth value from 0 to 1, where 1 is highest intensity/severity';
COMMENT ON COLUMN body_conditions.size IS 'Size/area of impact of the condition on skin, relative numeric value';
