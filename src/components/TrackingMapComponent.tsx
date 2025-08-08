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
    console.log('[TrackingMap] Data breakdown:', {
      total: trackingData.length,
      withAddress: trackingData.filter(d => d.address && d.address !== 'Ubicación automática').length,
      autoLocation: trackingData.filter(d => !d.address || d.address === 'Ubicación automática').length,
      countries: [...new Set(trackingData.map(d => d.country).filter(Boolean))],
      users: [...new Set(trackingData.map(d => d.user_email).filter(Boolean))]
    });

    if (map && trackingData.length > 0) {
      updateMarkers();
    } else if (map && trackingData.length === 0) {
      console.log('[TrackingMap] No data to display, clearing markers');
      markersRef.current.forEach(marker => marker.setMap(null));
      markersRef.current = [];
      markersByIdRef.current.clear();
    }
  }, [map, trackingData]);

  useEffect(() => {
    if (!map || !mapCenter) return;
    
    console.log('[TrackingMap] Centering map on location:', mapCenter);
    
    const position = { lat: mapCenter.lat, lng: mapCenter.lng };
    map.panTo(position);
    
    // Set appropriate zoom level
    if ((map.getZoom() || 0) < 15) {
      map.setZoom(15);
    }
    
    // Find and trigger click on the corresponding marker
    const marker = markersByIdRef.current.get(mapCenter.id);
    if (marker) {
      google.maps.event.trigger(marker, 'click');
    }
  }, [map, mapCenter, markersVersion]);

  const initializeMap = async () => {
    try {
      setLoading(true);
      setError(null);

      console.log('[TrackingMap] Initializing Google Maps...');

      // Load Google Maps API using shared loader
      await loadGoogleMaps();
      console.log('[TrackingMap] Google Maps API loaded successfully');

      if (!mapRef.current) {
        console.error('[TrackingMap] Map container not found');
        return;
      }

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

      console.log('[TrackingMap] Map initialized with regional center:', regionalCenter);
      setMap(mapInstance);
      setLoading(false);
    } catch (err) {
      console.error('Error initializing tracking map:', err);
      setError('Error loading map. Please try again.');
      setLoading(false);
    }
  };

  const updateMarkers = () => {
    if (!map) {
      console.log('[TrackingMap] Map not available for marker update');
      return;
    }

    console.log('[TrackingMap] Updating markers with', trackingData.length, 'locations');

    // Clear existing markers
    markersRef.current.forEach(marker => marker.setMap(null));
    markersRef.current = [];
    markersByIdRef.current.clear();

    if (trackingData.length === 0) {
      console.log('[TrackingMap] No tracking data available');
      return;
    }

    const bounds = new google.maps.LatLngBounds();
    const userColors: { [key: string]: string } = {};
    const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FECA57', '#FF9FF3', '#54A0FF'];
    let colorIndex = 0;
    let successfulMarkers = 0;
    let failedMarkers = 0;

    trackingData.forEach((location, index) => {
      try {
        console.log(`[TrackingMap] Creating marker ${index + 1}/${trackingData.length}:`, {
          id: location.id,
          lat: location.latitude,
          lng: location.longitude,
          address: location.address || 'Ubicación automática',
          user: location.user_email
        });

        // Assign a unique color to each user
        if (!userColors[location.user_id]) {
          userColors[location.user_id] = colors[colorIndex % colors.length];
          colorIndex++;
        }

        const position = {
          lat: Number(location.latitude),
          lng: Number(location.longitude)
        };

        // Validate coordinates
        if (isNaN(position.lat) || isNaN(position.lng)) {
          console.error('[TrackingMap] Invalid coordinates for location:', location);
          failedMarkers++;
          return;
        }

        // Validate coordinate ranges for the region
        const isValidRegion = position.lat >= 10 && position.lat <= 35 && 
                             position.lng >= -120 && position.lng <= -75;
        
        if (!isValidRegion) {
          console.warn('[TrackingMap] Coordinates outside expected region:', position);
        }

        // Create custom marker icon with user color
        const markerIcon = {
          path: google.maps.SymbolPath.CIRCLE,
          fillColor: userColors[location.user_id],
          fillOpacity: 0.8,
          strokeColor: '#FFFFFF',
          strokeWeight: 2,
          scale: 8
        };

        const marker = new google.maps.Marker({
          position,
          map,
          icon: markerIcon,
          title: `${location.user_email} - ${new Date(location.created_at).toLocaleString('es-ES')}`
        });

        console.log(`[TrackingMap] Marker ${index + 1} created successfully at:`, position);
        successfulMarkers++;

        // Create info window with better handling of empty data
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

        markersRef.current.push(marker);
        markersByIdRef.current.set(location.id, marker);
        bounds.extend(position);
      } catch (error) {
        console.error('[TrackingMap] Error creating marker for location:', location, error);
        failedMarkers++;
      }
    });

    console.log(`[TrackingMap] Marker creation complete - Success: ${successfulMarkers}, Failed: ${failedMarkers}, Total: ${markersRef.current.length}`);

    // Fit map to show all markers with intelligent zoom
    if (markersRef.current.length > 0) {
      if (trackingData.length > 1) {
        console.log('[TrackingMap] Fitting bounds for multiple markers');
        map.fitBounds(bounds);
        const listener = google.maps.event.addListener(map, 'idle', () => {
          const currentZoom = map.getZoom() || 0;
          // Limit max zoom for better overview when showing multiple locations
          if (currentZoom > 15) {
            map.setZoom(15);
          }
          // Ensure minimum zoom for readability
          if (currentZoom < 4) {
            map.setZoom(6);
          }
          google.maps.event.removeListener(listener);
        });
      } else if (trackingData.length === 1) {
        console.log('[TrackingMap] Centering on single marker');
        map.setCenter({
          lat: Number(trackingData[0].latitude),
          lng: Number(trackingData[0].longitude)
        });
        map.setZoom(14);
      }
    } else {
      console.warn('[TrackingMap] No markers were created successfully');
    }
    
    // Notify that markers have been updated
    setMarkersVersion((v) => v + 1);
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
      {trackingData.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/80 rounded-lg">
          <p className="text-muted-foreground">No hay datos de seguimiento para mostrar</p>
        </div>
      )}
      {/* Debug info overlay - only visible in development */}
      {process.env.NODE_ENV === 'development' && trackingData.length > 0 && (
        <div className="absolute top-2 left-2 bg-background/90 text-xs p-2 rounded border z-10">
          <div>📍 {markersRef.current.length} marcadores activos</div>
          <div>📊 {trackingData.length} ubicaciones recibidas</div>
        </div>
      )}
    </div>
  );
};

export default TrackingMapComponent;