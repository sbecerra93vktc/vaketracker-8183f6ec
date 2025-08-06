import React, { useEffect, useRef, useState } from 'react';
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
  const [apiKey, setApiKey] = useState(localStorage.getItem('googleMapsApiKey') || '');
  const [isMapLoaded, setIsMapLoaded] = useState(false);
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

  const loadMap = async (key: string) => {
    if (!mapRef.current || !key) return;

    try {
      const loader = new Loader({
        apiKey: key,
        version: 'weekly',
        libraries: ['places']
      });

      await loader.load();

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

      // Add markers for each salesperson
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

      setIsMapLoaded(true);
    } catch (error) {
      console.error('Error loading Google Maps:', error);
    }
  };

  const handleApiKeySubmit = () => {
    if (apiKey) {
      localStorage.setItem('googleMapsApiKey', apiKey);
      loadMap(apiKey);
    }
  };

  useEffect(() => {
    if (apiKey) {
      loadMap(apiKey);
    }
  }, []);

  if (!apiKey || !isMapLoaded) {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="max-w-md mx-auto mt-20">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MapPin className="h-5 w-5" />
                Google Maps Setup
              </CardTitle>
              <CardDescription>
                Enter your Google Maps API key to start tracking your sales team
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Input
                  type="password"
                  placeholder="Enter Google Maps API Key"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                />
              </div>
              <Button onClick={handleApiKeySubmit} className="w-full">
                Load Map
              </Button>
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
      </div>
    );
  }

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
            <div className="flex items-center gap-2 text-sm">
              <Activity className="h-4 w-4 text-green-500" />
              <span>{salespeople.filter(p => p.status === 'active').length} Active</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Activity className="h-4 w-4 text-red-500" />
              <span>{salespeople.filter(p => p.status === 'inactive').length} Inactive</span>
            </div>
          </div>
        </div>
      </div>

      {/* Map Container */}
      <div className="relative">
        <div ref={mapRef} className="h-[calc(100vh-4rem)] w-full" />
        
        {/* Team Panel */}
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
      </div>
    </div>
  );
};

export default GoogleMapComponent;