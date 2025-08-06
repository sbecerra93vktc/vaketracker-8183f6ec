import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface Permission {
  permission_name: string;
  enabled: boolean;
}

export const usePermissions = (user: any, userRole: string | null) => {
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchPermissions();
    } else {
      setLoading(false);
    }
  }, [user]);

  const fetchPermissions = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('user_permissions')
        .select('permission_name, enabled')
        .eq('user_id', user.id);

      if (error) {
        console.error('Error fetching permissions:', error);
      } else {
        setPermissions(data || []);
      }
    } catch (error) {
      console.error('Error fetching permissions:', error);
    } finally {
      setLoading(false);
    }
  };

  const hasPermission = (permissionName: string): boolean => {
    // Admin users have all permissions
    if (userRole === 'admin') return true;
    
    const permission = permissions.find(p => p.permission_name === permissionName);
    return permission?.enabled || false;
  };

  return {
    permissions,
    loading,
    hasPermission,
    refetch: fetchPermissions
  };
};