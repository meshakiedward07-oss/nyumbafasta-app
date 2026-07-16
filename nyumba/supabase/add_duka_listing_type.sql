-- Add 'duka' to the listing_type PostgreSQL enum
-- Run this in the Supabase SQL editor

ALTER TYPE listing_type ADD VALUE IF NOT EXISTS 'duka';
