-- Update username constraints to allow periods instead of hyphens
-- Run this after the initial migration to update the validation rules

-- Drop the old constraints
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS username_length;
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS username_format;

-- Add the updated constraints (periods allowed, hyphens not allowed)
ALTER TABLE profiles
  ADD CONSTRAINT username_length CHECK (char_length(username) >= 3 AND char_length(username) <= 20),
  ADD CONSTRAINT username_format CHECK (username ~ '^[a-zA-Z0-9_.]+$');
