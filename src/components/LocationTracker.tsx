import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { MapPin, Clock, Play, Square } from 'lucide-react';

const LocationTracker = () => {
  const [isTracking, setIsTracking] = useState(false);
  const [lastLocation, setLastLocation] = useState<{
    latitude: number;
    longitude: number;
    timestamp: string;
  } | null>(null);
  const [intervalId, setIntervalId] = useState<NodeJS.Timeout | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    // Check if tracking was already active
    const trackingState = localStorage.getItem('locationTracking');
    if (trackingState === 'active') {
      startTracking();
    }

    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, []);

  const getCurrentLocation = (): Promise<{latitude: number, longitude: number}> => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Geolocation not supported'));
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          resolve({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude
          });
        },
        (error) => {
          reject(error);
        },
        {
          enableHighAccuracy: true,
          timeout: 15000,
          maximumAge: 0,
        }
      );
    });
  };

  const saveTrackingLocation = async (location: {latitude: number, longitude: number}) => {
    try {
      // Get address from coordinates
      let address = '';
      let country = '';
      let state = '';
      
      try {
        const response = await fetch(
          `https://api.opencagedata.com/geocode/v1/json?q=${location.latitude}+${location.longitude}&key=demo&limit=1`
        );
        const data = await response.json();
        if (data.results && data.results[0]) {
          address = data.results[0].formatted;
          country = data.results[0].components?.country || '';
          state = data.results[0].components?.state || data.results[0].components?.province || '';
        }
      } catch (geocodeError) {
        console.warn('Geocoding failed:', geocodeError);
        address = `${location.latitude.toFixed(6)}, ${location.longitude.toFixed(6)}`;
        
        // Fallback region detection
        const lat = location.latitude;
        const lng = location.longitude;
        
        if (lat >= 13.0 && lat <= 17.8 && lng >= -92.5 && lng <= -88.0) {
          country = 'Guatemala';
          if (lat >= 14.4 && lat <= 14.8 && lng >= -90.8 && lng <= -90.3) state = 'Guatemala (Capital)';
          else state = 'Guatemala';
        } else if (lat >= 14.5 && lat <= 32.7 && lng >= -118.4 && lng <= -86.7) {
          country = 'México';
          if (lat >= 19.0 && lat <= 25.0 && lng >= -89.0 && lng <= -86.0) state = 'Quintana Roo';
          else if (lat >= 20.0 && lat <= 22.5 && lng >= -90.5 && lng <= -88.0) state = 'Yucatán';
          else state = 'Otra región';
        }
      }

      const { error } = await supabase
        .from('location_tracking')
        .insert({
          user_id: (await supabase.auth.getUser()).data.user?.id,
          latitude: location.latitude,
          longitude: location.longitude,
          address,
          country: country || null,
          state: state || null,
        });

      if (error) {
        throw error;
      }

      setLastLocation({
        ...location,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('Error saving tracking location:', error);
    }
  };

  const trackLocation = async () => {
    try {
      const location = await getCurrentLocation();
      await saveTrackingLocation(location);
    } catch (error) {
      console.error('Error tracking location:', error);
    }
  };

  const startTracking = () => {
    // Initial location capture
    trackLocation();
    
    // Set up interval for every 30 minutes (30 * 60 * 1000 ms)
    const id = setInterval(trackLocation, 30 * 60 * 1000);
    setIntervalId(id);
    setIsTracking(true);
    localStorage.setItem('locationTracking', 'active');
    
    toast({
      title: 'Seguimiento iniciado',
      description: 'La ubicación se capturará cada 30 minutos automáticamente.',
    });
  };

  const stopTracking = () => {
    if (intervalId) {
      clearInterval(intervalId);
      setIntervalId(null);
    }
    setIsTracking(false);
    localStorage.removeItem('locationTracking');
    
    toast({
      title: 'Seguimiento detenido',
      description: 'El seguimiento automático de ubicación ha sido desactivado.',
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5 text-warning" />
          Seguimiento Automático de Ubicación
        </CardTitle>
        <CardDescription>
          Captura automáticamente tu ubicación cada 30 minutos para seguimiento del equipo
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Badge variant={isTracking ? "default" : "secondary"}>
              {isTracking ? 'Activo' : 'Inactivo'}
            </Badge>
            <span className="text-sm text-muted-foreground">
              Estado del seguimiento
            </span>
          </div>
          
          <Button
            onClick={isTracking ? stopTracking : startTracking}
            variant={isTracking ? "destructive" : "default"}
            className={isTracking ? "" : "bg-warning hover:bg-warning/90 text-warning-foreground"}
          >
            {isTracking ? (
              <>
                <Square className="h-4 w-4 mr-2" />
                Detener Seguimiento
              </>
            ) : (
              <>
                <Play className="h-4 w-4 mr-2" />
                Iniciar Seguimiento
              </>
            )}
          </Button>
        </div>

        {/* Location info hidden from regular users for privacy */}

        <div className="text-xs text-muted-foreground bg-muted/50 p-3 rounded-lg">
          <p className="font-medium mb-1">ℹ️ Información importante:</p>
          <ul className="space-y-1">
            <li>• El seguimiento captura la ubicación cada 30 minutos</li>
            <li>• Mantén la aplicación abierta para un seguimiento óptimo</li>
            <li>• Los datos se almacenan de forma segura en el servidor</li>
            <li>• Puedes detener el seguimiento en cualquier momento</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
};

export default LocationTracker;