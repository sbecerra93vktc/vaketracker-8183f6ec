import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { MapPin, Clock, User, Filter, Calendar, Globe } from 'lucide-react';

interface Location {
  id: string;
  latitude: number;
  longitude: number;
  address: string;
  notes: string;
  visit_type: string;
  created_at: string;
  country?: string;
  state?: string;
  user_name?: string;
  user_email?: string;
  user_id: string;
}

const LocationHistory = () => {
  const [locations, setLocations] = useState<Location[]>([]);
  const [filteredLocations, setFilteredLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState<string>('all');
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [selectedCountry, setSelectedCountry] = useState<string>('all');
  const [selectedState, setSelectedState] = useState<string>('all');
  const [showFilters, setShowFilters] = useState(false);
  const { userRole } = useAuth();

  useEffect(() => {
    fetchLocations();
  }, [userRole]);

  useEffect(() => {
    applyFilters();
  }, [locations, selectedUser, selectedDate, selectedCountry, selectedState]);

  const fetchLocations = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      let query = supabase
        .from('locations')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      // If not admin, only show own locations
      if (userRole !== 'admin') {
        query = query.eq('user_id', user.id);
      }

      const { data: locationsData, error: locationsError } = await query;

      if (locationsError) {
        console.error('Error fetching locations:', locationsError);
        return;
      }

      // If admin, fetch user profiles separately for names
      if (userRole === 'admin' && locationsData && locationsData.length > 0) {
        const userIds = [...new Set(locationsData.map(loc => loc.user_id))];
        const { data: profilesData } = await supabase
          .from('profiles')
          .select('user_id, first_name, last_name, email')
          .in('user_id', userIds);

        const profilesMap = new Map(
          profilesData?.map(p => [p.user_id, p]) || []
        );

        const enrichedLocations = locationsData.map(location => ({
          ...location,
          user_name: profilesMap.get(location.user_id) 
            ? `${profilesMap.get(location.user_id)?.first_name} ${profilesMap.get(location.user_id)?.last_name}`
            : 'Unknown User',
          user_email: profilesMap.get(location.user_id)?.email || '',
        }));

        setLocations(enrichedLocations);
      } else {
        setLocations(locationsData || []);
      }
    } catch (error) {
      console.error('Error fetching locations:', error);
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...locations];

    // User filter
    if (selectedUser !== 'all') {
      filtered = filtered.filter(location => location.user_id === selectedUser);
    }

    // Date filter
    if (selectedDate) {
      const filterDate = new Date(selectedDate).toDateString();
      filtered = filtered.filter(location => 
        new Date(location.created_at).toDateString() === filterDate
      );
    }

    // Country filter
    if (selectedCountry !== 'all') {
      filtered = filtered.filter(location => location.country === selectedCountry);
    }

    // State filter
    if (selectedState !== 'all') {
      filtered = filtered.filter(location => location.state === selectedState);
    }

    setFilteredLocations(filtered);
  };

  const getUniqueUsers = () => {
    const users = locations.map(loc => ({
      id: loc.user_id,
      name: loc.user_name || 'Unknown User'
    }));
    return Array.from(new Map(users.map(user => [user.id, user])).values());
  };

  const getUniqueCountries = () => {
    return [...new Set(locations.map(loc => loc.country).filter(Boolean))];
  };

  const getUniqueStates = () => {
    const states = locations.filter(loc => 
      selectedCountry === 'all' || loc.country === selectedCountry
    ).map(loc => loc.state).filter(Boolean);
    return [...new Set(states)];
  };

  const getVisitTypeColor = (visitType: string) => {
    if (visitType.includes('Visita en frío')) return 'bg-blue-100 text-blue-800';
    if (visitType.includes('Visita programada')) return 'bg-warning/20 text-warning-foreground';
    if (visitType.includes('Visita de cortesía')) return 'bg-green-100 text-green-800';
    return 'bg-gray-100 text-gray-800';
  };

  const formatVisitType = (visitType: string) => {
    return visitType || 'Actividad';
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center">Loading locations...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 justify-between">
          <div className="flex items-center gap-2">
            <MapPin className="h-5 w-5 text-warning" />
            {userRole === 'admin' ? 'Ubicaciones del Equipo' : 'Historial de Ubicaciones'}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowFilters(!showFilters)}
            className="text-warning border-warning/20 hover:bg-warning/10"
          >
            <Filter className="h-4 w-4 mr-2" />
            Filtros
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {showFilters && (
          <div className="mb-6 p-4 border rounded-lg bg-warning/5 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {userRole === 'admin' && (
                <div className="space-y-2">
                  <Label>Usuario</Label>
                  <Select value={selectedUser} onValueChange={setSelectedUser}>
                    <SelectTrigger>
                      <SelectValue placeholder="Todos los usuarios" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos los usuarios</SelectItem>
                      {getUniqueUsers().map(user => (
                        <SelectItem key={user.id} value={user.id}>
                          {user.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              
              <div className="space-y-2">
                <Label>Fecha</Label>
                <Input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                />
              </div>
              
              <div className="space-y-2">
                <Label>País</Label>
                <Select value={selectedCountry} onValueChange={setSelectedCountry}>
                  <SelectTrigger>
                    <SelectValue placeholder="Todos los países" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos los países</SelectItem>
                    {getUniqueCountries().map(country => (
                      <SelectItem key={country} value={country}>
                        {country}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label>Región/Estado</Label>
                <Select value={selectedState} onValueChange={setSelectedState}>
                  <SelectTrigger>
                    <SelectValue placeholder="Todas las regiones" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas las regiones</SelectItem>
                    {getUniqueStates().map(state => (
                      <SelectItem key={state} value={state}>
                        {state}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        )}

        {filteredLocations.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            {locations.length === 0 ? 'No hay actividades registradas aún' : 'No se encontraron actividades con los filtros seleccionados'}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="text-sm text-muted-foreground mb-4">
              Mostrando {filteredLocations.length} de {locations.length} actividades
            </div>
            {filteredLocations.map((location) => (
              <div
                key={location.id}
                className="border rounded-lg p-4 space-y-3"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <Badge className={getVisitTypeColor(location.visit_type)}>
                      {formatVisitType(location.visit_type)}
                    </Badge>
                    {userRole === 'admin' && location.user_name && (
                      <div className="flex items-center gap-1 text-sm text-muted-foreground">
                        <User className="h-4 w-4" />
                        {location.user_name}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    {new Date(location.created_at).toLocaleString()}
                  </div>
                </div>

                <div className="space-y-1">
                  <p className="text-sm font-medium">{location.address}</p>
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <span>{location.latitude.toFixed(6)}, {location.longitude.toFixed(6)}</span>
                    {location.country && (
                      <div className="flex items-center gap-1">
                        <Globe className="h-3 w-3" />
                        <span>{location.country}</span>
                        {location.state && <span>• {location.state}</span>}
                      </div>
                    )}
                  </div>
                </div>

                {location.notes && (
                  <p className="text-sm text-muted-foreground bg-muted p-2 rounded">
                    {location.notes}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default LocationHistory;