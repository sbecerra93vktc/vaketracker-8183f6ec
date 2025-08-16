-- First, ensure buckets exist with correct settings
INSERT INTO storage.buckets (id, name, public) VALUES 
  ('activity-photos', 'activity-photos', true),
  ('activity-videos', 'activity-videos', true),
  ('activity-audio', 'activity-audio', true)
ON CONFLICT (id) DO UPDATE SET 
  public = EXCLUDED.public;

-- Drop existing policies to recreate them properly
DROP POLICY IF EXISTS "Users can view their own activity photos" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload their own activity photos" ON storage.objects;
DROP POLICY IF EXISTS "Users can view their own activity videos" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload their own activity videos" ON storage.objects;
DROP POLICY IF EXISTS "Users can view their own activity audio" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload their own activity audio" ON storage.objects;
DROP POLICY IF EXISTS "Admins can view all activity photos" ON storage.objects;
DROP POLICY IF EXISTS "Admins can view all activity videos" ON storage.objects;
DROP POLICY IF EXISTS "Admins can view all activity audio" ON storage.objects;

-- Create new RLS policies for public access to photos, videos, and audio
CREATE POLICY "Public can view activity photos" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'activity-photos');

CREATE POLICY "Users can upload their own activity photos" 
ON storage.objects 
FOR INSERT 
WITH CHECK (bucket_id = 'activity-photos' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Public can view activity videos" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'activity-videos');

CREATE POLICY "Users can upload their own activity videos" 
ON storage.objects 
FOR INSERT 
WITH CHECK (bucket_id = 'activity-videos' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Public can view activity audio" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'activity-audio');

CREATE POLICY "Users can upload their own activity audio" 
ON storage.objects 
FOR INSERT 
WITH CHECK (bucket_id = 'activity-audio' AND auth.uid()::text = (storage.foldername(name))[1]);