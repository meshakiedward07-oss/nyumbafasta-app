-- Nyumba patch.sql — run once in Supabase SQL Editor
-- This fixes issues introduced by schema.sql running on an existing database.

-- ── 1. Fix handle_new_user trigger ────────────────────────
-- schema.sql replaced this function with one that referenced email/phone
-- columns that don't exist in the actual users table.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.users (id, phone, full_name, role)
  VALUES (
    NEW.id,
    NEW.phone,
    COALESCE(NEW.raw_user_meta_data->>'full_name', 'Mtumiaji'),
    COALESCE(NEW.raw_user_meta_data->>'role', 'client')::user_role
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- ── 2. Add bedrooms column to listings ────────────────────
ALTER TABLE listings ADD COLUMN IF NOT EXISTS bedrooms INTEGER;
