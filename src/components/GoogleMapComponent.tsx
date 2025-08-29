
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { loadGoogleMaps } from '@/lib/googleMapsLoader';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { MapPin, Users, Activity, Filter, Calendar, MapIcon, ChevronDown, ChevronUp, Download, Eye, EyeOff } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import * as XLSX from 'xlsx';
import ActivityMediaDisplay from '@/components/ActivityMediaDisplay';
import { useActivityStore } from '@/stores/activityStore';

interface TeamLocation {
  id: string;
  user_id: string;
  name: string;
  email: string;
  latitude: number;
  longitude: number;
  visit_type: string;
  notes: string;
  created_at: string;
  address: string;
  country?: string;
  state?: string;
  region?: string;
  business_name?: string;
  contact_person?: string;
  contact_email?: string;
  phone?: string;
  photos?: string[];
}

const GoogleMapComponent = () => {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<Map<string, google.maps.Marker>>(new Map());
  const [isMapLoaded, setIsMapLoaded] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingKey, setIsLoadingKey] = useState(true);
  const [teamLocations, setTeamLocations] = useState<TeamLocation[]>([]);
  const [filteredLocations, setFilteredLocations] = useState<TeamLocation[]>([]);
  const [selectedUser, setSelectedUser] = useState<string>('all');
  const [selectedVisitType, setSelectedVisitType] = useState<string>('all');
  const [selectedDateFrom, setSelectedDateFrom] = useState<string>('');
  const [selectedDateTo, setSelectedDateTo] = useState<string>('');
  const [selectedCountry, setSelectedCountry] = useState<string>('all');
  const [selectedState, setSelectedState] = useState<string>('all');
  const [isTeamPanelCollapsed, setIsTeamPanelCollapsed] = useState(false);
  const { userRole } = useAuth();
  const { toast } = useToast();
  const { selectedActivity, setSelectedActivity, clearSelectedActivity, mapCamera, clearMapCamera } = useActivityStore();

  // Reset state filter when country changes
  useEffect(() => {
    if (selectedCountry !== 'all') {
      setSelectedState('all');
    }
  }, [selectedCountry]);

  // Reset user filter when country changes
  useEffect(() => {
    if (selectedCountry !== 'all') {
      setSelectedUser('all');
    }
  }, [selectedCountry]);

  // Country detection from coordinates
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

  const getRegionFromCoordinates = (lat: number, lng: number): string => {
    const country = detectCountryFromCoordinates(lat, lng);
    const state = detectStateFromCoordinates(lat, lng, country);
    
    if (country && state && state !== country) {
      return `${country} - ${state}`;
    }
    return country || 'Región no identificada';
  };

  const loadMap = useCallback(async (key: string) => {
    if (!mapRef.current || !key || isLoading) {
      return;
    }

    setIsLoading(true);

    try {
      // Load Google Maps API using shared loader
      await loadGoogleMaps();

      const map = new google.maps.Map(mapRef.current, {
        zoom: 2,
        center: { lat: 20, lng: 0 }, // World view initially
        mapTypeId: google.maps.MapTypeId.ROADMAP,
        styles: [
          {
            featureType: 'poi',
            elementType: 'labels',
            stylers: [{ visibility: 'off' }]
          }
        ]
      });

      mapInstanceRef.current = map;
      setIsMapLoaded(true);
      // Map loaded successfully
    } catch (error) {
      console.error('Error loading Google Maps:', error);
    } finally {
      setIsLoading(false);
    }
  }, [isLoading]);

  // Fetch Google Maps API key from Supabase edge function
  const fetchGoogleMapsKey = useCallback(async () => {
    // Fetching Google Maps API key
    try {
      const { data, error } = await supabase.functions.invoke('get-google-maps-key');
      
      if (error) {
        console.error('Error fetching Google Maps API key:', error);
        setIsLoadingKey(false);
        return;
      }

      if (data?.apiKey) {
        loadMap(data.apiKey);
      }
    } catch (error) {
      console.error('Error fetching Google Maps API key:', error);
    } finally {
      setIsLoadingKey(false);
    }
  }, [loadMap]);

  // Fetch team locations from database
  const fetchLocations = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      let query = supabase
        .from('locations')
        .select('*')
        .order('created_at', { ascending: false });

      // If not admin, only show own locations
      if (userRole !== 'admin') {
        query = query.eq('user_id', user.id);
      }

      const { data: locationsData, error } = await query;

      if (error) {
        console.error('Error fetching locations:', error);
        return;
      }

      if (!locationsData || locationsData.length === 0) {
        setTeamLocations([]);
        return;
      }

      // Get unique user IDs to fetch profiles
      const userIds = [...new Set(locationsData.map(loc => loc.user_id))];
      
      // Fetch profiles for these users
      const { data: profilesData } = await supabase
        .from('profiles')
        .select('user_id, first_name, last_name, email')
        .in('user_id', userIds);

      const profilesMap = new Map(
        profilesData?.map(p => [p.user_id, p]) || []
      );

      // Transform data to match our interface
      const transformedLocations: TeamLocation[] = locationsData.map(location => {
        const profile = profilesMap.get(location.user_id);
        const lat = Number(location.latitude);
        const lng = Number(location.longitude);
        return {
          id: location.id,
          user_id: location.user_id,
          name: profile 
            ? `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || 'Unknown User'
            : 'Unknown User',
          email: profile?.email || '',
          latitude: lat,
          longitude: lng,
          visit_type: location.visit_type || 'check_in',
          notes: location.notes || '',
          created_at: location.created_at,
          address: location.address || '',
          country: location.country || detectCountryFromCoordinates(lat, lng),
          state: location.state || detectStateFromCoordinates(lat, lng, location.country || detectCountryFromCoordinates(lat, lng)),
          region: location.state || location.country || getRegionFromCoordinates(lat, lng),
          business_name: location.business_name,
          contact_person: location.contact_person,
          contact_email: location.email, // Map email to contact_email
          phone: location.phone
        };
      });

      setTeamLocations(transformedLocations);
      setFilteredLocations(transformedLocations);
    } catch (error) {
      console.error('Error fetching locations:', error);
    }
  }, [userRole]);

  // Filter locations based on selected criteria
  const applyFilters = useCallback(() => {
    let filtered = teamLocations;

    // Filter by user
    if (selectedUser !== 'all') {
      filtered = filtered.filter(loc => loc.user_id === selectedUser);
    }

    // Filter by visit type
    if (selectedVisitType !== 'all') {
      filtered = filtered.filter(loc => loc.visit_type === selectedVisitType);
    }

    // Filter by date range
    if (selectedDateFrom) {
      const fromDate = new Date(selectedDateFrom);
      filtered = filtered.filter(loc => 
        new Date(loc.created_at) >= fromDate
      );
    }

    if (selectedDateTo) {
      const toDate = new Date(selectedDateTo);
      toDate.setHours(23, 59, 59, 999); // Include the entire day
      filtered = filtered.filter(loc => 
        new Date(loc.created_at) <= toDate
      );
    }

    // Filter by country
    if (selectedCountry !== 'all') {
      filtered = filtered.filter(loc => {
        const detectedCountry = detectCountryFromCoordinates(loc.latitude, loc.longitude);
        return detectedCountry === selectedCountry;
      });
    }

    // Filter by state
    if (selectedState !== 'all') {
      filtered = filtered.filter(loc => {
        const detectedCountry = detectCountryFromCoordinates(loc.latitude, loc.longitude);
        const detectedState = detectStateFromCoordinates(loc.latitude, loc.longitude, detectedCountry);
        return detectedState === selectedState;
      });
    }

    setFilteredLocations(filtered);
  }, [teamLocations, selectedUser, selectedVisitType, selectedDateFrom, selectedDateTo, selectedCountry, selectedState]);

  // Update markers on the map
  const updateMapMarkers = useCallback(() => {
    if (!mapInstanceRef.current || !isMapLoaded) return;

    // Clear existing markers
    markersRef.current.forEach(marker => marker.setMap(null));
    markersRef.current.clear();

    // Add markers for all filtered locations
    filteredLocations.forEach((location) => {
      const isSelected = selectedActivity?.id === location.id;
      const marker = new google.maps.Marker({
        position: { lat: location.latitude, lng: location.longitude },
        map: mapInstanceRef.current,
        title: location.name,
        icon: {
          url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(`
            <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="16" cy="16" r="15" fill="${isSelected ? '#F59E0B' : '#3B82F6'}" stroke="white" stroke-width="2"/>
              <circle cx="16" cy="16" r="8" fill="white"/>
              <circle cx="16" cy="16" r="4" fill="${isSelected ? '#F59E0B' : '#3B82F6'}"/>
            </svg>
          `),
          scaledSize: new google.maps.Size(32, 32)
        }
      });

      const infoWindow = new google.maps.InfoWindow({
        content: `
          <div class="p-3 min-w-[200px]">
            <h3 class="font-semibold text-base">${location.name}</h3>
            <p class="text-sm text-gray-600 mb-1">Actividad: ${location.visit_type}</p>
            ${location.region ? `<p class="text-sm text-gray-600 mb-1">Región: ${location.region}</p>` : ''}
            ${location.notes ? `<p class="text-sm text-gray-600 mb-1">Notas: ${location.notes}</p>` : ''}
            ${location.address ? `<p class="text-sm text-gray-600 mb-1">Dirección: ${location.address}</p>` : ''}
            <p class="text-xs text-gray-500">Fecha: ${new Date(location.created_at).toLocaleString()}</p>
          </div>
        `
      });

      marker.addListener('click', () => {
        // Select this activity
        handleActivitySelect(location);
        
        // Close other info windows first
        markersRef.current.forEach((otherMarker, otherKey) => {
          if (otherKey !== location.id) {
            const otherInfoWindow = (otherMarker as any).infoWindow;
            if (otherInfoWindow) {
              otherInfoWindow.close();
            }
          }
        });
        
        infoWindow.open(mapInstanceRef.current, marker);
        
        // Center map on clicked marker
        mapInstanceRef.current?.panTo({ lat: location.latitude, lng: location.longitude });
      });

      // Store info window reference on marker for later access
      (marker as any).infoWindow = infoWindow;

      markersRef.current.set(location.id, marker);
    });

    // Center map on team locations if available
    if (filteredLocations.length > 0) {
      const bounds = new google.maps.LatLngBounds();
      filteredLocations.forEach(location => {
        bounds.extend({ lat: location.latitude, lng: location.longitude });
      });
      mapInstanceRef.current.fitBounds(bounds);
      
      // Don't zoom too much for single location
      if (filteredLocations.length === 1) {
        setTimeout(() => {
          if (mapInstanceRef.current && mapInstanceRef.current.getZoom()! > 15) {
            mapInstanceRef.current.setZoom(15);
          }
        }, 100);
      }
    }
  }, [filteredLocations, isMapLoaded, selectedActivity]);

  // Apply filters when dependencies change
  useEffect(() => {
    applyFilters();
    // Clear selected activity when filters change
    clearSelectedActivity();
  }, [applyFilters, clearSelectedActivity]);


  // Load the map when component mounts
  useEffect(() => {
    fetchGoogleMapsKey();
  }, [fetchGoogleMapsKey]);

  // Fetch locations when map is loaded
  useEffect(() => {
    if (isMapLoaded) {
      fetchLocations();
    }
  }, [isMapLoaded, fetchLocations]);

  // Update markers when locations change
  useEffect(() => {
    updateMapMarkers();
  }, [updateMapMarkers]);

  // Handle map camera movement from Zustand store
  useEffect(() => {
    if (mapCamera && mapInstanceRef.current && isMapLoaded) {
      mapInstanceRef.current.setCenter({ 
        lat: mapCamera.latitude, 
        lng: mapCamera.longitude 
      });
      mapInstanceRef.current.setZoom(mapCamera.zoom);
      
      // Clear the camera command after executing it
      setTimeout(() => clearMapCamera(), 100);
    }
  }, [mapCamera, isMapLoaded, clearMapCamera]);

  // Set up real-time subscription
  useEffect(() => {
    if (!isMapLoaded) return;

    const channel = supabase
      .channel('locations-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'locations'
        },
        () => {
          // Location updated, refreshing map
          fetchLocations();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [isMapLoaded, fetchLocations]);

  // Get unique users filtered by selected country
  const getUniqueUsersForCountry = () => {
    let filteredLocations = teamLocations;
    
    // If a country is selected, only show users who have activities in that country
    if (selectedCountry !== 'all') {
      filteredLocations = teamLocations.filter(loc => {
        const detectedCountry = detectCountryFromCoordinates(loc.latitude, loc.longitude);
        return detectedCountry === selectedCountry;
      });
    }
    
    return Array.from(new Set(filteredLocations.map(l => l.user_id)))
      .map(userId => teamLocations.find(l => l.user_id === userId)!)
      .filter(Boolean);
  };

  const uniqueUsers = getUniqueUsersForCountry();
  const uniqueRegions = Array.from(new Set(teamLocations.map(l => l.region).filter(Boolean)));

  const getUniqueStatesForMap = () => {
    let filteredLocations = teamLocations;
    
    // If a country is selected, only show states from that country
    if (selectedCountry !== 'all') {
      filteredLocations = teamLocations.filter(loc => {
        const detectedCountry = detectCountryFromCoordinates(loc.latitude, loc.longitude);
        return detectedCountry === selectedCountry;
      });
    }
    
    const states = filteredLocations.map(loc => {
      const detectedCountry = detectCountryFromCoordinates(loc.latitude, loc.longitude);
      return detectStateFromCoordinates(loc.latitude, loc.longitude, detectedCountry);
    }).filter(Boolean);
    
    return [...new Set(states)];
  };

  // Handle activity selection
  const handleActivitySelect = (activity: TeamLocation) => {
    // Map TeamLocation to Activity interface with all fields
    const mappedActivity = {
      ...activity,
      // Map name to user_name for consistency
      user_name: activity.name,
      user_email: activity.email,
      // Map country/state from region if not already present
      country: activity.country || detectCountryFromCoordinates(activity.latitude, activity.longitude),
      state: activity.state || detectStateFromCoordinates(activity.latitude, activity.longitude, activity.country || detectCountryFromCoordinates(activity.latitude, activity.longitude)),
    };
    setSelectedActivity(mappedActivity);
    
    // Center map on selected activity
    if (mapInstanceRef.current) {
      mapInstanceRef.current.setCenter({ 
        lat: activity.latitude, 
        lng: activity.longitude 
      });
      mapInstanceRef.current.setZoom(15);
    }
  };

  // Excel export functionality for admins
  const exportToExcel = useCallback(async () => {
    if (userRole !== 'admin') return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Get all locations for export
      const { data: locationsData, error } = await supabase
        .from('locations')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Get profiles data
      const userIds = [...new Set(locationsData?.map(loc => loc.user_id) || [])];
      const { data: profilesData } = await supabase
        .from('profiles')
        .select('user_id, first_name, last_name, email')
        .in('user_id', userIds);

      const profilesMap = new Map(profilesData?.map(p => [p.user_id, p]) || []);

      // Transform data for Excel
      const excelData = locationsData?.map(location => {
        const profile = profilesMap.get(location.user_id);
        return {
          'Usuario': profile ? `${profile.first_name || ''} ${profile.last_name || ''}`.trim() : 'Unknown',
          'Email Usuario': profile?.email || '',
          'Fecha': new Date(location.created_at).toLocaleDateString(),
          'Tipo de Actividad': location.visit_type || '',
          'Negocio': location.business_name || '',
          'Contacto': location.contact_person || '',
          'Email Contacto': location.email || '',
          'Teléfono': location.phone || '',
          'Notas': location.notes || '',
          'Dirección': location.address || '',
          'País': location.country || '',
          'Estado/Región': location.state || '',
          'Latitud': location.latitude,
          'Longitud': location.longitude,
        };
      }) || [];

      // Create workbook and worksheet
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(excelData);
      XLSX.utils.book_append_sheet(wb, ws, 'Actividades');

      // Generate filename with current date
      const filename = `actividades_equipo_${new Date().toISOString().split('T')[0]}.xlsx`;
      
      // Save file
      XLSX.writeFile(wb, filename);

      toast({
        title: 'Exportación completada',
        description: `Se han exportado ${excelData.length} actividades a Excel.`,
      });
    } catch (error) {
      console.error('Export error:', error);
      toast({
        variant: 'destructive',
        title: 'Error en exportación',
        description: 'No se pudo exportar los datos a Excel.',
      });
    }
  }, [userRole, toast]);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b bg-card">
        <div className="flex h-16 items-center px-6">
          <div className="flex items-center gap-2">
            <Users className="h-6 w-6 text-warning" />
            <h1 className="text-xl font-semibold text-warning">Actividades del Equipo</h1>
          </div>
          <div className="ml-auto flex items-center gap-4">
            {userRole === 'admin' && (
              <Button
                onClick={exportToExcel}
                variant="outline"
                size="sm"
                className="flex items-center gap-2"
              >
                <Download className="h-4 w-4" />
                Exportar Excel
              </Button>
            )}
            {isLoadingKey && !isMapLoaded && (
              <div className="flex items-center gap-2">
                <span className="text-sm">Cargando Google Maps...</span>
              </div>
            )}
            {isMapLoaded && (
              <div className="flex items-center gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <Activity className="h-4 w-4 text-warning" />
                  <span>{new Set(filteredLocations.map(l => l.user_id)).size} Miembros del Equipo</span>
                </div>
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-warning" />
                  <span>{filteredLocations.length} Actividades</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Filters */}
      {isMapLoaded && teamLocations.length > 0 && (
        <div className="border-b bg-card">
          <div className="px-6 py-4 space-y-4">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-warning" />
              <span className="text-sm font-medium">Filtros:</span>
            </div>
            
            {/* Mobile/Desktop responsive grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              <div className="space-y-1">
                <Label htmlFor="country-filter" className="text-xs font-medium">País</Label>
                <Select value={selectedCountry} onValueChange={setSelectedCountry}>
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue placeholder="Todos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="México">México</SelectItem>
                    <SelectItem value="Guatemala">Guatemala</SelectItem>
                    <SelectItem value="El Salvador">El Salvador</SelectItem>
                    <SelectItem value="Honduras">Honduras</SelectItem>
                    <SelectItem value="Costa Rica">Costa Rica</SelectItem>
                    <SelectItem value="Panamá">Panamá</SelectItem>
                    <SelectItem value="Colombia">Colombia</SelectItem>
                    <SelectItem value="Estados Unidos">Estados Unidos</SelectItem>
                    <SelectItem value="Canadá">Canadá</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {selectedCountry !== 'all' && (
                <div className="space-y-1">
                  <Label htmlFor="state-filter" className="text-xs font-medium">Región</Label>
                  <Select value={selectedState} onValueChange={setSelectedState}>
                    <SelectTrigger className="h-9 text-sm">
                      <SelectValue placeholder="Todas" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas</SelectItem>
                      {getUniqueStatesForMap().map(state => (
                        <SelectItem key={state} value={state}>
                          {state}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="space-y-1">
                <Label htmlFor="user-filter" className="text-xs font-medium">Usuario</Label>
                <Select value={selectedUser} onValueChange={setSelectedUser}>
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue placeholder="Todos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    {uniqueUsers.map(user => (
                      <SelectItem key={user.user_id} value={user.user_id}>
                        {user.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label htmlFor="visit-type-filter" className="text-xs font-medium">Tipo</Label>
                <Select value={selectedVisitType} onValueChange={setSelectedVisitType}>
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue placeholder="Todos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="Visita en Frío">Visita en Frío</SelectItem>
                    <SelectItem value="Negociación">Negociación</SelectItem>
                    <SelectItem value="Pre-entrega">Pre-entrega</SelectItem>
                    <SelectItem value="Técnica">Técnica</SelectItem>
                    <SelectItem value="Cortesía">Cortesía</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label htmlFor="date-from-filter" className="text-xs font-medium">Desde</Label>
                <Input
                  type="date"
                  value={selectedDateFrom}
                  onChange={(e) => setSelectedDateFrom(e.target.value)}
                  className="h-9 text-sm"
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="date-to-filter" className="text-xs font-medium">Hasta</Label>
                <Input
                  type="date"
                  value={selectedDateTo}
                  onChange={(e) => setSelectedDateTo(e.target.value)}
                  className="h-9 text-sm"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Map Container - Always rendered */}
      <div className="relative">
        <div ref={mapRef} className="h-[calc(100vh-4rem)] w-full bg-muted" />
        
        {(isLoadingKey || (!isMapLoaded && !isLoadingKey)) && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/80">
            <Card className="w-96">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MapPin className="h-5 w-5" />
                  Google Maps
                </CardTitle>
                <CardDescription>
                  {isLoadingKey ? 'Loading map configuration...' : isLoading ? 'Loading map...' : 'Setting up your sales team map'}
                </CardDescription>
              </CardHeader>
            </Card>
          </div>
        )}
        
        {/* Collapsible Team Panel */}
        {isMapLoaded && filteredLocations.length > 0 && (
          <div className={`absolute right-4 top-4 transition-all duration-300 ${isTeamPanelCollapsed ? 'w-12' : 'w-80'} max-h-[70vh]`}>
            <Collapsible open={!isTeamPanelCollapsed} onOpenChange={(open) => setIsTeamPanelCollapsed(!open)}>
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    {!isTeamPanelCollapsed && (
                      <div>
                        <CardTitle className="text-sm text-warning">Actividades del Equipo</CardTitle>
                        <CardDescription className="text-xs">
                          {filteredLocations.length} actividades encontradas
                        </CardDescription>
                      </div>
                    )}
                    <CollapsibleTrigger asChild>
                      <Button variant="ghost" size="sm">
                        {isTeamPanelCollapsed ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                      </Button>
                    </CollapsibleTrigger>
                  </div>
                </CardHeader>
                <CollapsibleContent>
                  <CardContent className="pt-0">
                    {selectedActivity ? (
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <h3 className="text-sm font-medium text-warning">Detalles de Actividad</h3>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={clearSelectedActivity}
                            className="text-xs"
                          >
                            Cerrar
                          </Button>
                        </div>
                        
                        <div className="p-3 bg-muted rounded-lg">
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex-1">
                              <p className="font-medium text-sm">{selectedActivity.name}</p>
                              <Badge variant="outline" className="text-xs mt-1">
                                {selectedActivity.visit_type}
                              </Badge>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                if (mapInstanceRef.current) {
                                  mapInstanceRef.current.setCenter({ 
                                    lat: selectedActivity.latitude, 
                                    lng: selectedActivity.longitude 
                                  });
                                  mapInstanceRef.current.setZoom(15);
                                }
                              }}
                            >
                              <MapPin className="h-4 w-4" />
                            </Button>
                          </div>
                          
                          {selectedActivity.business_name && (
                            <p className="text-xs text-muted-foreground">
                              <strong>Negocio:</strong> {selectedActivity.business_name}
                            </p>
                          )}
                          {selectedActivity.contact_person && (
                            <p className="text-xs text-muted-foreground">
                              <strong>Contacto:</strong> {selectedActivity.contact_person}
                            </p>
                          )}
                          {selectedActivity.contact_email && (
                            <p className="text-xs text-muted-foreground">
                              <strong>Email:</strong> {selectedActivity.contact_email}
                            </p>
                          )}
                          {selectedActivity.phone && (
                            <p className="text-xs text-muted-foreground">
                              <strong>Teléfono:</strong> {selectedActivity.phone}
                            </p>
                          )}
                          
                          <p className="text-xs text-muted-foreground mt-2">
                            {new Date(selectedActivity.created_at).toLocaleDateString()}
                          </p>
                          {selectedActivity.region && (
                            <p className="text-xs text-muted-foreground">
                              {selectedActivity.region}
                            </p>
                          )}
                          {selectedActivity.notes && (
                            <p className="text-xs text-muted-foreground mt-1">
                              <strong>Notas:</strong> {selectedActivity.notes}
                            </p>
                          )}
                          
                          <div className="mt-3">
                            <ActivityMediaDisplay activityId={selectedActivity.id} />
                          </div>
                        </div>
                      </div>
                    ) : (
                      <ScrollArea className="max-h-[50vh]">
                        <div className="space-y-3 pr-4">
                          {filteredLocations
                            .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
                            .map((location) => (
                            <div 
                              key={location.id} 
                              className="p-3 bg-muted rounded-lg cursor-pointer hover:bg-muted/80 transition-colors"
                              onClick={() => handleActivitySelect(location)}
                            >
                              <div className="flex items-start justify-between mb-2">
                                <div className="flex-1">
                                  <p className="font-medium text-sm">{location.name}</p>
                                  <Badge variant="outline" className="text-xs mt-1">
                                    {location.visit_type}
                                  </Badge>
                                </div>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (mapInstanceRef.current) {
                                      mapInstanceRef.current.setCenter({ 
                                        lat: location.latitude, 
                                        lng: location.longitude 
                                      });
                                      mapInstanceRef.current.setZoom(15);
                                    }
                                  }}
                                >
                                  <MapPin className="h-4 w-4" />
                                </Button>
                              </div>
                              
                              {location.business_name && (
                                <p className="text-xs text-muted-foreground">
                                  <strong>Negocio:</strong> {location.business_name}
                                </p>
                              )}
                              {location.contact_person && (
                                <p className="text-xs text-muted-foreground">
                                  <strong>Contacto:</strong> {location.contact_person}
                                </p>
                              )}
                              {location.contact_email && (
                                <p className="text-xs text-muted-foreground">
                                  <strong>Email:</strong> {location.contact_email}
                                </p>
                              )}
                              {location.phone && (
                                <p className="text-xs text-muted-foreground">
                                  <strong>Teléfono:</strong> {location.phone}
                                </p>
                              )}
                              
                              <p className="text-xs text-muted-foreground mt-2">
                                {new Date(location.created_at).toLocaleDateString()}
                              </p>
                              {location.region && (
                                <p className="text-xs text-muted-foreground">
                                  {location.region}
                                </p>
                              )}
                              {location.notes && (
                                <p className="text-xs text-muted-foreground mt-1">
                                  <strong>Notas:</strong> {location.notes}
                                </p>
                              )}
                              
                              <div className="mt-3">
                                <ActivityMediaDisplay activityId={location.id} />
                              </div>
                            </div>
                          ))}
                        </div>
                      </ScrollArea>
                    )}
                  </CardContent>
                </CollapsibleContent>
              </Card>
            </Collapsible>
          </div>
        )}
      </div>
    </div>
  );
};

export default GoogleMapComponent;
