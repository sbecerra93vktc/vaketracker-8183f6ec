import { supabase } from '@/integrations/supabase/client';

interface SecurityLogData {
  action_type: string;
  action_details?: Record<string, any>;
  ip_address?: string;
  user_agent?: string;
}

export const logSecurityEvent = async (data: SecurityLogData): Promise<void> => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      console.error('Cannot log security event: no authenticated user');
      return;
    }

    await supabase
      .from('admin_action_logs')
      .insert({
        user_id: user.id,
        action_type: data.action_type,
        action_details: data.action_details || null,
        ip_address: data.ip_address || null,
        user_agent: data.user_agent || navigator.userAgent
      });

  } catch (error) {
    console.error('Failed to log security event:', error);
  }
};

export const validateInput = (input: string, maxLength: number = 1000): string => {
  if (typeof input !== 'string') {
    throw new Error('Input must be a string');
  }
  
  if (input.length > maxLength) {
    throw new Error(`Input exceeds maximum length of ${maxLength} characters`);
  }
  
  // Remove potentially dangerous characters
  return input.replace(/[<>'"]/g, '');
};

export const sanitizeCoordinates = (lat: number, lng: number): { lat: number; lng: number } => {
  // Validate latitude (-90 to 90)
  if (typeof lat !== 'number' || lat < -90 || lat > 90) {
    throw new Error('Invalid latitude: must be a number between -90 and 90');
  }
  
  // Validate longitude (-180 to 180)
  if (typeof lng !== 'number' || lng < -180 || lng > 180) {
    throw new Error('Invalid longitude: must be a number between -180 and 180');
  }
  
  return { lat: Number(lat.toFixed(6)), lng: Number(lng.toFixed(6)) };
};