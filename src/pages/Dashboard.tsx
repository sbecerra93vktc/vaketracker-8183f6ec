import { useAuth } from '@/hooks/useAuth';
import { usePermissions } from '@/hooks/usePermissions';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import GoogleMapComponent from '@/components/GoogleMapComponent';
import LocationCapture from '@/components/LocationCapture';
import LocationHistory from '@/components/LocationHistory';
import ActivitySummary from '@/components/ActivitySummary';
import ActivityChart from '@/components/ActivityChart';
import { useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { User, Edit, Save, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

const Dashboard = () => {
  const { user, userRole, signOut } = useAuth();
  const { hasPermission } = usePermissions(user, userRole);
  const navigate = useNavigate();
  const { toast } = useToast();

  // Profile dialog state
  const [profileDialogOpen, setProfileDialogOpen] = useState(false);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileData, setProfileData] = useState({
    first_name: '',
    last_name: '',
    phone: '',
    company: '',
    territory: '',
    country: ''
  });

  const refreshData = () => {
    // This function can be called to refresh location data
    window.location.reload();
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth');
  };

  // Load user profile data
  useEffect(() => {
    if (user && profileDialogOpen) {
      loadProfileData();
    }
  }, [user, profileDialogOpen]);

  const loadProfileData = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('first_name, last_name, phone, company, territory, country')
        .eq('user_id', user.id)
        .single();

      if (error && error.code !== 'PGRST116') { // PGRST116 is "not found"
        console.error('Error loading profile:', error);
        return;
      }

      if (data) {
        setProfileData({
          first_name: data.first_name || '',
          last_name: data.last_name || '',
          phone: data.phone || '',
          company: data.company || '',
          territory: data.territory || '',
          country: data.country || ''
        });
      }
    } catch (error) {
      console.error('Error loading profile:', error);
    }
  };

  const handleProfileUpdate = async () => {
    if (!user) return;

    setProfileLoading(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .upsert({
          user_id: user.id,
          email: user.email,
          first_name: profileData.first_name.trim() || null,
          last_name: profileData.last_name.trim() || null,
          phone: profileData.phone.trim() || null,
          company: profileData.company.trim() || null,
          territory: profileData.territory.trim() || null,
          country: profileData.country.trim() || null
        }, {
          onConflict: 'user_id'
        });

      if (error) {
        console.error('Error updating profile:', error);
        toast({
          variant: 'destructive',
          title: 'Error al actualizar perfil',
          description: `Error: ${error.message || 'No se pudo actualizar el perfil. Intenta de nuevo.'}`,
        });
        return;
      }

      toast({
        title: 'Perfil actualizado',
        description: 'Tu perfil ha sido actualizado correctamente.',
      });

      setProfileDialogOpen(false);
    } catch (error) {
      console.error('Unexpected error updating profile:', error);
      toast({
        variant: 'destructive',
        title: 'Error inesperado',
        description: 'Ocurrió un error al actualizar el perfil.',
      });
    } finally {
      setProfileLoading(false);
    }
  };

  const handleProfileInputChange = (field: string, value: string) => {
    setProfileData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container mx-auto px-2 sm:px-4 py-3 sm:py-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-4">
          <h1 className="text-xl sm:text-2xl font-bold text-warning">Vaketracker</h1>
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-4 w-full sm:w-auto">
            <span className="text-xs sm:text-sm text-muted-foreground truncate">
              Welcome, {user?.email}
            </span>
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary text-primary-foreground">
              {userRole}
            </span>
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => setProfileDialogOpen(true)} 
                className="text-xs flex items-center gap-1"
              >
                <User className="h-3 w-3" />
                <span className="hidden sm:inline">Perfil</span>
              </Button>
              {userRole === 'admin' && (
                <Button variant="outline" size="sm" onClick={() => navigate('/admin')} className="text-xs">
                  Admin Panel
                </Button>
              )}
              <Button variant="outline" size="sm" onClick={handleSignOut} className="text-xs">
                Sign Out
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto p-3 sm:p-6">
        <div className="space-y-6 mb-6">
          <LocationCapture onLocationCaptured={refreshData} />
          <ActivitySummary />
          <LocationHistory />
        </div>

        <div className="space-y-8">
          <Card>
            <CardHeader>
              <CardTitle>
                {hasPermission('view_team_locations') ? 'Mapa del Territorio del Equipo' : 'Mapa de Mi Territorio'}
              </CardTitle>
              <CardDescription>
                {hasPermission('view_team_locations') 
                  ? 'Visualiza el territorio de ventas y ubicaciones de clientes del equipo'
                  : 'Visualiza tu territorio de ventas y ubicaciones de clientes'
                }
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <GoogleMapComponent />
            </CardContent>
          </Card>

          {hasPermission('view_team_locations') && (
            <ActivityChart />
          )}
        </div>
      </main>

      {/* Profile Edit Dialog */}
      <Dialog open={profileDialogOpen} onOpenChange={setProfileDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <User className="h-5 w-5 text-primary" />
              Editar Perfil
            </DialogTitle>
            <DialogDescription>
              Actualiza tu información personal y profesional. Los cambios se guardarán en tu perfil.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-6 py-4">
            {/* Personal Information */}
            <div className="space-y-4">
              <h4 className="text-sm font-semibold text-foreground border-b pb-2">Información Personal</h4>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="first-name">Nombre *</Label>
                  <Input
                    id="first-name"
                    value={profileData.first_name}
                    onChange={(e) => handleProfileInputChange('first_name', e.target.value)}
                    placeholder="Tu nombre"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="last-name">Apellido *</Label>
                  <Input
                    id="last-name"
                    value={profileData.last_name}
                    onChange={(e) => handleProfileInputChange('last_name', e.target.value)}
                    placeholder="Tu apellido"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="phone">Teléfono</Label>
                  <Input
                    id="phone"
                    type="tel"
                    value={profileData.phone}
                    onChange={(e) => handleProfileInputChange('phone', e.target.value)}
                    placeholder="+1234567890"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={user?.email || ''}
                    disabled
                    className="bg-muted"
                  />
                  <p className="text-xs text-muted-foreground">El email no se puede cambiar</p>
                </div>
              </div>
            </div>

            {/* Professional Information */}
            <div className="space-y-4">
              <h4 className="text-sm font-semibold text-foreground border-b pb-2">Información Profesional</h4>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="company">Empresa</Label>
                  <Input
                    id="company"
                    value={profileData.company}
                    onChange={(e) => handleProfileInputChange('company', e.target.value)}
                    placeholder="Nombre de tu empresa"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="territory">Territorio</Label>
                  <Input
                    id="territory"
                    value={profileData.territory}
                    onChange={(e) => handleProfileInputChange('territory', e.target.value)}
                    placeholder="Tu territorio de ventas"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="country">País</Label>
                  <Input
                    id="country"
                    value={profileData.country}
                    onChange={(e) => handleProfileInputChange('country', e.target.value)}
                    placeholder="Tu país"
                  />
                </div>
              </div>
            </div>

            {/* Account Information */}
            <div className="space-y-4">
              <h4 className="text-sm font-semibold text-foreground border-b pb-2">Información de Cuenta</h4>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="role">Rol</Label>
                  <Input
                    id="role"
                    value={userRole}
                    disabled
                    className="bg-muted"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="user-id">ID de Usuario</Label>
                  <Input
                    id="user-id"
                    value={user?.id || ''}
                    disabled
                    className="bg-muted font-mono text-xs"
                  />
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setProfileDialogOpen(false)}
              disabled={profileLoading}
            >
              <X className="h-4 w-4 mr-2" />
              Cancelar
            </Button>
            <Button 
              onClick={handleProfileUpdate} 
              disabled={profileLoading || !profileData.first_name.trim() || !profileData.last_name.trim()}
              className="bg-primary hover:bg-primary/90"
            >
              {profileLoading ? (
                <>
                  <div className="h-4 w-4 mr-2 animate-spin rounded-full border-2 border-background border-t-transparent" />
                  Guardando...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Guardar Cambios
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Dashboard;