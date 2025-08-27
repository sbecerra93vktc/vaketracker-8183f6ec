import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
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
  avatar_url?: string;
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
  avatar_url?: string;
  role: string;
  permissions: Permission[];
}

const Admin = () => {
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [userPermissions, setUserPermissions] = useState<UserPermissions[]>([]);
  const [validatedInvitations, setValidatedInvitations] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [permissionsLoading, setPermissionsLoading] = useState(false);
  const [validatedLoading, setValidatedLoading] = useState(false);
  const { toast } = useToast();
  const { userRole } = useAuth();

  const availablePermissions = [
    { name: 'view_team_locations', label: 'Ver actividades del equipo' },
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
      fetchValidatedInvitations();
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
        .select('user_id, first_name, last_name, email, avatar_url')
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
          avatar_url: profile.avatar_url,
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
        // Log the security event
        await supabase
          .from('admin_action_logs')
          .insert({
            user_id: (await supabase.auth.getUser()).data.user?.id,
            action_type: 'permission_updated',
            action_details: { 
              target_user_id: userId, 
              permission_name: permissionName, 
              enabled 
            },
            user_agent: navigator.userAgent
          });
          
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

  const fetchValidatedInvitations = async () => {
    setValidatedLoading(true);
    try {
      // Fetch used invitations
      const { data: usedInvitations, error: invitationsError } = await supabase
        .from('invitations')
        .select('*')
        .eq('used', true)
        .order('created_at', { ascending: false });

      if (invitationsError) {
        toast({
          variant: 'destructive',
          title: 'Error fetching validated invitations',
          description: invitationsError.message,
        });
        return;
      }

      // For each used invitation, try to find the corresponding user profile
      const validatedData = [];
      
      if (usedInvitations && usedInvitations.length > 0) {
        for (const invitation of usedInvitations) {
          // Find user profile by email
          const { data: profileData } = await supabase
            .from('profiles')
            .select('*')
            .eq('email', invitation.email)
            .maybeSingle();

          let userRole = 'Sin rol';
          
          if (profileData) {
            // Fetch the user's role separately
            const { data: roleData } = await supabase
              .from('user_roles')
              .select('role')
              .eq('user_id', profileData.user_id)
              .maybeSingle();
            
            userRole = roleData?.role || 'Sin rol';
          }

          validatedData.push({
            ...invitation,
            user_profile: profileData,
            user_name: profileData 
              ? `${profileData.first_name || ''} ${profileData.last_name || ''}`.trim() || 'Sin nombre'
              : 'Usuario no encontrado',
            user_role: userRole
          });
        }
      }

      setValidatedInvitations(validatedData);
    } catch (error) {
      console.error('Error fetching validated invitations:', error);
    } finally {
      setValidatedLoading(false);
    }
  };

  const handleInviteUser = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    
    const formData = new FormData(e.currentTarget);
    const email = formData.get('email') as string;
    
    try {
      // Rate limiting check - only allow 5 invitations per hour per admin
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      const { data: recentInvitations } = await supabase
        .from('admin_action_logs')
        .select('id')
        .eq('action_type', 'invitation_created')
        .gte('created_at', oneHourAgo);
      
      if (recentInvitations && recentInvitations.length >= 5) {
        toast({
          variant: 'destructive',
          title: 'Rate limit exceeded',
          description: 'Maximum 5 invitations per hour allowed. Please try again later.',
        });
        setLoading(false);
        return;
      }
      
      // Generate a random token
      const token = crypto.randomUUID();
      
      const { error } = await supabase
        .from('invitations')
        .insert({
          email,
          token,
          invited_by: (await supabase.auth.getUser()).data.user?.id,
        });

      if (error) throw error;
      
      // Build registration link and send email via Edge Function
      const appBaseUrl = import.meta.env.VITE_APP_BASE_URL || window.location.origin;
      const registerLink = `${appBaseUrl}/auth?token=${encodeURIComponent(token)}`;
      try {
        const { error: sendError } = await supabase.functions.invoke('send-invite-email', {
          body: {
            to: email,
            token,
            link: registerLink,
          },
        });
        if (sendError) {
          console.error('Email send error:', sendError);
          toast({
            variant: 'destructive',
            title: 'No se pudo enviar el email',
            description: 'La invitación fue creada, pero el correo falló. Copia el token manualmente.',
          });
        } else {
          toast({
            title: 'Invitación enviada',
            description: `Se envió un email a ${email} con el token y el enlace de registro.`,
          });
        }
      } catch (sendErr: any) {
        console.error('Email send exception:', sendErr);
        toast({
          variant: 'destructive',
          title: 'Error enviando correo',
          description: 'La invitación fue creada, pero no se pudo enviar el correo.',
        });
      }

      // Log the security event
      await supabase
        .from('admin_action_logs')
        .insert({
          user_id: (await supabase.auth.getUser()).data.user?.id,
          action_type: 'invitation_created',
          action_details: { email, token_id: token },
          user_agent: navigator.userAgent
        });

      toast({
        title: 'Invitation created!',
        description: `Share this token: ${token}`,
      });
      
      // Show detailed token info
      setTimeout(() => {
        toast({
          title: 'Invitation Token',
          description: `Email: ${email}\nToken: ${token}\nLink: ${registerLink}\n\nShare this token or the link with the user to register.`,
        });
      }, 1000);
      
      fetchInvitations();
      (e.target as HTMLFormElement).reset();
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error sending invitation',
        description: error.message,
      });
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
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="invitations">Invitaciones</TabsTrigger>
          <TabsTrigger value="validated">Validadas</TabsTrigger>
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

        <TabsContent value="validated" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Invitaciones Validadas</CardTitle>
              <CardDescription>
                Usuarios que han usado exitosamente su invitación y están registrados
              </CardDescription>
            </CardHeader>
            <CardContent>
              {validatedLoading ? (
                <div className="text-center py-8">Cargando invitaciones validadas...</div>
              ) : validatedInvitations.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No hay invitaciones validadas aún
                </div>
              ) : (
                <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Usuario</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Rol</TableHead>
                    <TableHead>Fecha de Invitación</TableHead>
                    <TableHead>Estado</TableHead>
                  </TableRow>
                </TableHeader>
                  <TableBody>
                    {validatedInvitations.map((invitation) => (
                      <TableRow key={invitation.id}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <Avatar>
                              <AvatarImage src={invitation.user_profile?.avatar_url} />
                              <AvatarFallback>
                                {invitation.user_name?.split(' ').map(n => n[0]).join('').toUpperCase() || '??'}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex flex-col">
                              <span className="font-medium">{invitation.user_name}</span>
                              {invitation.user_profile && (
                                <span className="text-xs text-muted-foreground">
                                  {invitation.user_profile.company && `${invitation.user_profile.company} • `}
                                  {invitation.user_profile.territory || 'Sin territorio'}
                                </span>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>{invitation.email}</TableCell>
                        <TableCell>
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                            {invitation.user_role}
                          </span>
                        </TableCell>
                        <TableCell>
                          {new Date(invitation.created_at).toLocaleDateString()}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                              ✓ Activo
                            </span>
                            {invitation.user_profile && (
                              <span className="text-xs text-muted-foreground">
                                Registrado
                              </span>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
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
                    <TableHead>Usuario</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Rol</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {profiles.map((profile) => (
                    <TableRow key={profile.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar>
                            <AvatarImage src={profile.avatar_url} />
                            <AvatarFallback>
                              {`${profile.first_name?.[0] || ''}${profile.last_name?.[0] || ''}`.toUpperCase() || '??'}
                            </AvatarFallback>
                          </Avatar>
                          <span>{profile.first_name} {profile.last_name}</span>
                        </div>
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
                        <div className="flex items-center gap-3">
                          <Avatar>
                            <AvatarImage src={user.avatar_url} />
                            <AvatarFallback>
                              {user.user_name?.split(' ').map(n => n[0]).join('').toUpperCase() || '??'}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <h3 className="text-lg font-semibold">{user.user_name}</h3>
                            <p className="text-sm text-muted-foreground">{user.user_email}</p>
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-primary/20 text-primary">
                              {user.role}
                            </span>
                          </div>
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