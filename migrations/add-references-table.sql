-- Create "references" table for Life OS reference cards
-- Run this in the Supabase SQL Editor (Dashboard > SQL Editor)

-- 1. Create the table
CREATE TABLE IF NOT EXISTS "references" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  category text NOT NULL,
  content text,
  tags text[] DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 2. Create indexes
CREATE INDEX IF NOT EXISTS idx_"references"_category ON "references"(category);
CREATE INDEX IF NOT EXISTS idx_"references"_tags ON "references" USING gin(tags);

-- 3. Auto-update updated_at on changes
CREATE OR REPLACE FUNCTION update_"references"_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "references"_updated_at
  BEFORE UPDATE ON "references"
  FOR EACH ROW
  EXECUTE FUNCTION update_"references"_updated_at();
