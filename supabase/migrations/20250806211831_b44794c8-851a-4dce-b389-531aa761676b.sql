-- Create user permissions table
CREATE TABLE public.user_permissions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  permission_name TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, permission_name)
);

-- Enable RLS
ALTER TABLE public.user_permissions ENABLE ROW LEVEL SECURITY;

-- Create policies for user_permissions table
CREATE POLICY "Admins can manage all user permissions" 
ON public.user_permissions 
FOR ALL 
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can view their own permissions" 
ON public.user_permissions 
FOR SELECT 
USING (auth.uid() = user_id);

-- Add trigger for automatic timestamp updates
CREATE TRIGGER update_user_permissions_updated_at
BEFORE UPDATE ON public.user_permissions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default permissions for existing users
INSERT INTO public.user_permissions (user_id, permission_name, enabled)
SELECT 
  ur.user_id,
  permission_name,
  CASE 
    WHEN ur.role = 'admin' THEN true
    ELSE false
  END as enabled
FROM public.user_roles ur
CROSS JOIN (
  VALUES 
    ('view_team_locations'),
    ('view_team_activities'),
    ('access_admin_panel'),
    ('manage_users'),
    ('view_analytics')
) AS permissions(permission_name)
ON CONFLICT (user_id, permission_name) DO NOTHING;