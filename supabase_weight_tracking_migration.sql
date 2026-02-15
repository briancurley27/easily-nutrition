-- Weight Tracking Migration
-- Run this in your Supabase SQL Editor (Dashboard > SQL Editor)

-- Weight entries table (one entry per user per date)
CREATE TABLE IF NOT EXISTS weight_entries (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users NOT NULL,
  date text NOT NULL,
  weight_lbs numeric NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, date)
);

-- Weight goals table (one goal per user)
CREATE TABLE IF NOT EXISTS weight_goals (
  user_id uuid REFERENCES auth.users PRIMARY KEY,
  target_weight_lbs numeric NOT NULL,
  updated_at timestamptz DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE weight_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE weight_goals ENABLE ROW LEVEL SECURITY;

-- RLS policies for weight_entries
CREATE POLICY "Users can view their own weight entries"
  ON weight_entries FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own weight entries"
  ON weight_entries FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own weight entries"
  ON weight_entries FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own weight entries"
  ON weight_entries FOR DELETE USING (auth.uid() = user_id);

-- RLS policies for weight_goals
CREATE POLICY "Users can view their own weight goals"
  ON weight_goals FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own weight goals"
  ON weight_goals FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own weight goals"
  ON weight_goals FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own weight goals"
  ON weight_goals FOR DELETE USING (auth.uid() = user_id);

-- Index for fast lookups by user and date
CREATE INDEX IF NOT EXISTS idx_weight_entries_user_date ON weight_entries(user_id, date);
