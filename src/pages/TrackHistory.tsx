import React, { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Badge } from '@/components/ui/badge';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { MapPin, Clock, User, ArrowLeft, CalendarIcon } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
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
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [mapCenter, setMapCenter] = useState<{lat: number, lng: number, id: string} | null>(null);

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

      console.log(`[TrackHistory] Raw data from database:`, data?.length || 0, 'locations');

      // Filter out locations with invalid coordinates or missing essential data
      const validData = (data || []).filter(item => {
        const hasValidCoords = item.latitude && item.longitude && 
                              !isNaN(Number(item.latitude)) && !isNaN(Number(item.longitude));
        if (!hasValidCoords) {
          console.warn('[TrackHistory] Filtering out invalid location:', item);
        }
        return hasValidCoords;
      });

      console.log(`[TrackHistory] Valid locations after filtering:`, validData.length);

      // Add user email to tracking data
      const dataWithEmails = validData.map((item) => {
        const user = users.find(u => u.id === item.user_id);
        return {
          ...item,
          user_email: user?.email || `User ${item.user_id.slice(0, 8)}`,
          // Provide fallback for empty addresses
          address: item.address || 'Ubicación automática'
        };
      });

      console.log(`[TrackHistory] Final processed data:`, dataWithEmails.length, 'locations');
      console.log(`[TrackHistory] Data breakdown by address type:`, {
        withAddress: dataWithEmails.filter(d => d.address && d.address !== 'Ubicación automática').length,
        autoLocation: dataWithEmails.filter(d => !d.address || d.address === 'Ubicación automática').length
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

  const handleLocationClick = (location: TrackingData) => {
    console.log('[TrackHistory] Location clicked:', location);
    console.log('[TrackHistory] Setting map center to:', {
      lat: location.latitude,
      lng: location.longitude,
      id: location.id
    });
    setMapCenter({
      lat: location.latitude,
      lng: location.longitude,
      id: location.id
    });
  };

  // Show appropriate content based on user role and date filter
  const shouldShowAllUsers = userRole === 'admin';
  let filteredTrackingData = shouldShowAllUsers 
    ? trackingData 
    : trackingData.filter(location => location.user_id === user?.id);

  // Apply date filter if selected
  if (selectedDate) {
    const selectedDateStr = format(selectedDate, 'yyyy-MM-dd');
    filteredTrackingData = filteredTrackingData.filter(location => {
      const locationDateStr = format(new Date(location.created_at), 'yyyy-MM-dd');
      return locationDateStr === selectedDateStr;
    });
  }

  console.log(`[TrackHistory] Filtered data for display:`, filteredTrackingData.length, 'locations');
  console.log(`[TrackHistory] Date filter:`, selectedDate ? format(selectedDate, 'yyyy-MM-dd') : 'All dates');
  console.log(`[TrackHistory] User role: ${userRole}, showing all users: ${shouldShowAllUsers}`);

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


          {/* Tracking Map */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MapPin className="h-5 w-5 text-warning" />
                Mapa de Seguimiento
              </CardTitle>
              <CardDescription>
                {filteredTrackingData.length > 0 
                  ? `Mostrando ${filteredTrackingData.length} ubicaciones${selectedDate ? ` del ${format(selectedDate, 'dd/MM/yyyy')}` : ''}`
                  : "No hay ubicaciones para mostrar"
                }
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {filteredTrackingData.length === 0 ? (
                <div className="h-96 flex items-center justify-center bg-muted/50 rounded-lg">
                  <p className="text-muted-foreground">
                    {selectedDate 
                      ? `No hay ubicaciones para el ${format(selectedDate, 'dd/MM/yyyy')}`
                      : "No hay ubicaciones disponibles"
                    }
                  </p>
                </div>
              ) : (
                <TrackingMapComponent trackingData={filteredTrackingData} mapCenter={mapCenter} />
              )}
            </CardContent>
          </Card>

              {/* Tracking History List */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-warning" />
                Historial de Ubicaciones
                <Badge variant="secondary" className="ml-auto">
                  {filteredTrackingData.length}
                </Badge>
              </CardTitle>
              <CardDescription>
                Haz clic en una ubicación para centrarla en el mapa
                {selectedDate && ` - Filtrando por ${format(selectedDate, 'dd/MM/yyyy')}`}
              </CardDescription>
              
              {/* Date Filter within Location History */}
              <div className="flex gap-4 items-end mt-4 pt-4 border-t">
                <div className="flex-1">
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !selectedDate && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {selectedDate ? format(selectedDate, "PPP") : "Seleccionar fecha"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={selectedDate || undefined}
                        onSelect={(date) => setSelectedDate(date || null)}
                        initialFocus
                        className="pointer-events-auto"
                      />
                    </PopoverContent>
                  </Popover>
                </div>
                {selectedDate && (
                  <Button 
                    variant="outline" 
                    onClick={() => setSelectedDate(null)}
                    className="shrink-0"
                  >
                    Limpiar
                  </Button>
                )}
              </div>
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
                         mapCenter?.id === item.id ? 'bg-primary/10 border-primary' : ''
                       }`}
                       onClick={() => handleLocationClick(item)}
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