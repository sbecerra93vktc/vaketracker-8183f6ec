-- Add avatar_url field to profiles table
ALTER TABLE public.profiles 
ADD COLUMN avatar_url TEXT;