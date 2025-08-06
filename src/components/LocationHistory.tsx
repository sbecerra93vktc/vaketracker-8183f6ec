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

  // Reset state filter when country changes
  useEffect(() => {
    if (selectedCountry !== 'all') {
      setSelectedState('all');
    }
  }, [selectedCountry]);

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
      filtered = filtered.filter(location => {
        // For existing records without country data, detect from coordinates
        const locationCountry = location.country || detectCountryFromCoordinates(location.latitude, location.longitude);
        return locationCountry === selectedCountry;
      });
    }

    // State filter
    if (selectedState !== 'all') {
      filtered = filtered.filter(location => {
        // For existing records without state data, detect from coordinates
        const locationState = location.state || detectStateFromCoordinates(
          location.latitude, 
          location.longitude, 
          location.country || detectCountryFromCoordinates(location.latitude, location.longitude)
        );
        return locationState === selectedState;
      });
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
    const countries = locations.map(loc => {
      // For existing records without country data, detect from coordinates
      return loc.country || detectCountryFromCoordinates(loc.latitude, loc.longitude);
    }).filter(Boolean);
    return [...new Set(countries)];
  };

  const getUniqueStates = () => {
    let filteredLocations = locations;
    
    // If a country is selected, only show states from that country
    if (selectedCountry !== 'all') {
      filteredLocations = locations.filter(loc => {
        // For existing records without country data, detect from coordinates
        if (!loc.country) {
          const detectedCountry = detectCountryFromCoordinates(loc.latitude, loc.longitude);
          return detectedCountry === selectedCountry;
        }
        return loc.country === selectedCountry;
      });
    }
    
    const states = filteredLocations.map(loc => {
      // For existing records without state data, detect from coordinates  
      if (!loc.state) {
        return detectStateFromCoordinates(loc.latitude, loc.longitude, loc.country || detectCountryFromCoordinates(loc.latitude, loc.longitude));
      }
      return loc.state;
    }).filter(Boolean);
    
    return [...new Set(states)];
  };

  const detectCountryFromCoordinates = (lat: number, lng: number): string => {
    // More specific ranges first to avoid overlaps
    if (lat >= 13.0 && lat <= 17.8 && lng >= -92.5 && lng <= -88.0) return 'Guatemala';
    if (lat >= 12.0 && lat <= 14.5 && lng >= -90.5 && lng <= -87.0) return 'El Salvador';
    if (lat >= 12.5 && lat <= 16.5 && lng >= -89.5 && lng <= -83.0) return 'Honduras';
    if (lat >= 8.0 && lat <= 11.5 && lng >= -86.0 && lng <= -82.5) return 'Costa Rica';
    if (lat >= 7.0 && lat <= 9.7 && lng >= -83.0 && lng <= -77.0) return 'Panamá';
    if (lat >= -4.5 && lat <= 13.5 && lng >= -82.0 && lng <= -66.0) return 'Colombia';
    // Mexico should be checked after Central American countries
    if (lat >= 14.5 && lat <= 32.7 && lng >= -118.4 && lng <= -86.7) return 'México';
    if (lat >= 24.0 && lat <= 50.0 && lng >= -130.0 && lng <= -65.0) return 'Estados Unidos';
    if (lat >= 42.0 && lat <= 70.0 && lng >= -140.0 && lng <= -52.0) return 'Canadá';
    return '';
  };

  const detectStateFromCoordinates = (lat: number, lng: number, country: string): string => {
    if (country === 'México') {
      if (lat >= 19.0 && lat <= 25.0 && lng >= -89.0 && lng <= -86.0) return 'Quintana Roo';
      if (lat >= 20.0 && lat <= 22.5 && lng >= -90.5 && lng <= -88.0) return 'Yucatán';
      if (lat >= 19.0 && lat <= 21.5 && lng >= -91.0 && lng <= -89.0) return 'Campeche';
      if (lat >= 25.0 && lat <= 32.7 && lng >= -115.0 && lng <= -109.0) return 'Baja California';
      return 'Otra región';
    }
    if (country === 'Guatemala') {
      // Guatemala City and surrounding metropolitan area (zones 1-25)
      if (lat >= 14.4 && lat <= 14.8 && lng >= -90.8 && lng <= -90.3) return 'Guatemala (Capital)';
      // Mixco, Villa Nueva, San José Pinula (metropolitan area)
      if (lat >= 14.4 && lat <= 14.8 && lng >= -90.8 && lng <= -90.2) return 'Guatemala (Metropolitana)';
      // Other regions
      if (lat >= 15.5 && lat <= 16.0 && lng >= -91.5 && lng <= -90.5) return 'Alta Verapaz';
      if (lat >= 15.0 && lat <= 15.8 && lng >= -90.8 && lng <= -90.0) return 'Baja Verapaz';
      if (lat >= 14.8 && lat <= 15.8 && lng >= -92.0 && lng <= -91.0) return 'Quiché';
      if (lat >= 14.2 && lat <= 15.0 && lng >= -91.8 && lng <= -90.8) return 'Chimaltenango';
      if (lat >= 14.3 && lat <= 14.8 && lng >= -91.0 && lng <= -90.5) return 'Sacatepéquez';
      if (lat >= 13.8 && lat <= 14.5 && lng >= -90.5 && lng <= -89.5) return 'Jalapa';
      if (lat >= 13.5 && lat <= 14.3 && lng >= -90.2 && lng <= -89.2) return 'Jutiapa';
      return 'Guatemala';
    }
    if (country === 'El Salvador') {
      if (lat >= 13.5 && lat <= 14.5 && lng >= -89.5 && lng <= -88.8) return 'San Salvador';
      if (lat >= 13.8 && lat <= 14.2 && lng >= -89.8 && lng <= -89.2) return 'Santa Ana';
      if (lat >= 13.0 && lat <= 13.8 && lng >= -89.5 && lng <= -88.8) return 'La Libertad';
      return 'El Salvador';
    }
    if (country === 'Honduras') {
      if (lat >= 14.0 && lat <= 14.3 && lng >= -87.5 && lng <= -86.8) return 'Francisco Morazán';
      if (lat >= 15.3 && lat <= 15.8 && lng >= -88.2 && lng <= -87.5) return 'Cortés';
      if (lat >= 15.0 && lat <= 15.5 && lng >= -87.8 && lng <= -87.0) return 'Atlántida';
      return 'Honduras';
    }
    return country || 'Región detectada';
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
                    <div className="flex items-center gap-1">
                      <Globe className="h-3 w-3" />
                      <span>
                        {location.country || detectCountryFromCoordinates(location.latitude, location.longitude)}
                      </span>
                      <span>•</span>
                      <span>
                        {location.state || detectStateFromCoordinates(
                          location.latitude, 
                          location.longitude,
                          location.country || detectCountryFromCoordinates(location.latitude, location.longitude)
                        )}
                      </span>
                    </div>
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