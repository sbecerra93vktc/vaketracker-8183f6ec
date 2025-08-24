-- Add new fields to locations table for business information
ALTER TABLE public.locations 
ADD COLUMN IF NOT EXISTS business_name text,
ADD COLUMN IF NOT EXISTS contact_person text,
ADD COLUMN IF NOT EXISTS email text,
ADD COLUMN IF NOT EXISTS phone text;