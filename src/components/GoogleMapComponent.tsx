
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Loader } from '@googlemaps/js-api-loader';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { MapPin, Users, Activity } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

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
}

const GoogleMapComponent = () => {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<Map<string, google.maps.Marker>>(new Map());
  const [isMapLoaded, setIsMapLoaded] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingKey, setIsLoadingKey] = useState(true);
  const [teamLocations, setTeamLocations] = useState<TeamLocation[]>([]);
  const { userRole } = useAuth();

  const loadMap = useCallback(async (key: string) => {
    console.log('loadMap called with key:', key ? 'API key provided' : 'No API key');
    if (!mapRef.current || !key || isLoading) {
      console.log('loadMap early return:', { mapRef: !!mapRef.current, key: !!key, isLoading });
      return;
    }

    setIsLoading(true);

    try {
      const loader = new Loader({
        apiKey: key,
        version: 'weekly',
        libraries: ['places']
      });

      await loader.load();

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
      console.log('Map loaded successfully');
    } catch (error) {
      console.error('Error loading Google Maps:', error);
    } finally {
      setIsLoading(false);
    }
  }, [isLoading]);

  // Fetch Google Maps API key from Supabase edge function
  const fetchGoogleMapsKey = useCallback(async () => {
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
        return {
          id: location.id,
          user_id: location.user_id,
          name: profile 
            ? `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || 'Unknown User'
            : 'Unknown User',
          email: profile?.email || '',
          latitude: Number(location.latitude),
          longitude: Number(location.longitude),
          visit_type: location.visit_type || 'check_in',
          notes: location.notes || '',
          created_at: location.created_at,
          address: location.address || ''
        };
      });

      setTeamLocations(transformedLocations);
    } catch (error) {
      console.error('Error fetching locations:', error);
    }
  }, [userRole]);

  // Update markers on the map
  const updateMapMarkers = useCallback(() => {
    if (!mapInstanceRef.current || !isMapLoaded) return;

    // Clear existing markers
    markersRef.current.forEach(marker => marker.setMap(null));
    markersRef.current.clear();

    // Get latest location for each user
    const latestLocations = new Map<string, TeamLocation>();
    teamLocations.forEach(location => {
      const existing = latestLocations.get(location.user_id);
      if (!existing || new Date(location.created_at) > new Date(existing.created_at)) {
        latestLocations.set(location.user_id, location);
      }
    });

    // Add markers for latest locations
    latestLocations.forEach((location) => {
      const marker = new google.maps.Marker({
        position: { lat: location.latitude, lng: location.longitude },
        map: mapInstanceRef.current,
        title: location.name,
        icon: {
          url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(`
            <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="16" cy="16" r="15" fill="#3B82F6" stroke="white" stroke-width="2"/>
              <circle cx="16" cy="16" r="8" fill="white"/>
              <circle cx="16" cy="16" r="4" fill="#3B82F6"/>
            </svg>
          `),
          scaledSize: new google.maps.Size(32, 32)
        }
      });

      const infoWindow = new google.maps.InfoWindow({
        content: `
          <div class="p-3 min-w-[200px]">
            <h3 class="font-semibold text-base">${location.name}</h3>
            <p class="text-sm text-gray-600 mb-1">Visit Type: ${location.visit_type.replace('_', ' ')}</p>
            ${location.notes ? `<p class="text-sm text-gray-600 mb-1">Notes: ${location.notes}</p>` : ''}
            ${location.address ? `<p class="text-sm text-gray-600 mb-1">Address: ${location.address}</p>` : ''}
            <p class="text-xs text-gray-500">Last update: ${new Date(location.created_at).toLocaleString()}</p>
          </div>
        `
      });

      marker.addListener('click', () => {
        infoWindow.open(mapInstanceRef.current, marker);
      });

      markersRef.current.set(location.id, marker);
    });

    // Center map on team locations if available
    if (latestLocations.size > 0) {
      const bounds = new google.maps.LatLngBounds();
      latestLocations.forEach(location => {
        bounds.extend({ lat: location.latitude, lng: location.longitude });
      });
      mapInstanceRef.current.fitBounds(bounds);
      
      // Don't zoom too much for single location
      if (latestLocations.size === 1) {
        setTimeout(() => {
          if (mapInstanceRef.current && mapInstanceRef.current.getZoom()! > 15) {
            mapInstanceRef.current.setZoom(15);
          }
        }, 100);
      }
    }
  }, [teamLocations, isMapLoaded]);


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
          console.log('Location updated, refreshing...');
          fetchLocations();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [isMapLoaded, fetchLocations]);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b bg-card">
        <div className="flex h-16 items-center px-6">
          <div className="flex items-center gap-2">
            <Users className="h-6 w-6 text-primary" />
            <h1 className="text-xl font-semibold">Sales Team Tracker</h1>
          </div>
          <div className="ml-auto flex items-center gap-4">
            {isLoadingKey && !isMapLoaded && (
              <div className="flex items-center gap-2">
                <span className="text-sm">Loading Google Maps...</span>
              </div>
            )}
            {isMapLoaded && (
              <div className="flex items-center gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <Activity className="h-4 w-4 text-blue-500" />
                  <span>{new Set(teamLocations.map(l => l.user_id)).size} Team Members</span>
                </div>
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-green-500" />
                  <span>{teamLocations.length} Locations</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

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
        
        {/* Team Panel */}
        {isMapLoaded && teamLocations.length > 0 && (
          <div className="absolute right-4 top-4 w-80 max-h-[80vh] overflow-y-auto">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Team Locations</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {Array.from(new Map(teamLocations.map(loc => [loc.user_id, loc])).values())
                  .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
                  .map((location) => (
                  <div key={location.id} className="flex items-start justify-between p-3 bg-muted rounded-lg">
                    <div className="flex items-start gap-3 flex-1">
                      <div className="w-3 h-3 rounded-full bg-blue-500 mt-1" />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{location.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {location.visit_type.replace('_', ' ')}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(location.created_at).toLocaleString()}
                        </p>
                        {location.notes && (
                          <p className="text-xs text-muted-foreground mt-1 truncate">
                            {location.notes}
                          </p>
                        )}
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
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
                ))}
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
};

export default GoogleMapComponent;
