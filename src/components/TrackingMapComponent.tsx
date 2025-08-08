import React, { useEffect, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { loadGoogleMaps } from '@/lib/googleMapsLoader';

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

interface TrackingMapComponentProps {
  trackingData: TrackingData[];
  mapCenter?: {lat: number, lng: number, id: string} | null;
}

const TrackingMapComponent = ({ trackingData, mapCenter }: TrackingMapComponentProps) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const [map, setMap] = useState<google.maps.Map | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const markersRef = useRef<google.maps.Marker[]>([]);
  const markersByIdRef = useRef<Map<string, google.maps.Marker>>(new Map());
  const [markersVersion, setMarkersVersion] = useState(0);

  useEffect(() => {
    initializeMap();
  }, []);

  useEffect(() => {
    console.log('[TrackingMap] Component received data:', trackingData.length, 'locations');
    console.log('[TrackingMap] MapCenter:', mapCenter);
    
    if (map) {
      // Show only the selected location if mapCenter is provided
      if (mapCenter) {
        const selectedLocation = trackingData.find(location => location.id === mapCenter.id);
        if (selectedLocation) {
          console.log('[TrackingMap] Showing only selected location:', selectedLocation);
          updateMarkersForSelectedLocation(selectedLocation);
        }
      } else {
        console.log('[TrackingMap] No location selected, clearing all markers');
        clearAllMarkers();
      }
    }
  }, [map, trackingData, mapCenter]);

  useEffect(() => {
    if (!map || !mapCenter) return;
    
    console.log('[TrackingMap] Centering map on location:', mapCenter);
    
    const position = { lat: mapCenter.lat, lng: mapCenter.lng };
    map.panTo(position);
    map.setZoom(15);
    
    // Find and trigger click on the corresponding marker
    const marker = markersByIdRef.current.get(mapCenter.id);
    if (marker) {
      google.maps.event.trigger(marker, 'click');
    }
  }, [map, mapCenter]);

  const initializeMap = async () => {
    try {
      setLoading(true);
      setError(null);

      console.log('[TrackingMap] Initializing Google Maps...');

      // Wait for DOM to be ready
      await new Promise(resolve => setTimeout(resolve, 100));

      if (!mapRef.current) {
        console.error('[TrackingMap] Map container not found in DOM');
        throw new Error('Map container not available');
      }

      // Load Google Maps API using shared loader
      await loadGoogleMaps();
      console.log('[TrackingMap] Google Maps API loaded successfully');

      // Multi-country center for Central America + Mexico region
      // Positioned to show Mexico, Guatemala, El Salvador, Honduras optimally
      const regionalCenter = { lat: 18.5, lng: -88.0 };

      // Initialize map
      const mapInstance = new google.maps.Map(mapRef.current, {
        zoom: 5,
        center: regionalCenter,
        mapTypeId: google.maps.MapTypeId.ROADMAP,
        styles: [
          {
            featureType: 'poi',
            elementType: 'labels',
            stylers: [{ visibility: 'off' }]
          }
        ]
      });

      console.log('[TrackingMap] Map initialized successfully');
      setMap(mapInstance);
      setLoading(false);
    } catch (err) {
      console.error('[TrackingMap] Error initializing map:', err);
      setError(`Error loading map: ${err instanceof Error ? err.message : 'Unknown error'}`);
      setLoading(false);
    }
  };

  const clearAllMarkers = () => {
    console.log('[TrackingMap] Clearing all markers');
    markersRef.current.forEach(marker => marker.setMap(null));
    markersRef.current = [];
    markersByIdRef.current.clear();
  };

  const updateMarkersForSelectedLocation = (location: TrackingData) => {
    if (!map) {
      console.log('[TrackingMap] Map not available for marker update');
      return;
    }

    console.log('[TrackingMap] Updating markers for selected location:', location);

    // Clear existing markers
    clearAllMarkers();

    try {
      const position = {
        lat: Number(location.latitude),
        lng: Number(location.longitude)
      };

      // Validate coordinates
      if (isNaN(position.lat) || isNaN(position.lng)) {
        console.error('[TrackingMap] Invalid coordinates for location:', location);
        return;
      }

      // Create custom marker icon
      const markerIcon = {
        path: google.maps.SymbolPath.CIRCLE,
        fillColor: '#FF6B6B',
        fillOpacity: 0.8,
        strokeColor: '#FFFFFF',
        strokeWeight: 2,
        scale: 10
      };

      const marker = new google.maps.Marker({
        position,
        map,
        icon: markerIcon,
        title: `${location.user_email} - ${new Date(location.created_at).toLocaleString('es-ES')}`
      });

      console.log('[TrackingMap] Selected location marker created successfully at:', position);

      // Create info window
      const displayAddress = location.address || 'Ubicación automática';
      const infoWindow = new google.maps.InfoWindow({
        content: `
          <div style="max-width: 250px;">
            <h3 style="margin: 0 0 8px 0; color: #333; font-size: 14px; font-weight: bold;">
              📍 ${location.user_email || 'Usuario'}
            </h3>
            <p style="margin: 4px 0; font-size: 12px; color: #666;">
              <strong>Fecha:</strong> ${new Date(location.created_at).toLocaleString('es-ES')}
            </p>
            <p style="margin: 4px 0; font-size: 12px; color: #666;">
              <strong>Dirección:</strong> ${displayAddress}
            </p>
            ${location.country || location.state ? `
              <p style="margin: 4px 0; font-size: 12px; color: #666;">
                <strong>Región:</strong> ${location.country || 'No disponible'}${location.state ? ` - ${location.state}` : ''}
              </p>
            ` : ''}
            <p style="margin: 4px 0; font-size: 11px; color: #888;">
              ${location.latitude.toFixed(6)}, ${location.longitude.toFixed(6)}
            </p>
          </div>
        `
      });

      marker.addListener('click', () => {
        infoWindow.open(map, marker);
      });

      // Auto-open the info window for selected location
      infoWindow.open(map, marker);

      markersRef.current.push(marker);
      markersByIdRef.current.set(location.id, marker);

      // Center map on the selected location
      map.setCenter(position);
      map.setZoom(15);

      console.log('[TrackingMap] Map centered on selected location');
    } catch (error) {
      console.error('[TrackingMap] Error creating marker for selected location:', location, error);
    }
  };

  if (loading) {
    return (
      <div className="h-96 flex items-center justify-center bg-muted/50">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">Cargando mapa...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-96 flex items-center justify-center bg-muted/50">
        <div className="text-center">
          <p className="text-sm text-muted-foreground">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative">
      <div ref={mapRef} className="h-96 w-full rounded-lg" />
      {!mapCenter && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/80 rounded-lg">
          <p className="text-muted-foreground">Selecciona una ubicación del historial para mostrarla en el mapa</p>
        </div>
      )}
      {/* Debug info overlay - only visible in development */}
      {process.env.NODE_ENV === 'development' && (
        <div className="absolute top-2 left-2 bg-background/90 text-xs p-2 rounded border z-10">
          <div>📍 {markersRef.current.length} marcadores activos</div>
          <div>🎯 {mapCenter ? 'Ubicación seleccionada' : 'Sin selección'}</div>
          <div>📊 {trackingData.length} ubicaciones disponibles</div>
        </div>
      )}
    </div>
  );
};

export default TrackingMapComponent;