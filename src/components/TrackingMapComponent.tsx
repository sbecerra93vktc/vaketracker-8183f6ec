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
  selectedLocationId?: string | null;
}

const TrackingMapComponent = ({ trackingData, selectedLocationId }: TrackingMapComponentProps) => {
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
    console.log('TrackingMapComponent received data:', trackingData);
    if (map && trackingData.length > 0) {
      updateMarkers();
    }
  }, [map, trackingData]);

  useEffect(() => {
    if (!map || !selectedLocationId) return;
    const marker = markersByIdRef.current.get(selectedLocationId);
    if (marker) {
      const pos = marker.getPosition();
      if (pos) {
        map.panTo(pos);
        if ((map.getZoom() || 0) < 15) {
          map.setZoom(15);
        }
        google.maps.event.trigger(marker, 'click');
      }
    } else {
      console.warn('Selected marker not found for id', selectedLocationId);
    }
  }, [map, selectedLocationId, trackingData, markersVersion]);

  const initializeMap = async () => {
    try {
      setLoading(true);
      setError(null);

      // Load Google Maps API using shared loader
      await loadGoogleMaps();

      if (!mapRef.current) return;

      // Initialize map
      const mapInstance = new google.maps.Map(mapRef.current, {
        zoom: 6,
        center: { lat: 15.783471, lng: -90.230759 }, // Guatemala center
        mapTypeId: google.maps.MapTypeId.ROADMAP,
        styles: [
          {
            featureType: 'poi',
            elementType: 'labels',
            stylers: [{ visibility: 'off' }]
          }
        ]
      });

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
      console.log('Map not available for marker update');
      return;
    }

    console.log('Updating markers with', trackingData.length, 'locations');

    // Clear existing markers
    markersRef.current.forEach(marker => marker.setMap(null));
    markersRef.current = [];
    markersByIdRef.current.clear();

    if (trackingData.length === 0) {
      console.log('No tracking data available');
      return;
    }

    const bounds = new google.maps.LatLngBounds();
    const userColors: { [key: string]: string } = {};
    const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FECA57', '#FF9FF3', '#54A0FF'];
    let colorIndex = 0;

    trackingData.forEach((location, index) => {
      try {
        console.log(`Creating marker ${index + 1}:`, {
          lat: location.latitude,
          lng: location.longitude,
          address: location.address
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
          console.error('Invalid coordinates for location:', location);
          return;
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

        console.log('Marker created successfully at:', position);

        // Create info window
        const infoWindow = new google.maps.InfoWindow({
          content: `
            <div style="max-width: 250px;">
              <h3 style="margin: 0 0 8px 0; color: #333; font-size: 14px; font-weight: bold;">
                📍 ${location.user_email}
              </h3>
              <p style="margin: 4px 0; font-size: 12px; color: #666;">
                <strong>Fecha:</strong> ${new Date(location.created_at).toLocaleString('es-ES')}
              </p>
              <p style="margin: 4px 0; font-size: 12px; color: #666;">
                <strong>Dirección:</strong> ${location.address}
              </p>
              ${location.country || location.state ? `
                <p style="margin: 4px 0; font-size: 12px; color: #666;">
                  <strong>Región:</strong> ${location.country}${location.state ? ` - ${location.state}` : ''}
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
        console.error('Error creating marker for location:', location, error);
      }
    });

    console.log('Created', markersRef.current.length, 'markers total');

    // Fit map to show all markers
    if (markersRef.current.length > 0) {
      if (trackingData.length > 1) {
        console.log('Fitting bounds for multiple markers');
        map.fitBounds(bounds);
        const listener = google.maps.event.addListener(map, 'idle', () => {
          if (map.getZoom()! > 15) map.setZoom(15);
          google.maps.event.removeListener(listener);
        });
      } else if (trackingData.length === 1) {
        console.log('Centering on single marker');
        map.setCenter({
          lat: Number(trackingData[0].latitude),
          lng: Number(trackingData[0].longitude)
        });
        map.setZoom(14);
      }
    } else {
      console.warn('No markers were created successfully');
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
    </div>
  );
};

export default TrackingMapComponent;