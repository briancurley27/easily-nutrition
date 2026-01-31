-- Fix RLS policy to allow username availability checking
-- This allows users to check if a username is taken without exposing sensitive data

-- Drop the restrictive SELECT policy
DROP POLICY IF EXISTS "Users can view their own profile" ON profiles;

-- Add a new policy that allows anyone to read the profiles table
-- This is safe because usernames are meant to be public (like Instagram/Twitter)
-- and the table only contains id, username, and timestamps (no sensitive data)
CREATE POLICY "Anyone can read profiles for username checking"
  ON profiles FOR SELECT
  USING (true);

-- Keep the UPDATE and INSERT policies restrictive (users can only modify their own profile)
-- These policies should already exist from the initial migration
