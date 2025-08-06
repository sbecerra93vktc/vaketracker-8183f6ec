-- Add country and state columns to locations table
ALTER TABLE public.locations 
ADD COLUMN country text,
ADD COLUMN state text;