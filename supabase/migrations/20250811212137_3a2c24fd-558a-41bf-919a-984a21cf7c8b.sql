-- Add country field to profiles table
ALTER TABLE public.profiles 
ADD COLUMN country text;

-- Update the handle_new_user function to include country extraction
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Insert into profiles table
  INSERT INTO public.profiles (user_id, email, first_name, last_name, country)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data ->> 'first_name',
    NEW.raw_user_meta_data ->> 'last_name',
    NEW.raw_user_meta_data ->> 'country'
  );
  
  -- Assign role (admin for first user, salesman for others)
  INSERT INTO public.user_roles (user_id, role)
  VALUES (
    NEW.id,
    CASE 
      WHEN (SELECT COUNT(*) FROM public.profiles) = 1 THEN 'admin'::app_role
      ELSE 'salesman'::app_role
    END
  );
  
  RETURN NEW;
END;
$function$;