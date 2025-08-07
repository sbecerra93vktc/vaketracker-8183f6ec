-- Remove the policy that allows users to view their own tracking data
DROP POLICY IF EXISTS "Users can view their own tracking data" ON public.location_tracking;

-- Update the policies to only allow admins to view tracking data
-- Keep the insert policy for users so they can still add their location data
-- But remove their ability to read it back