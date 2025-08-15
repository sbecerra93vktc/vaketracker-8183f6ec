-- Create storage buckets for activity files
INSERT INTO storage.buckets (id, name, public) VALUES 
  ('activity-photos', 'activity-photos', true),
  ('activity-videos', 'activity-videos', true),
  ('activity-audio', 'activity-audio', false);

-- Create table for activity files
CREATE TABLE public.activity_files (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  activity_id UUID NOT NULL,
  file_type TEXT NOT NULL CHECK (file_type IN ('photo', 'video', 'audio')),
  file_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_size INTEGER,
  duration INTEGER, -- for audio/video files in seconds
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  user_id UUID NOT NULL
);

-- Enable RLS on activity_files table
ALTER TABLE public.activity_files ENABLE ROW LEVEL SECURITY;

-- RLS policies for activity_files
CREATE POLICY "Users can view their own activity files" 
ON public.activity_files 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all activity files" 
ON public.activity_files 
FOR SELECT 
USING (auth.uid() IN (SELECT user_id FROM user_roles WHERE role = 'admin'::app_role));

CREATE POLICY "Users can insert their own activity files" 
ON public.activity_files 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own activity files" 
ON public.activity_files 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own activity files" 
ON public.activity_files 
FOR DELETE 
USING (auth.uid() = user_id);

-- Storage policies for activity-photos bucket
CREATE POLICY "Activity photos are publicly accessible" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'activity-photos');

CREATE POLICY "Users can upload activity photos" 
ON storage.objects 
FOR INSERT 
WITH CHECK (bucket_id = 'activity-photos' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can update their activity photos" 
ON storage.objects 
FOR UPDATE 
USING (bucket_id = 'activity-photos' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete their activity photos" 
ON storage.objects 
FOR DELETE 
USING (bucket_id = 'activity-photos' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Storage policies for activity-videos bucket
CREATE POLICY "Activity videos are publicly accessible" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'activity-videos');

CREATE POLICY "Users can upload activity videos" 
ON storage.objects 
FOR INSERT 
WITH CHECK (bucket_id = 'activity-videos' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can update their activity videos" 
ON storage.objects 
FOR UPDATE 
USING (bucket_id = 'activity-videos' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete their activity videos" 
ON storage.objects 
FOR DELETE 
USING (bucket_id = 'activity-videos' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Storage policies for activity-audio bucket (private - only for authenticated users)
CREATE POLICY "Users can view their own activity audio" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'activity-audio' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Admins can view all activity audio" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'activity-audio' AND auth.uid() IN (SELECT user_id FROM user_roles WHERE role = 'admin'::app_role));

CREATE POLICY "Users can upload activity audio" 
ON storage.objects 
FOR INSERT 
WITH CHECK (bucket_id = 'activity-audio' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can update their activity audio" 
ON storage.objects 
FOR UPDATE 
USING (bucket_id = 'activity-audio' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete their activity audio" 
ON storage.objects 
FOR DELETE 
USING (bucket_id = 'activity-audio' AND auth.uid()::text = (storage.foldername(name))[1]);