import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

interface Invitation {
  id: string;
  email: string;
  token: string;
  used: boolean;
  expires_at: string;
  created_at: string;
}

interface Profile {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  company: string;
  territory: string;
  phone: string;
  role?: string;
  user_id: string;
}

interface Permission {
  id: string;
  user_id: string;
  permission_name: string;
  enabled: boolean;
}

interface UserPermissions {
  user_id: string;
  user_name: string;
  user_email: string;
  role: string;
  permissions: Permission[];
}

const Admin = () => {
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [userPermissions, setUserPermissions] = useState<UserPermissions[]>([]);
  const [loading, setLoading] = useState(false);
  const [permissionsLoading, setPermissionsLoading] = useState(false);
  const { toast } = useToast();
  const { userRole } = useAuth();

  const availablePermissions = [
    { name: 'view_team_locations', label: 'Ver ubicaciones del equipo' },
    { name: 'view_team_activities', label: 'Ver actividades del equipo' },
    { name: 'access_admin_panel', label: 'Acceder al panel de admin' },
    { name: 'manage_users', label: 'Gestionar usuarios' },
    { name: 'view_analytics', label: 'Ver analíticas' }
  ];

  useEffect(() => {
    if (userRole === 'admin') {
      fetchInvitations();
      fetchProfiles();
      fetchUserPermissions();
    }
  }, [userRole]);

  const fetchInvitations = async () => {
    const { data, error } = await supabase
      .from('invitations')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      toast({
        variant: 'destructive',
        title: 'Error fetching invitations',
        description: error.message,
      });
    } else {
      setInvitations(data || []);
    }
  };

  const fetchProfiles = async () => {
    const { data: profilesData, error: profilesError } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false });

    if (profilesError) {
      toast({
        variant: 'destructive',
        title: 'Error fetching profiles',
        description: profilesError.message,
      });
      return;
    }

    // Fetch roles separately
    const { data: rolesData, error: rolesError } = await supabase
      .from('user_roles')
      .select('user_id, role');

    if (rolesError) {
      toast({
        variant: 'destructive',
        title: 'Error fetching roles',
        description: rolesError.message,
      });
      return;
    }

    // Combine profiles with roles
    const profilesWithRoles = profilesData?.map(profile => ({
      ...profile,
      role: rolesData?.find(role => role.user_id === profile.user_id)?.role || 'Unknown'
    })) || [];

    setProfiles(profilesWithRoles);
  };

  const fetchUserPermissions = async () => {
    setPermissionsLoading(true);
    try {
      // Fetch all profiles
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('user_id, first_name, last_name, email')
        .order('first_name', { ascending: true });

      if (profilesError) {
        toast({
          variant: 'destructive',
          title: 'Error fetching profiles',
          description: profilesError.message,
        });
        return;
      }

      // Fetch roles
      const { data: rolesData, error: rolesError } = await supabase
        .from('user_roles')
        .select('user_id, role');

      if (rolesError) {
        toast({
          variant: 'destructive',
          title: 'Error fetching roles',
          description: rolesError.message,
        });
        return;
      }

      // Fetch permissions
      const { data: permissionsData, error: permissionsError } = await supabase
        .from('user_permissions')
        .select('*');

      if (permissionsError) {
        toast({
          variant: 'destructive',
          title: 'Error fetching permissions',
          description: permissionsError.message,
        });
        return;
      }

      // Combine data
      const userPermissionsData: UserPermissions[] = profilesData?.map(profile => {
        const role = rolesData?.find(r => r.user_id === profile.user_id);
        const permissions = permissionsData?.filter(p => p.user_id === profile.user_id) || [];
        
        return {
          user_id: profile.user_id,
          user_name: `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || 'Usuario sin nombre',
          user_email: profile.email,
          role: role?.role || 'Unknown',
          permissions
        };
      }) || [];

      setUserPermissions(userPermissionsData);
    } catch (error) {
      console.error('Error fetching user permissions:', error);
    } finally {
      setPermissionsLoading(false);
    }
  };

  const updatePermission = async (userId: string, permissionName: string, enabled: boolean) => {
    try {
      const { error } = await supabase
        .from('user_permissions')
        .upsert({
          user_id: userId,
          permission_name: permissionName,
          enabled
        });

      if (error) {
        toast({
          variant: 'destructive',
          title: 'Error updating permission',
          description: error.message,
        });
      } else {
        toast({
          title: 'Permission updated',
          description: 'User permissions have been updated successfully.',
        });
        fetchUserPermissions(); // Refresh data
      }
    } catch (error) {
      console.error('Error updating permission:', error);
    }
  };

  const handleInviteUser = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    
    const formData = new FormData(e.currentTarget);
    const email = formData.get('email') as string;
    
    // Generate a random token
    const token = crypto.randomUUID();
    
    const { error } = await supabase
      .from('invitations')
      .insert({
        email,
        token,
        invited_by: (await supabase.auth.getUser()).data.user?.id,
      });

    if (error) {
      toast({
        variant: 'destructive',
        title: 'Error sending invitation',
        description: error.message,
      });
    } else {
      toast({
        title: 'Invitation created!',
        description: `Share this token: ${token}`,
      });
      
      // Show detailed token info
      setTimeout(() => {
        toast({
          title: 'Invitation Token',
          description: `Email: ${email}\nToken: ${token}\n\nShare this token with the user to register.`,
        });
      }, 1000);
      
      fetchInvitations();
      (e.target as HTMLFormElement).reset();
    }
    setLoading(false);
  };

  if (userRole !== 'admin') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card>
          <CardContent className="pt-6">
            <p className="text-center text-muted-foreground">
              Access denied. Admin privileges required.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Panel de Administración</h1>
      </div>

      <Tabs defaultValue="invitations" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="invitations">Invitaciones</TabsTrigger>
          <TabsTrigger value="users">Usuarios</TabsTrigger>
          <TabsTrigger value="permissions">Permisos</TabsTrigger>
        </TabsList>

        <TabsContent value="invitations" className="space-y-6">

        <Card>
          <CardHeader>
            <CardTitle>Invitar Nuevo Usuario</CardTitle>
            <CardDescription>
              Envía una invitación a un nuevo vendedor. Recibirán un token para registrarse.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleInviteUser} className="flex gap-4">
              <div className="flex-1">
                <Label htmlFor="email" className="sr-only">Email</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  placeholder="Ingresa dirección de email"
                  required
                />
              </div>
              <Button type="submit" disabled={loading}>
                {loading ? 'Enviando...' : 'Enviar Invitación'}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Invitaciones Pendientes</CardTitle>
            <CardDescription>
              Invitaciones que no han sido utilizadas aún
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Token</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Expira</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invitations.map((invitation) => (
                  <TableRow key={invitation.id}>
                    <TableCell>{invitation.email}</TableCell>
                    <TableCell>
                      <code className="bg-muted px-2 py-1 rounded text-xs font-mono">
                        {invitation.token}
                      </code>
                    </TableCell>
                    <TableCell>
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        invitation.used 
                          ? 'bg-green-100 text-green-800' 
                          : new Date(invitation.expires_at) < new Date()
                          ? 'bg-red-100 text-red-800'
                          : 'bg-yellow-100 text-yellow-800'
                      }`}>
                        {invitation.used 
                          ? 'Usado' 
                          : new Date(invitation.expires_at) < new Date()
                          ? 'Expirado'
                          : 'Pendiente'
                        }
                      </span>
                    </TableCell>
                    <TableCell>
                      {new Date(invitation.expires_at).toLocaleDateString()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        </TabsContent>

        <TabsContent value="users" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Usuarios Registrados</CardTitle>
              <CardDescription>
                Todos los vendedores registrados en el sistema
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nombre</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Rol</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {profiles.map((profile) => (
                    <TableRow key={profile.id}>
                      <TableCell>
                        {profile.first_name} {profile.last_name}
                      </TableCell>
                      <TableCell>{profile.email}</TableCell>
                      <TableCell>
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary/20 text-primary">
                          {profile.role || 'Unknown'}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="permissions" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Configuración de Permisos</CardTitle>
              <CardDescription>
                Configura qué secciones de la aplicación puede ver cada usuario
              </CardDescription>
            </CardHeader>
            <CardContent>
              {permissionsLoading ? (
                <div className="text-center py-8">Cargando permisos...</div>
              ) : (
                <div className="space-y-6">
                  {userPermissions.map((user) => (
                    <div key={user.user_id} className="border rounded-lg p-4 space-y-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="text-lg font-semibold">{user.user_name}</h3>
                          <p className="text-sm text-muted-foreground">{user.user_email}</p>
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-primary/20 text-primary">
                            {user.role}
                          </span>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {availablePermissions.map((permission) => {
                          const userPerm = user.permissions.find(p => p.permission_name === permission.name);
                          const isEnabled = userPerm?.enabled || false;
                          
                          return (
                            <div key={permission.name} className="flex items-center justify-between p-3 border rounded">
                              <div>
                                <Label htmlFor={`${user.user_id}-${permission.name}`} className="text-sm font-medium">
                                  {permission.label}
                                </Label>
                              </div>
                              <Switch
                                id={`${user.user_id}-${permission.name}`}
                                checked={isEnabled}
                                onCheckedChange={(enabled) => updatePermission(user.user_id, permission.name, enabled)}
                              />
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Admin;