import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { MapPin, Clock, User, Filter, Globe, List, Grid3X3, Loader2, Phone } from 'lucide-react';
import ActivityMediaDisplay from './ActivityMediaDisplay';
import { useActivityStore } from '@/stores/activityStore';
import { useIsMobile } from '@/hooks/use-mobile';

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
  const isMobile = useIsMobile();
  const [locations, setLocations] = useState<Location[]>([]);
  const [filteredLocations, setFilteredLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadingFilters, setLoadingFilters] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [currentPage, setCurrentPage] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [selectedUser, setSelectedUser] = useState<string>('all');
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [selectedCountry, setSelectedCountry] = useState<string>('all');
  const [selectedState, setSelectedState] = useState<string>('all');
  const [showFilters, setShowFilters] = useState(false);
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
  const { userRole } = useAuth();
  const { selectedActivity, setSelectedActivity, clearSelectedActivity, moveMapToLocation } = useActivityStore();

  const ITEMS_PER_PAGE = 10;

  useEffect(() => {
    fetchLocations(true); // Reset and fetch first page
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

  const fetchLocations = async (reset = false) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      if (reset) {
        setCurrentPage(0);
        setLocations([]);
        setLoading(true);
      } else {
        setLoadingMore(true);
      }

      // Build the base query
      let query = supabase
        .from('locations')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false });

      // Apply filters to the query
      if (userRole !== 'admin') {
        query = query.eq('user_id', user.id);
      }

      if (selectedUser !== 'all') {
        query = query.eq('user_id', selectedUser);
      }

      if (selectedDate) {
        const [year, month, day] = selectedDate.split('-').map(Number);
        const filterDate = new Date(year, month - 1, day);
        const nextDay = new Date(filterDate);
        nextDay.setDate(nextDay.getDate() + 1);
        
        query = query
          .gte('created_at', filterDate.toISOString())
          .lt('created_at', nextDay.toISOString());
      }

      // Apply pagination
      const from = reset ? 0 : locations.length;
      const to = from + ITEMS_PER_PAGE - 1;
      query = query.range(from, to);

      const { data: locationsData, error: locationsError, count } = await query;

      if (locationsError) {
        console.error('Error fetching locations:', locationsError);
        return;
      }

      setTotalCount(count || 0);

      // If admin, fetch user profiles separately for names
      let enrichedLocations = locationsData || [];
      if (userRole === 'admin' && locationsData && locationsData.length > 0) {
        const userIds = [...new Set(locationsData.map(loc => loc.user_id))];
        const { data: profilesData } = await supabase
          .from('profiles')
          .select('user_id, first_name, last_name, email')
          .in('user_id', userIds);

        const profilesMap = new Map(
          profilesData?.map(p => [p.user_id, p]) || []
        );

        enrichedLocations = locationsData.map(location => ({
          ...location,
          user_name: profilesMap.get(location.user_id) 
            ? `${profilesMap.get(location.user_id)?.first_name} ${profilesMap.get(location.user_id)?.last_name}`
            : 'Unknown User',
          user_email: profilesMap.get(location.user_id)?.email || '',
        }));
      }

      if (reset) {
        setLocations(enrichedLocations);
        setCurrentPage(1);
      } else {
        setLocations(prev => [...prev, ...enrichedLocations]);
        setCurrentPage(prev => prev + 1);
      }

      // Check if there are more items
      const totalFetched = reset ? enrichedLocations.length : locations.length + enrichedLocations.length;
      setHasMore((count || 0) > totalFetched);

    } catch (error) {
      console.error('Error fetching locations:', error);
    } finally {
      setLoading(false);
      setLoadingMore(false);
      setLoadingFilters(false);
    }
  };

  const loadMore = () => {
    if (!loadingMore && hasMore) {
      fetchLocations(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...locations];

    // Country filter (client-side for existing data)
    if (selectedCountry !== 'all') {
      filtered = filtered.filter(location => {
        const locationCountry = location.country || detectCountryFromCoordinates(location.latitude, location.longitude);
        return locationCountry === selectedCountry;
      });
    }

    // State filter (client-side for existing data)
    if (selectedState !== 'all') {
      filtered = filtered.filter(location => {
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

  const handleFilterChange = () => {
    // Reset and fetch with new filters
    setLoadingFilters(true);
    fetchLocations(true);
    // Clear selected activity when filters change
    clearSelectedActivity();
  };

  // Handle activity selection
  const handleActivitySelect = (activity: Location) => {
    // If clicking the same activity, clear the selection
    if (selectedActivity?.id === activity.id) {
      clearSelectedActivity();
      return;
    }
    
    // Map Location to Activity interface with all fields
    const mappedActivity = {
      ...activity,
      // Map user_name to name for consistency
      name: activity.user_name,
      email: activity.user_email,
      // Map region from country/state
      region: activity.state || activity.country || detectCountryFromCoordinates(activity.latitude, activity.longitude),
    };
    setSelectedActivity(mappedActivity);
    
    // Move map camera to the selected activity location
    moveMapToLocation(activity.latitude, activity.longitude);
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
    if (visitType.includes('Visita en frío')) return 'bg-blue-600 text-white';
    if (visitType.includes('Visita programada')) return 'bg-yellow-600 text-white';
    if (visitType.includes('Visita de cortesía')) return 'bg-green-600 text-white';
    if (visitType.includes('Negociación en curso')) return 'bg-purple-600 text-white';
    if (visitType.includes('Visita pre-entrega')) return 'bg-orange-600 text-white';
    if (visitType.includes('Visita técnica')) return 'bg-red-600 text-white';
    return 'bg-gray-600 text-white';
  };

  const formatVisitType = (visitType: string) => {
    return visitType || 'Actividad';
  };

  if (loading && currentPage === 0) { // Only show full loading if it's the initial fetch
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center">Loading locations...</div>
        </CardContent>
      </Card>
    );
  }

  // Display range for the current page
  const startIndex = filteredLocations.length > 0 ? (currentPage - 1) * ITEMS_PER_PAGE + 1 : 0;
  const endIndex = (currentPage - 1) * ITEMS_PER_PAGE + filteredLocations.length;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 justify-between">
          <div className="flex items-center gap-2">
            <MapPin className="h-5 w-5 text-warning" />
            {userRole === 'admin' ? 'Actividades del Equipo' : 'Historial de Ubicaciones'}
          </div>
          <div className="flex items-center gap-2">
            <div className="flex border rounded-lg p-1">
              <Button
                variant={viewMode === 'list' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('list')}
                className="h-8 px-2"
              >
                <List className="h-4 w-4" />
              </Button>
              <Button
                variant={viewMode === 'grid' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('grid')}
                className="h-8 px-2"
              >
                <Grid3X3 className="h-4 w-4" />
              </Button>
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
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {showFilters && (
          <div className="mb-6 p-4 border rounded-lg bg-warning/5 space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-sm font-medium">Filtros aplicados</h3>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSelectedUser('all');
                  setSelectedDate('');
                  setSelectedCountry('all');
                  setSelectedState('all');
                  setTimeout(handleFilterChange, 100);
                }}
                className="text-xs"
              >
                Limpiar filtros
              </Button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {userRole === 'admin' && (
                <div className="space-y-2">
                  <Label>Usuario</Label>
                  <Select value={selectedUser} onValueChange={(value) => {
                    setSelectedUser(value);
                    setTimeout(handleFilterChange, 100);
                  }}>
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
                  onChange={(e) => {
                    setSelectedDate(e.target.value);
                    setTimeout(handleFilterChange, 100);
                  }}
                />
              </div>
              
              <div className="space-y-2">
                <Label>País</Label>
                <Select value={selectedCountry} onValueChange={(value) => {
                  setSelectedCountry(value);
                  setTimeout(handleFilterChange, 100);
                }}>
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
              
              {selectedCountry !== 'all' && (
                <div className="space-y-2">
                  <Label>Región/Estado</Label>
                  <Select value={selectedState} onValueChange={(value) => {
                    setSelectedState(value);
                    setTimeout(handleFilterChange, 100);
                  }}>
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
              )}
            </div>
          </div>
        )}

        {loadingFilters ? (
          <div className="text-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-warning mx-auto mb-2" />
            <p className="text-muted-foreground">Aplicando filtros...</p>
          </div>
        ) : filteredLocations.length === 0 && currentPage === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            {locations.length === 0 ? 'No hay actividades registradas aún' : 'No se encontraron actividades con los filtros seleccionados'}
          </div>
        ) : (
          <div>
            <div className="text-sm text-muted-foreground mb-4">
              Mostrando {filteredLocations.length > 0 ? 1 : 0}-{filteredLocations.length} ({totalCount} actividades)
            </div>
            {viewMode === 'list' ? (
              <div className="space-y-4">
                {selectedActivity ? (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-semibold text-warning bg-gradient-to-r from-warning/10 to-orange-500/10 px-4 py-2 rounded-lg">Detalles de Actividad</h3>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={clearSelectedActivity}
                        className="text-xs bg-white/90 backdrop-blur-sm border-warning/30 hover:bg-warning/10"
                      >
                        Cerrar
                      </Button>
                    </div>
                    
                    <div className="group relative overflow-hidden rounded-2xl border-0 bg-gradient-to-br from-warning/10 via-warning/5 to-white p-6 backdrop-blur-sm shadow-2xl ring-2 ring-warning/60">
                      {/* Glass morphism effect */}
                      <div className="absolute inset-0 bg-white/20 backdrop-blur-[2px] rounded-2xl"></div>
                      
                      {/* Selection indicator with glow */}
                      <div className="absolute top-5 right-5 w-4 h-4 bg-gradient-to-r from-warning to-orange-500 rounded-full animate-pulse shadow-lg shadow-warning/50 z-10">
                        <div className="absolute inset-1 bg-white rounded-full"></div>
                      </div>

                      {/* Content wrapper */}
                      <div className="relative z-10">
                        {/* Header section */}
                        <div className="flex items-start justify-between mb-6">
                          <div className="flex items-center gap-3">
                            <div className={`inline-flex items-center rounded-full px-4 py-2 text-xs font-bold shadow-lg ${getVisitTypeColor(selectedActivity.visit_type)} backdrop-blur-sm`}>
                              {formatVisitType(selectedActivity.visit_type)}
                            </div>
                            {userRole === 'admin' && selectedActivity.user_name && (
                              <div className="flex items-center gap-2 text-sm bg-gradient-to-r from-blue-500/10 to-purple-500/10 px-4 py-2 rounded-full border border-blue-200/50">
                                <User className="h-4 w-4 text-blue-600" />
                                <span className="font-semibold text-blue-700">{selectedActivity.user_name}</span>
                              </div>
                            )}
                          </div>
                          <div className="flex items-center gap-2 text-xs bg-white/90 backdrop-blur-sm px-4 py-2 rounded-full shadow-sm border border-gray-200/50">
                            <Clock className="h-3 w-3 text-gray-600" />
                            <span className="font-medium text-gray-700">{new Date(selectedActivity.created_at).toLocaleString()}</span>
                          </div>
                        </div>

                        {/* Address and location section */}
                        <div className="space-y-4 mb-6">
                          <div className="flex items-start gap-4">
                            <div className="flex-shrink-0 w-12 h-12 bg-gradient-to-br from-warning/20 to-orange-500/20 rounded-xl flex items-center justify-center">
                              <MapPin className="h-6 w-6 text-warning" />
                            </div>
                            <div className="flex-1">
                              <p className="text-lg font-semibold text-gray-900 leading-relaxed mb-3">
                                {selectedActivity.address}
                              </p>
                              <div className="flex flex-wrap items-center gap-3 text-sm">
                                <span className="bg-gray-100/80 backdrop-blur-sm px-3 py-2 rounded-lg font-mono text-xs font-medium border border-gray-200/50">
                                  {selectedActivity.latitude.toFixed(6)}, {selectedActivity.longitude.toFixed(6)}
                                </span>
                                <div className="flex items-center gap-2 bg-gradient-to-r from-green-500/10 to-emerald-500/10 px-3 py-2 rounded-lg border border-green-200/50">
                                  <Globe className="h-4 w-4 text-green-600" />
                                  <span className="font-semibold text-green-700">
                                    {selectedActivity.country || detectCountryFromCoordinates(selectedActivity.latitude, selectedActivity.longitude)}
                                  </span>
                                  <span className="text-green-400 font-bold">•</span>
                                  <span className="font-medium text-green-600">
                                    {selectedActivity.state || detectStateFromCoordinates(
                                      selectedActivity.latitude, 
                                      selectedActivity.longitude,
                                      selectedActivity.country || detectCountryFromCoordinates(selectedActivity.latitude, selectedActivity.longitude)
                                    )}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Notes section */}
                        {selectedActivity.notes && (
                          <div className="mb-6 p-4 bg-gradient-to-r from-amber-50/80 to-orange-50/80 rounded-xl border-l-4 border-amber-400 backdrop-blur-sm">
                            <p className="text-sm text-amber-900 leading-relaxed font-medium">
                              {selectedActivity.notes}
                            </p>
                          </div>
                        )}

                        {/* Business information section */}
                        {(selectedActivity.business_name || selectedActivity.contact_person || selectedActivity.contact_email || selectedActivity.phone) && (
                          <div className="mb-6 p-4 bg-gradient-to-r from-blue-50/80 to-indigo-50/80 rounded-xl border-l-4 border-blue-400 backdrop-blur-sm">
                            <h4 className="text-sm font-semibold text-blue-900 mb-3">Información de Negocio</h4>
                            <div className="space-y-2">
                              {selectedActivity.business_name && (
                                <div className="flex items-center gap-2 text-sm">
                                  <span className="font-medium text-blue-700">Negocio:</span>
                                  <span className="text-blue-800">{selectedActivity.business_name}</span>
                                </div>
                              )}
                              {selectedActivity.contact_person && (
                                <div className="flex items-center gap-2 text-sm">
                                  <span className="font-medium text-blue-700">Contacto:</span>
                                  <span className="text-blue-800">{selectedActivity.contact_person}</span>
                                </div>
                              )}
                              {selectedActivity.contact_email && (
                                <div className="flex items-center gap-2 text-sm">
                                  <span className="font-medium text-blue-700">Email:</span>
                                  <span className="text-blue-800">{selectedActivity.contact_email}</span>
                                </div>
                              )}
                              {selectedActivity.phone && (
                                <div className="flex items-center justify-between gap-2 text-sm">
                                  <div className="flex items-center gap-2">
                                    <span className="font-medium text-blue-700">Teléfono:</span>
                                    <span className="text-blue-800">{selectedActivity.phone}</span>
                                  </div>
                                  {isMobile && (
                                    <Button asChild className="bg-green-600 text-white hover:bg-green-700">
                                      <a href={`tel:${selectedActivity.phone}`} aria-label={`Llamar al ${selectedActivity.phone}`}>
                                        <Phone className="h-4 w-4 mr-2" /> Llamar
                                      </a>
                                    </Button>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                        
                        {/* Media display */}
                        <div className="mt-auto">
                          <ActivityMediaDisplay 
                            activityId={selectedActivity.id} 
                            activityAddress={selectedActivity.address}
                          />
                        </div>
                      </div>

                      {/* Enhanced selection overlay */}
                      <div className="absolute inset-0 bg-gradient-to-t from-warning/10 via-transparent to-transparent opacity-100 rounded-2xl pointer-events-none"></div>
                      
                      {/* Border glow effect */}
                      <div className="absolute inset-0 rounded-2xl opacity-100 pointer-events-none" style={{
                        background: 'linear-gradient(45deg, transparent, rgba(245, 158, 11, 0.1), transparent)',
                        border: '1px solid rgba(245, 158, 11, 0.2)'
                      }}></div>
                    </div>
                  </div>
                ) : (
                  <>
                    {filteredLocations.map((location) => (
                      <div
                        key={location.id}
                        className={`group relative overflow-hidden rounded-2xl border-0 bg-gradient-to-br from-white via-gray-50/30 to-white p-6 cursor-pointer transition-all duration-500 hover:shadow-2xl hover:scale-[1.02] hover:-translate-y-1 backdrop-blur-sm ${
                          selectedActivity?.id === location.id 
                            ? 'ring-2 ring-warning/60 shadow-2xl scale-[1.02] -translate-y-1 bg-gradient-to-br from-warning/10 via-warning/5 to-white' 
                            : 'hover:border-warning/40 hover:bg-gradient-to-br hover:from-white hover:via-warning/5 hover:to-white'
                        }`}
                        onClick={() => handleActivitySelect(location)}
                      >
                        {/* Glass morphism effect */}
                        <div className="absolute inset-0 bg-white/20 backdrop-blur-[2px] rounded-2xl"></div>
                        
                        {/* Selection indicator with glow */}
                        {selectedActivity?.id === location.id && (
                          <div className="absolute top-5 right-5 w-4 h-4 bg-gradient-to-r from-warning to-orange-500 rounded-full animate-pulse shadow-lg shadow-warning/50 z-10">
                            <div className="absolute inset-1 bg-white rounded-full"></div>
                          </div>
                        )}

                        {/* Content wrapper */}
                        <div className="relative z-10">
                          {/* Header section */}
                          <div className="flex items-start justify-between mb-6">
                            <div className="flex items-center gap-3">
                              <div className={`inline-flex items-center rounded-full px-4 py-2 text-xs font-bold shadow-lg ${getVisitTypeColor(location.visit_type)} backdrop-blur-sm`}>
                                {formatVisitType(location.visit_type)}
                              </div>
                              {userRole === 'admin' && location.user_name && (
                                <div className="flex items-center gap-2 text-sm bg-gradient-to-r from-blue-500/10 to-purple-500/10 px-4 py-2 rounded-full border border-blue-200/50">
                                  <User className="h-4 w-4 text-blue-600" />
                                  <span className="font-semibold text-blue-700">{location.user_name}</span>
                                </div>
                              )}
                            </div>
                            <div className="flex items-center gap-2 text-xs bg-white/90 backdrop-blur-sm px-4 py-2 rounded-full shadow-sm border border-gray-200/50">
                              <Clock className="h-3 w-3 text-gray-600" />
                              <span className="font-medium text-gray-700">{new Date(location.created_at).toLocaleString()}</span>
                            </div>
                          </div>

                          {/* Address and location section */}
                          <div className="space-y-4 mb-6">
                            <div className="flex items-start gap-4">
                              <div className="flex-shrink-0 w-12 h-12 bg-gradient-to-br from-warning/20 to-orange-500/20 rounded-xl flex items-center justify-center">
                                <MapPin className="h-6 w-6 text-warning" />
                              </div>
                              <div className="flex-1">
                                <p className="text-lg font-semibold text-gray-900 leading-relaxed mb-3">
                                  {location.address}
                                </p>
                                <div className="flex flex-wrap items-center gap-3 text-sm">
                                  <span className="bg-gray-100/80 backdrop-blur-sm px-3 py-2 rounded-lg font-mono text-xs font-medium border border-gray-200/50">
                                    {location.latitude.toFixed(6)}, {location.longitude.toFixed(6)}
                                  </span>
                                  <div className="flex items-center gap-2 bg-gradient-to-r from-green-500/10 to-emerald-500/10 px-3 py-2 rounded-lg border border-green-200/50">
                                    <Globe className="h-4 w-4 text-green-600" />
                                    <span className="font-semibold text-green-700">
                                      {location.country || detectCountryFromCoordinates(location.latitude, location.longitude)}
                                    </span>
                                    <span className="text-green-400 font-bold">•</span>
                                    <span className="font-medium text-green-600">
                                      {location.state || detectStateFromCoordinates(
                                        location.latitude, 
                                        location.longitude,
                                        location.country || detectCountryFromCoordinates(location.latitude, location.longitude)
                                      )}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Notes section */}
                          {location.notes && (
                            <div className="mb-6 p-4 bg-gradient-to-r from-amber-50/80 to-orange-50/80 rounded-xl border-l-4 border-amber-400 backdrop-blur-sm">
                              <p className="text-sm text-amber-900 leading-relaxed font-medium">
                                {location.notes}
                              </p>
                            </div>
                          )}
                          
                          {/* Media display */}
                          <div className="mt-auto">
                            <ActivityMediaDisplay 
                              activityId={location.id} 
                              activityAddress={location.address}
                            />
                          </div>
                        </div>

                        {/* Enhanced hover overlay effect */}
                        <div className={`absolute inset-0 bg-gradient-to-t from-warning/10 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-all duration-500 rounded-2xl pointer-events-none ${
                          selectedActivity?.id === location.id ? 'opacity-100' : ''
                        }`}></div>
                        
                        {/* Subtle border glow on hover */}
                        <div className={`absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none ${
                          selectedActivity?.id === location.id ? 'opacity-100' : ''
                        }`} style={{
                          background: 'linear-gradient(45deg, transparent, rgba(245, 158, 11, 0.1), transparent)',
                          border: '1px solid rgba(245, 158, 11, 0.2)'
                        }}></div>
                      </div>
                    ))}
                  </>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredLocations.map((location) => (
                  <div
                    key={location.id}
                    className={`group relative overflow-hidden rounded-2xl border-0 bg-gradient-to-br from-white via-gray-50/30 to-white p-5 cursor-pointer transition-all duration-500 hover:shadow-2xl hover:scale-[1.03] hover:-translate-y-1 backdrop-blur-sm ${
                      selectedActivity?.id === location.id 
                        ? 'ring-2 ring-warning/60 shadow-2xl scale-[1.03] -translate-y-1 bg-gradient-to-br from-warning/10 via-warning/5 to-white' 
                        : 'hover:border-warning/40 hover:bg-gradient-to-br hover:from-white hover:via-warning/5 hover:to-white'
                    }`}
                    onClick={() => handleActivitySelect(location)}
                  >
                    {/* Glass morphism effect */}
                    <div className="absolute inset-0 bg-white/20 backdrop-blur-[2px] rounded-2xl"></div>
                    
                    {/* Selection indicator with glow */}
                    {selectedActivity?.id === location.id && (
                      <div className="absolute top-4 right-4 w-4 h-4 bg-gradient-to-r from-warning to-orange-500 rounded-full animate-pulse shadow-lg shadow-warning/50 z-10">
                        <div className="absolute inset-1 bg-white rounded-full"></div>
                      </div>
                    )}

                    {/* Content wrapper */}
                    <div className="relative z-10">
                      {/* Header with badge and date */}
                      <div className="flex items-start justify-between mb-4">
                        <div className={`inline-flex items-center rounded-full px-3 py-1.5 text-xs font-bold shadow-lg ${getVisitTypeColor(location.visit_type)} backdrop-blur-sm`}>
                          {formatVisitType(location.visit_type)}
                        </div>
                        <div className="flex items-center gap-2 text-xs bg-white/90 backdrop-blur-sm px-3 py-1.5 rounded-full shadow-sm border border-gray-200/50">
                          <Clock className="h-3 w-3 text-gray-600" />
                          <span className="font-medium text-gray-700">{new Date(location.created_at).toLocaleDateString()}</span>
                        </div>
                      </div>

                      {/* Address section */}
                      <div className="space-y-3 mb-4">
                        <div className="flex items-start gap-3">
                          <div className="flex-shrink-0 w-10 h-10 bg-gradient-to-br from-warning/20 to-orange-500/20 rounded-lg flex items-center justify-center">
                            <MapPin className="h-5 w-5 text-warning" />
                          </div>
                          <div className="flex-1">
                            <p className="text-sm font-semibold text-gray-900 line-clamp-2 leading-relaxed mb-2">
                              {location.address}
                            </p>
                            <div className="flex items-center gap-2 text-xs">
                              <div className="flex items-center gap-1 bg-gradient-to-r from-green-500/10 to-emerald-500/10 px-2 py-1 rounded-md border border-green-200/50">
                                <Globe className="h-3 w-3 text-green-600" />
                                <span className="font-semibold text-green-700">
                                  {location.country || detectCountryFromCoordinates(location.latitude, location.longitude)}
                                </span>
                                <span className="text-green-400 font-bold">•</span>
                                <span className="font-medium text-green-600">
                                  {location.state || detectStateFromCoordinates(
                                    location.latitude, 
                                    location.longitude,
                                    location.country || detectCountryFromCoordinates(location.latitude, location.longitude)
                                  )}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* User info for admin */}
                      {userRole === 'admin' && location.user_name && (
                        <div className="flex items-center gap-2 text-xs bg-gradient-to-r from-blue-500/10 to-purple-500/10 px-3 py-2 rounded-full border border-blue-200/50 mb-4">
                          <User className="h-3 w-3 text-blue-600" />
                          <span className="font-semibold text-blue-700">{location.user_name}</span>
                        </div>
                      )}

                      {/* Notes preview */}
                      {location.notes && (
                        <div className="mb-4 p-3 bg-gradient-to-r from-amber-50/80 to-orange-50/80 rounded-lg border-l-3 border-amber-400 backdrop-blur-sm">
                          <p className="text-xs text-amber-900 line-clamp-2 leading-relaxed font-medium">
                            {location.notes}
                          </p>
                        </div>
                      )}
                      
                      {/* Media display */}
                      <div className="mt-auto">
                        <ActivityMediaDisplay 
                          activityId={location.id} 
                          activityAddress={location.address}
                        />
                      </div>
                    </div>

                    {/* Enhanced hover overlay effect */}
                    <div className={`absolute inset-0 bg-gradient-to-t from-warning/10 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-all duration-500 rounded-2xl pointer-events-none ${
                      selectedActivity?.id === location.id ? 'opacity-100' : ''
                    }`}></div>
                    
                    {/* Subtle border glow on hover */}
                    <div className={`absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none ${
                      selectedActivity?.id === location.id ? 'opacity-100' : ''
                    }`} style={{
                      background: 'linear-gradient(45deg, transparent, rgba(245, 158, 11, 0.1), transparent)',
                      border: '1px solid rgba(245, 158, 11, 0.2)'
                    }}></div>
                  </div>
                ))}
              </div>
            )}
            {loadingMore && (
              <div className="text-center py-4">
                <Loader2 className="h-6 w-6 animate-spin text-warning" />
                <span className="ml-2">Cargando más actividades...</span>
              </div>
            )}
                         {!loadingMore && hasMore && (
               <div className="text-center py-4">
                 <Button onClick={loadMore} className="bg-warning text-white border-warning hover:bg-warning/90">
                   {loadingMore ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                   Cargar más
                 </Button>
               </div>
             )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default LocationHistory;