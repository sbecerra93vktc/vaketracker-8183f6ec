-- Fix critical security issue: Restrict invitation updates to admin users only
DROP POLICY IF EXISTS "Anyone can update invitation status" ON public.invitations;

-- Create secure policy that only allows admins to update invitations
CREATE POLICY "Only admins can update invitations" 
ON public.invitations 
FOR UPDATE 
USING (has_role(auth.uid(), 'admin'::app_role));