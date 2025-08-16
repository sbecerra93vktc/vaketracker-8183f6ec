-- Create storage buckets for activity files with public access for photos
INSERT INTO storage.buckets (id, name, public) VALUES 
  ('activity-photos', 'activity-photos', true),
  ('activity-videos', 'activity-videos', false),
  ('activity-audio', 'activity-audio', false)
ON CONFLICT (id) DO UPDATE SET 
  public = EXCLUDED.public;

-- Create RLS policies for activity files storage
CREATE POLICY "Users can view their own activity photos" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'activity-photos' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can upload their own activity photos" 
ON storage.objects 
FOR INSERT 
WITH CHECK (bucket_id = 'activity-photos' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can view their own activity videos" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'activity-videos' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can upload their own activity videos" 
ON storage.objects 
FOR INSERT 
WITH CHECK (bucket_id = 'activity-videos' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can view their own activity audio" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'activity-audio' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can upload their own activity audio" 
ON storage.objects 
FOR INSERT 
WITH CHECK (bucket_id = 'activity-audio' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Admin can view all activity files
CREATE POLICY "Admins can view all activity photos" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'activity-photos' AND EXISTS (
  SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role = 'admin'
));

CREATE POLICY "Admins can view all activity videos" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'activity-videos' AND EXISTS (
  SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role = 'admin'
));

CREATE POLICY "Admins can view all activity audio" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'activity-audio' AND EXISTS (
  SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role = 'admin'
));