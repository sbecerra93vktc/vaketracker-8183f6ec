-- Fix security vulnerability: Remove public access to invitations table
-- Drop the current public access policy
DROP POLICY IF EXISTS "Allow token-specific invitation lookup" ON public.invitations;

-- Create a secure function to validate invitation tokens without exposing email addresses
CREATE OR REPLACE FUNCTION public.validate_invitation_token(_token text)
RETURNS TABLE(is_valid boolean, email text, expires_at timestamp with time zone) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Return invitation details only if token is valid and not expired
  RETURN QUERY
  SELECT 
    true as is_valid,
    i.email,
    i.expires_at
  FROM public.invitations i
  WHERE i.token = _token 
    AND i.used = false 
    AND i.expires_at > now()
  LIMIT 1;
  
  -- If no valid invitation found, return false
  IF NOT FOUND THEN
    RETURN QUERY SELECT false as is_valid, ''::text as email, null::timestamp with time zone as expires_at;
  END IF;
END;
$$;

-- Grant execute permission to authenticated users and anonymous users (for sign-up flow)
GRANT EXECUTE ON FUNCTION public.validate_invitation_token(text) TO anon;
GRANT EXECUTE ON FUNCTION public.validate_invitation_token(text) TO authenticated;