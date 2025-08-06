-- Create locations table for tracking salesman positions
CREATE TABLE public.locations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  latitude DECIMAL(10, 8) NOT NULL,
  longitude DECIMAL(11, 8) NOT NULL,
  accuracy DECIMAL(8, 2),
  address TEXT,
  notes TEXT,
  visit_type TEXT DEFAULT 'check_in',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on locations table
ALTER TABLE public.locations ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for locations
CREATE POLICY "Users can view their own locations" ON public.locations
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own locations" ON public.locations
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own locations" ON public.locations
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all locations" ON public.locations
  FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

-- Create index for better performance
CREATE INDEX idx_locations_user_id ON public.locations(user_id);
CREATE INDEX idx_locations_created_at ON public.locations(created_at DESC);