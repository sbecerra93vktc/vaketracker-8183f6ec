-- Create location_tracking table for automatic location tracking
CREATE TABLE public.location_tracking (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  latitude NUMERIC NOT NULL,
  longitude NUMERIC NOT NULL,
  address TEXT,
  country TEXT,
  state TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.location_tracking ENABLE ROW LEVEL SECURITY;

-- Create policies for location tracking
CREATE POLICY "Admins can view all tracking data" 
ON public.location_tracking 
FOR SELECT 
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can insert their own tracking data" 
ON public.location_tracking 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own tracking data" 
ON public.location_tracking 
FOR SELECT 
USING (auth.uid() = user_id);