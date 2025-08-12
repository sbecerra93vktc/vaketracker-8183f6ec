-- Add rate limiting for invitation creation
CREATE TABLE IF NOT EXISTS public.admin_action_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  action_type TEXT NOT NULL,
  action_details JSONB,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on admin action logs
ALTER TABLE public.admin_action_logs ENABLE ROW LEVEL SECURITY;

-- Admin users can view all logs
CREATE POLICY "Admins can view all admin action logs" 
ON public.admin_action_logs 
FOR SELECT 
USING (auth.uid() IN (
  SELECT user_id FROM public.user_roles WHERE role = 'admin'
));

-- Admin users can insert logs
CREATE POLICY "Admins can insert admin action logs" 
ON public.admin_action_logs 
FOR INSERT 
WITH CHECK (auth.uid() IN (
  SELECT user_id FROM public.user_roles WHERE role = 'admin'
));

-- Add index for performance
CREATE INDEX idx_admin_action_logs_user_action ON public.admin_action_logs(user_id, action_type, created_at);
CREATE INDEX idx_admin_action_logs_created_at ON public.admin_action_logs(created_at DESC);