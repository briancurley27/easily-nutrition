-- Migration: Hybrid Nutrition System
-- Description: Add tables for caching, global corrections, and admin review
-- Run this in Supabase SQL Editor

-- =============================================================================
-- NUTRITION CACHE TABLE
-- Stores cached nutrition lookups to reduce API calls and improve speed
-- =============================================================================
CREATE TABLE IF NOT EXISTS nutrition_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cache_key text UNIQUE NOT NULL,           -- Normalized food key (e.g., "mcdonald's:big_mac")
  source_type text NOT NULL,                 -- 'usda', 'gpt_web', 'gpt_estimate'
  nutrition jsonb NOT NULL,                  -- {calories, protein, carbs, fat, source, sourceDetail}
  usda_fdc_id integer,                       -- Link to USDA food if applicable
  created_at timestamptz DEFAULT now(),
  expires_at timestamptz NOT NULL,           -- TTL varies by source type
  hit_count integer DEFAULT 0,               -- Track cache popularity
  last_hit_at timestamptz
);

-- Index for fast cache lookups
CREATE INDEX IF NOT EXISTS idx_nutrition_cache_key ON nutrition_cache(cache_key);
CREATE INDEX IF NOT EXISTS idx_nutrition_cache_expires ON nutrition_cache(expires_at);
CREATE INDEX IF NOT EXISTS idx_nutrition_cache_source ON nutrition_cache(source_type);

-- Cleanup job: Delete expired cache entries (run periodically)
-- Can be triggered by a Supabase Edge Function or cron job
CREATE OR REPLACE FUNCTION cleanup_expired_cache()
RETURNS integer AS $$
DECLARE
  deleted_count integer;
BEGIN
  DELETE FROM nutrition_cache WHERE expires_at < now();
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- GLOBAL CORRECTIONS TABLE
-- Admin-verified nutrition overrides that apply to all users
-- =============================================================================
CREATE TABLE IF NOT EXISTS global_corrections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  food_key text UNIQUE NOT NULL,             -- Normalized key for matching
  food_name text NOT NULL,                   -- Display name
  brand text,                                -- Brand name if applicable
  restaurant text,                           -- Restaurant name if applicable
  calories integer NOT NULL,
  protein numeric(6,1) NOT NULL,
  carbs numeric(6,1) NOT NULL,
  fat numeric(6,1) NOT NULL,
  serving_size text,                         -- e.g., "1 sandwich", "medium fries"
  source text,                               -- Where the data came from
  source_url text,                           -- Link to source
  verified_by uuid REFERENCES auth.users(id), -- Admin who verified
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_global_corrections_key ON global_corrections(food_key);
CREATE INDEX IF NOT EXISTS idx_global_corrections_brand ON global_corrections(brand);
CREATE INDEX IF NOT EXISTS idx_global_corrections_restaurant ON global_corrections(restaurant);

-- =============================================================================
-- PENDING CORRECTIONS TABLE
-- GPT web search results awaiting admin review
-- =============================================================================
CREATE TABLE IF NOT EXISTS pending_corrections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  food_query text NOT NULL,                  -- Original search query
  food_key text NOT NULL,                    -- Normalized key
  quantity numeric(6,2),                     -- Quantity from user input
  unit text,                                 -- Unit from user input
  gpt_result jsonb NOT NULL,                 -- What GPT returned
  original_result jsonb,                     -- What was returned before retry (if applicable)
  user_id uuid REFERENCES auth.users(id),    -- Who triggered this lookup
  status text DEFAULT 'pending',             -- 'pending', 'approved', 'rejected', 'duplicate'
  reviewed_by uuid REFERENCES auth.users(id), -- Admin who reviewed
  reviewed_at timestamptz,
  notes text,                                -- Admin notes
  created_at timestamptz DEFAULT now()
);

-- Index for admin review workflow
CREATE INDEX IF NOT EXISTS idx_pending_corrections_status ON pending_corrections(status);
CREATE INDEX IF NOT EXISTS idx_pending_corrections_key ON pending_corrections(food_key);
CREATE INDEX IF NOT EXISTS idx_pending_corrections_created ON pending_corrections(created_at DESC);

-- =============================================================================
-- ROW LEVEL SECURITY
-- =============================================================================

-- Enable RLS on all new tables
ALTER TABLE nutrition_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE global_corrections ENABLE ROW LEVEL SECURITY;
ALTER TABLE pending_corrections ENABLE ROW LEVEL SECURITY;

-- Nutrition cache: Read access for all authenticated users (shared cache)
CREATE POLICY "Cache is readable by authenticated users"
  ON nutrition_cache FOR SELECT
  TO authenticated
  USING (true);

-- Nutrition cache: Insert/Update for authenticated users
CREATE POLICY "Authenticated users can write to cache"
  ON nutrition_cache FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update cache"
  ON nutrition_cache FOR UPDATE
  TO authenticated
  USING (true);

-- Global corrections: Read access for everyone (public data)
CREATE POLICY "Global corrections are public"
  ON global_corrections FOR SELECT
  TO authenticated
  USING (true);

-- Global corrections: Only admins can modify (implement admin check as needed)
-- For now, we'll handle this at the application level

-- Pending corrections: Users can insert
CREATE POLICY "Users can submit pending corrections"
  ON pending_corrections FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Pending corrections: Users can view their own submissions
CREATE POLICY "Users can view their own pending corrections"
  ON pending_corrections FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- =============================================================================
-- HELPER FUNCTIONS
-- =============================================================================

-- Function to normalize food keys consistently
CREATE OR REPLACE FUNCTION normalize_food_key(
  food_name text,
  brand text DEFAULT NULL,
  restaurant text DEFAULT NULL
)
RETURNS text AS $$
DECLARE
  parts text[];
  result text;
BEGIN
  IF restaurant IS NOT NULL AND restaurant != '' THEN
    parts := array_append(parts, lower(trim(restaurant)));
  END IF;
  IF brand IS NOT NULL AND brand != '' THEN
    parts := array_append(parts, lower(trim(brand)));
  END IF;
  parts := array_append(parts, lower(trim(food_name)));

  result := array_to_string(parts, ':');
  result := regexp_replace(result, '\s+', '_', 'g');

  RETURN result;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function to approve a pending correction and move to global corrections
CREATE OR REPLACE FUNCTION approve_correction(
  correction_id uuid,
  admin_id uuid
)
RETURNS uuid AS $$
DECLARE
  pending pending_corrections%ROWTYPE;
  new_correction_id uuid;
BEGIN
  -- Get the pending correction
  SELECT * INTO pending FROM pending_corrections WHERE id = correction_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Correction not found';
  END IF;

  -- Insert into global corrections
  INSERT INTO global_corrections (
    food_key,
    food_name,
    calories,
    protein,
    carbs,
    fat,
    source,
    verified_by
  )
  VALUES (
    pending.food_key,
    pending.food_query,
    (pending.gpt_result->>'calories')::integer,
    (pending.gpt_result->>'protein')::numeric,
    (pending.gpt_result->>'carbs')::numeric,
    (pending.gpt_result->>'fat')::numeric,
    pending.gpt_result->>'sourceDetail',
    admin_id
  )
  ON CONFLICT (food_key) DO UPDATE SET
    calories = EXCLUDED.calories,
    protein = EXCLUDED.protein,
    carbs = EXCLUDED.carbs,
    fat = EXCLUDED.fat,
    source = EXCLUDED.source,
    verified_by = EXCLUDED.verified_by,
    updated_at = now()
  RETURNING id INTO new_correction_id;

  -- Update pending status
  UPDATE pending_corrections
  SET status = 'approved',
      reviewed_by = admin_id,
      reviewed_at = now()
  WHERE id = correction_id;

  -- Invalidate cache for this food
  DELETE FROM nutrition_cache WHERE cache_key = pending.food_key;

  RETURN new_correction_id;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- VIEWS FOR ADMIN DASHBOARD
-- =============================================================================

-- View: Pending corrections for review
CREATE OR REPLACE VIEW pending_corrections_view AS
SELECT
  id,
  food_query,
  food_key,
  quantity,
  unit,
  gpt_result->>'calories' as calories,
  gpt_result->>'protein' as protein,
  gpt_result->>'carbs' as carbs,
  gpt_result->>'fat' as fat,
  gpt_result->>'source' as source,
  gpt_result->>'sourceDetail' as source_detail,
  gpt_result->>'confidence' as confidence,
  status,
  created_at
FROM pending_corrections
WHERE status = 'pending'
ORDER BY created_at DESC;

-- View: Cache statistics
CREATE OR REPLACE VIEW cache_statistics AS
SELECT
  source_type,
  count(*) as total_entries,
  sum(hit_count) as total_hits,
  avg(hit_count) as avg_hits,
  count(*) FILTER (WHERE expires_at < now()) as expired_entries
FROM nutrition_cache
GROUP BY source_type;

-- View: Most popular cached foods
CREATE OR REPLACE VIEW popular_foods AS
SELECT
  cache_key,
  nutrition->>'source' as source,
  nutrition->>'calories' as calories,
  hit_count,
  created_at,
  last_hit_at
FROM nutrition_cache
ORDER BY hit_count DESC
LIMIT 100;

-- =============================================================================
-- SAMPLE DATA (Optional - for testing)
-- =============================================================================

-- Uncomment to add sample global corrections for testing
/*
INSERT INTO global_corrections (food_key, food_name, brand, calories, protein, carbs, fat, source)
VALUES
  ('fairlife:chocolate_milk', 'Chocolate Milk', 'Fairlife', 140, 13, 13, 4.5, 'Fairlife official nutrition'),
  ('mcdonald''s:big_mac', 'Big Mac', NULL, 590, 25, 46, 34, 'McDonald''s official nutrition'),
  ('starbucks:grande_latte', 'Grande Latte', NULL, 190, 13, 19, 7, 'Starbucks official nutrition')
ON CONFLICT (food_key) DO NOTHING;
*/
