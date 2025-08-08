import React, { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { MapPin, Clock, User, ArrowLeft } from 'lucide-react';
import TrackingMapComponent from '@/components/TrackingMapComponent';
import LocationTracker from '@/components/LocationTracker';

interface TrackingData {
  id: string;
  user_id: string;
  latitude: number;
  longitude: number;
  address: string;
  country: string;
  state: string;
  created_at: string;
  user_email?: string;
}

const TrackHistory = () => {
  const { user, userRole, signOut } = useAuth();
  const navigate = useNavigate();
  const [trackingData, setTrackingData] = useState<TrackingData[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string>('all');
  const [users, setUsers] = useState<Array<{id: string, email: string}>>([]);
  const [loading, setLoading] = useState(true);
  const [selectedLocationId, setSelectedLocationId] = useState<string | null>(null);

  useEffect(() => {
    fetchUsers();
  }, [userRole, user?.id]);

  useEffect(() => {
    if (users.length > 0) {
      fetchTrackingData();
    }
  }, [selectedUserId, users]);

  const fetchUsers = async () => {
    try {
      // Get all unique user IDs from location tracking
      const { data: trackingUsers, error: trackingError } = await supabase
        .from('location_tracking')
        .select('user_id');

      if (trackingError) throw trackingError;

      const uniqueUserIds = [...new Set(trackingUsers?.map(u => u.user_id) || [])];
      
      // Get user emails from auth.users via profiles or construct from tracking data
      const { data: profilesData } = await supabase
        .from('profiles')
        .select('user_id, email')
        .in('user_id', uniqueUserIds);

      const mappedUsers = (profilesData || []).map(profile => ({
        id: profile.user_id,
        email: profile.email || `User ${profile.user_id.slice(0, 8)}`
      }));

      // For any users not in profiles, add them with a fallback email
      uniqueUserIds.forEach(userId => {
        if (!mappedUsers.find(u => u.id === userId)) {
          mappedUsers.push({
            id: userId,
            email: `User ${userId.slice(0, 8)}`
          });
        }
      });

      setUsers(mappedUsers);

      // Set current user as selected if not admin
      if (userRole !== 'admin') {
        setSelectedUserId(user?.id || 'all');
      }
    } catch (error) {
      console.error('Error fetching users:', error);
    }
  };

  const fetchTrackingData = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('location_tracking')
        .select('*')
        .order('created_at', { ascending: false });

      if (selectedUserId !== 'all') {
        query = query.eq('user_id', selectedUserId);
      }

      const { data, error } = await query;

      if (error) throw error;

      // Add user email to tracking data
      const dataWithEmails = (data || []).map((item) => {
        const user = users.find(u => u.id === item.user_id);
        return {
          ...item,
          user_email: user?.email || `User ${item.user_id.slice(0, 8)}`
        };
      });

      setTrackingData(dataWithEmails);
    } catch (error) {
      console.error('Error fetching tracking data:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('es-ES', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth');
  };

  const handleLocationClick = (locationId: string) => {
    setSelectedLocationId(selectedLocationId === locationId ? null : locationId);
  };

  // Show appropriate content based on user role
  const shouldShowAllUsers = userRole === 'admin';
  const filteredTrackingData = shouldShowAllUsers 
    ? trackingData 
    : trackingData.filter(location => location.user_id === user?.id);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <Button variant="outline" size="sm" onClick={() => navigate('/dashboard')}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Dashboard
            </Button>
            <h1 className="text-2xl font-bold text-warning">Track History</h1>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-muted-foreground">
              Welcome, {user?.email}
            </span>
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary text-primary-foreground">
              {userRole}
            </span>
            <Button variant="outline" onClick={handleSignOut}>
              Sign Out
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto p-6">
        <div className="space-y-6">
          {/* Location Tracker Component */}
          <LocationTracker />

          {/* User Filter - only show for admins */}
          {userRole === 'admin' && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="h-5 w-5 text-warning" />
                  Filtrar por Usuario
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Seleccionar usuario" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos los usuarios</SelectItem>
                    {users.map((user) => (
                      <SelectItem key={user.id} value={user.id}>
                        {user.email}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </CardContent>
            </Card>
          )}

          {/* Location Selection Dropdown */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MapPin className="h-5 w-5 text-warning" />
                Seleccionar Ubicación
              </CardTitle>
              <CardDescription>
                Elige una ubicación específica para visualizar en el mapa
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Select value={selectedLocationId || "none"} onValueChange={(value) => setSelectedLocationId(value === "none" ? null : value)}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Seleccionar una ubicación..." />
                </SelectTrigger>
                <SelectContent className="bg-popover border z-50">
                  <SelectItem value="none">Ninguna ubicación seleccionada</SelectItem>
                  {filteredTrackingData.map((location) => (
                    <SelectItem key={location.id} value={location.id}>
                      <div className="flex flex-col items-start">
                        <span className="font-medium">{location.address || 'Ubicación automática'}</span>
                        <span className="text-xs text-muted-foreground">
                          {location.user_email} - {formatDate(location.created_at)}
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>

          {/* Tracking Map */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MapPin className="h-5 w-5 text-warning" />
                Mapa de Seguimiento
              </CardTitle>
              <CardDescription>
                {selectedLocationId 
                  ? "Ubicación seleccionada mostrada en el mapa" 
                  : "Selecciona una ubicación arriba para centrar el mapa"
                }
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {filteredTrackingData.length === 0 ? (
                <div className="h-96 flex items-center justify-center bg-muted/50 rounded-lg">
                  <p className="text-muted-foreground">No hay ubicaciones disponibles</p>
                </div>
              ) : !selectedLocationId ? (
                <div className="h-96 flex items-center justify-center bg-muted/50 rounded-lg">
                  <p className="text-muted-foreground">Selecciona una ubicación para mostrar en el mapa</p>
                </div>
              ) : (
                <TrackingMapComponent trackingData={filteredTrackingData} selectedLocationId={selectedLocationId} />
              )}
            </CardContent>
          </Card>

          {/* Tracking History List */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-warning" />
                Historial de Ubicaciones
              </CardTitle>
              <CardDescription>
                Lista cronológica de todas las ubicaciones rastreadas
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-warning mx-auto"></div>
                  <p className="mt-2 text-muted-foreground">Cargando datos...</p>
                </div>
              ) : filteredTrackingData.length === 0 ? (
                <div className="text-center py-8">
                  <MapPin className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">No hay datos de seguimiento disponibles</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {filteredTrackingData.map((item) => (
                     <div
                       key={item.id}
                       className={`flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors cursor-pointer ${
                         selectedLocationId === item.id ? 'bg-primary/10 border-primary' : ''
                       }`}
                       onClick={() => handleLocationClick(item.id)}
                     >
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <Badge variant="outline">{item.user_email}</Badge>
                          <span className="text-sm text-muted-foreground">
                            {formatDate(item.created_at)}
                          </span>
                        </div>
                        <p className="text-sm font-medium">{item.address || 'Ubicación automática'}</p>
                        {(item.country || item.state) && (
                          <p className="text-xs text-muted-foreground">
                            {item.country}{item.state ? ` - ${item.state}` : ''}
                          </p>
                        )}
                        {!item.country && !item.state && (
                          <p className="text-xs text-muted-foreground mt-1">
                            {item.latitude.toFixed(6)}, {item.longitude.toFixed(6)}
                          </p>
                        )}
                      </div>
                      <MapPin className="h-5 w-5 text-warning" />
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
};

export default TrackHistory;