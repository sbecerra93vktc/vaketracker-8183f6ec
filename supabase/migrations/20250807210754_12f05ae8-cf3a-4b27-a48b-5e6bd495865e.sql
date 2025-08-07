-- Add policy to allow users to view their own tracking data
CREATE POLICY "Users can view their own tracking data" 
ON public.location_tracking 
FOR SELECT 
USING (auth.uid() = user_id);