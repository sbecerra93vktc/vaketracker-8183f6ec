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
      // Use Google's geocoding service
      const { geocodeLocation } = await import('@/lib/googleMapsLoader');
      const geocodingResult = await geocodeLocation(location.latitude, location.longitude);

      const { error } = await supabase
        .from('location_tracking')
        .insert({
          user_id: (await supabase.auth.getUser()).data.user?.id,
          latitude: location.latitude,
          longitude: location.longitude,
          address: geocodingResult.address || '',
          country: geocodingResult.country || null,
          state: geocodingResult.state || null,
        });

      if (error) {
        throw error;
      }

      console.log('Location tracking saved successfully with geocoding');
    } catch (error) {
      console.error('Error in saveTrackingLocation:', error);
      
      // Fallback: save location without geocoding
      try {
        const { error: fallbackError } = await supabase
          .from('location_tracking')
          .insert({
            user_id: (await supabase.auth.getUser()).data.user?.id,
            latitude: location.latitude,
            longitude: location.longitude,
            address: '',
            country: null,
            state: null,
          });
        
        if (fallbackError) throw fallbackError;
        console.log('Location saved without geocoding');
      } catch (fallbackError) {
        console.error('Failed to save location:', fallbackError);
        toast({
          title: "Error",
          description: "No se pudo guardar la ubicación",
          variant: "destructive",
        });
      }
    }
  };

  const trackLocation = async () => {
    try {
      const location = await getCurrentLocation();
      await saveTrackingLocation(location);
      
      setLastLocation({
        ...location,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error tracking location:', error);
    }
  };

  const startTracking = () => {
    // Initial location capture
    trackLocation();
    
    // Set up interval for every 2 minutes (2 * 60 * 1000 ms)
    const id = setInterval(trackLocation, 2 * 60 * 1000);
    setIntervalId(id);
    setIsTracking(true);
    localStorage.setItem('locationTracking', 'active');
    
    toast({
      title: 'Seguimiento iniciado',
      description: 'La ubicación se capturará cada 2 minutos automáticamente.',
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
          Captura automáticamente tu ubicación cada 2 minutos para seguimiento del equipo
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
            <li>• El seguimiento captura la ubicación cada 2 minutos</li>
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