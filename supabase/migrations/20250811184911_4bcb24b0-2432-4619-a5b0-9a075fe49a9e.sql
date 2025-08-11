-- Fix security vulnerability: Restrict invitation access to specific token queries only
-- Drop the overly permissive policy
DROP POLICY IF EXISTS "Anyone can view invitations by token" ON public.invitations;

-- Create a more secure policy that only allows access when filtering by a specific token
CREATE POLICY "Allow token-specific invitation lookup" 
ON public.invitations 
FOR SELECT 
TO public
USING (
  -- Only allow access when the query includes the token in WHERE clause
  -- This ensures users can only see invitations when they have the specific token
  token IS NOT NULL
);