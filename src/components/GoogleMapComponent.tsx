
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Loader } from '@googlemaps/js-api-loader';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { MapPin, Users, Activity } from 'lucide-react';

interface SalespersonLocation {
  id: string;
  name: string;
  position: google.maps.LatLngLiteral;
  lastUpdate: Date;
  status: 'active' | 'inactive';
}

const GoogleMapComponent = () => {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<google.maps.Map | null>(null);
  const [apiKey, setApiKey] = useState(localStorage.getItem('googleMapsApiKey') || 'AIzaSyAaEryMg0sJr-arokWRfITVg2WHs3jPTSc');
  const [isMapLoaded, setIsMapLoaded] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [salespeople, setSalespeople] = useState<SalespersonLocation[]>([
    {
      id: '1',
      name: 'John Smith',
      position: { lat: 40.7128, lng: -74.0060 },
      lastUpdate: new Date(),
      status: 'active'
    },
    {
      id: '2',
      name: 'Sarah Johnson',
      position: { lat: 40.7589, lng: -73.9851 },
      lastUpdate: new Date(),
      status: 'active'
    },
    {
      id: '3',
      name: 'Mike Davis',
      position: { lat: 40.7505, lng: -73.9934 },
      lastUpdate: new Date(),
      status: 'inactive'
    }
  ]);

  const loadMap = useCallback(async (key: string) => {
    console.log('loadMap called with key:', key ? 'provided' : 'missing');
    console.log('mapRef.current:', mapRef.current);
    
    if (!mapRef.current || !key) {
      console.log('Early return - missing mapRef or key');
      return;
    }

    if (isLoading) {
      console.log('Map is already loading, skipping...');
      return;
    }

    setIsLoading(true);

    try {
      console.log('Creating Google Maps loader...');
      const loader = new Loader({
        apiKey: key,
        version: 'weekly',
        libraries: ['places']
      });

      console.log('Loading Google Maps API...');
      await loader.load();
      console.log('Google Maps API loaded successfully');

      console.log('Creating map instance...');
      const map = new google.maps.Map(mapRef.current, {
        zoom: 12,
        center: { lat: 40.7128, lng: -74.0060 }, // New York City
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
      console.log('Map instance created');

      // Add markers for each salesperson
      console.log('Adding markers for', salespeople.length, 'salespeople');
      salespeople.forEach((person) => {
        const marker = new google.maps.Marker({
          position: person.position,
          map: map,
          title: person.name,
          icon: {
            url: person.status === 'active' 
              ? 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(`
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <circle cx="12" cy="12" r="10" fill="#10B981"/>
                  <circle cx="12" cy="12" r="6" fill="white"/>
                  <circle cx="12" cy="12" r="3" fill="#10B981"/>
                </svg>
              `)
              : 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(`
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <circle cx="12" cy="12" r="10" fill="#EF4444"/>
                  <circle cx="12" cy="12" r="6" fill="white"/>
                  <circle cx="12" cy="12" r="3" fill="#EF4444"/>
                </svg>
              `),
            scaledSize: new google.maps.Size(24, 24)
          }
        });

        const infoWindow = new google.maps.InfoWindow({
          content: `
            <div class="p-2">
              <h3 class="font-semibold">${person.name}</h3>
              <p class="text-sm text-gray-600">Status: ${person.status}</p>
              <p class="text-xs text-gray-500">Last update: ${person.lastUpdate.toLocaleTimeString()}</p>
            </div>
          `
        });

        marker.addListener('click', () => {
          infoWindow.open(map, marker);
        });
      });

      console.log('Setting isMapLoaded to true');
      setIsMapLoaded(true);
    } catch (error) {
      console.error('Error loading Google Maps:', error);
      console.error('Error details:', error);
    } finally {
      setIsLoading(false);
    }
  }, [salespeople, isLoading]);

  const handleApiKeySubmit = () => {
    console.log('handleApiKeySubmit called');
    if (apiKey) {
      localStorage.setItem('googleMapsApiKey', apiKey);
      setIsMapLoaded(false); // Reset map loaded state
      loadMap(apiKey);
    }
  };

  useEffect(() => {
    console.log('useEffect triggered, apiKey:', apiKey ? 'present' : 'missing');
    console.log('mapRef.current in useEffect:', mapRef.current);
    
    // Only auto-load if we have an API key and haven't loaded the map yet
    if (apiKey && !isMapLoaded && !isLoading) {
      // Use a longer delay and also check if the ref is available
      const checkAndLoad = () => {
        console.log('checkAndLoad - mapRef.current:', mapRef.current);
        if (mapRef.current) {
          loadMap(apiKey);
        } else {
          // If ref is still not available, try again in a bit
          setTimeout(checkAndLoad, 100);
        }
      };
      
      const timer = setTimeout(checkAndLoad, 200);
      return () => clearTimeout(timer);
    }
  }, [apiKey, isMapLoaded, isLoading, loadMap]);

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
            {!isMapLoaded && (
              <div className="flex items-center gap-2">
                <Input
                  type="password"
                  placeholder="Enter Google Maps API Key"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  className="w-64"
                />
                <Button 
                  onClick={handleApiKeySubmit} 
                  disabled={isLoading}
                >
                  {isLoading ? 'Loading...' : 'Load Map'}
                </Button>
              </div>
            )}
            {isMapLoaded && (
              <>
                <div className="flex items-center gap-2 text-sm">
                  <Activity className="h-4 w-4 text-green-500" />
                  <span>{salespeople.filter(p => p.status === 'active').length} Active</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Activity className="h-4 w-4 text-red-500" />
                  <span>{salespeople.filter(p => p.status === 'inactive').length} Inactive</span>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Map Container - Always rendered */}
      <div className="relative">
        <div ref={mapRef} className="h-[calc(100vh-4rem)] w-full bg-muted" />
        
        {!isMapLoaded && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/80">
            <Card className="w-96">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MapPin className="h-5 w-5" />
                  Google Maps Setup
                </CardTitle>
                <CardDescription>
                  {isLoading ? 'Loading map...' : 'Enter your Google Maps API key to start tracking your sales team'}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-xs text-muted-foreground">
                  Get your API key from the{' '}
                  <a 
                    href="https://console.cloud.google.com/google/maps-apis" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-primary hover:underline"
                  >
                    Google Cloud Console
                  </a>
                </p>
              </CardContent>
            </Card>
          </div>
        )}
        
        {/* Team Panel */}
        {isMapLoaded && (
          <div className="absolute right-4 top-4 w-80">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Team Status</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {salespeople.map((person) => (
                  <div key={person.id} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className={`w-3 h-3 rounded-full ${
                        person.status === 'active' ? 'bg-green-500' : 'bg-red-500'
                      }`} />
                      <div>
                        <p className="font-medium text-sm">{person.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {person.lastUpdate.toLocaleTimeString()}
                        </p>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        if (mapInstanceRef.current) {
                          mapInstanceRef.current.setCenter(person.position);
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
