import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { CheckSquare, Loader2 } from 'lucide-react';

interface LocationCaptureProps {
  onLocationCaptured?: () => void;
}

const LocationCapture = ({ onLocationCaptured }: LocationCaptureProps) => {
  const [loading, setLoading] = useState(false);
  const [currentLocation, setCurrentLocation] = useState<{
    latitude: number;
    longitude: number;
    accuracy?: number;
  } | null>(null);
  const [activityType, setActivityType] = useState('');
  const [subActivity, setSubActivity] = useState('');
  const [notes, setNotes] = useState('');
  const { toast } = useToast();

  const getCurrentLocation = () => {
    setLoading(true);
    
    if (!navigator.geolocation) {
      toast({
        variant: 'destructive',
        title: 'Ubicación no compatible',
        description: 'Tu navegador no soporta servicios de ubicación.',
      });
      setLoading(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude, accuracy } = position.coords;
        setCurrentLocation({ latitude, longitude, accuracy });
        toast({
          title: '¡Ubicación capturada!',
          description: `Precisión: ${Math.round(accuracy || 0)}m`,
        });
        setLoading(false);
      },
      (error) => {
        console.error('Location error:', error);
        toast({
          variant: 'destructive',
          title: 'Acceso a ubicación denegado',
          description: 'Por favor habilita los servicios de ubicación e intenta de nuevo.',
        });
        setLoading(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0,
      }
    );
  };

  const saveLocation = async () => {
    if (!currentLocation) {
      toast({
        variant: 'destructive',
        title: 'Sin ubicación capturada',
        description: 'Por favor captura tu ubicación primero.',
      });
      return;
    }

    setLoading(true);

    try {
      // Get address from coordinates (reverse geocoding)
      let address = '';
      try {
        const response = await fetch(
          `https://api.opencagedata.com/geocode/v1/json?q=${currentLocation.latitude}+${currentLocation.longitude}&key=demo&limit=1`
        );
        const data = await response.json();
        if (data.results && data.results[0]) {
          address = data.results[0].formatted;
        }
      } catch (geocodeError) {
        console.warn('Geocoding failed:', geocodeError);
        address = `${currentLocation.latitude.toFixed(6)}, ${currentLocation.longitude.toFixed(6)}`;
      }

      const visitType = activityType;
      
      const { error } = await supabase
        .from('locations')
        .insert({
          user_id: (await supabase.auth.getUser()).data.user?.id,
          latitude: currentLocation.latitude,
          longitude: currentLocation.longitude,
          accuracy: currentLocation.accuracy,
          address,
          notes: notes.trim() || null,
          visit_type: visitType,
        });

      if (error) {
        throw error;
      }

      toast({
        title: '¡Actividad guardada!',
        description: 'Tu actividad ha sido registrada exitosamente.',
      });

      // Reset form
      setCurrentLocation(null);
      setNotes('');
      setActivityType('');
      setSubActivity('');
      
      if (onLocationCaptured) {
        onLocationCaptured();
      }
    } catch (error) {
      console.error('Error saving location:', error);
      toast({
        variant: 'destructive',
        title: 'Error al guardar actividad',
        description: 'Por favor intenta de nuevo.',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CheckSquare className="h-5 w-5 text-warning" />
          Nueva Actividad
        </CardTitle>
        <CardDescription>
          Captura tu ubicación y registra una nueva actividad comercial
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="activityType">Tipo de Actividad</Label>
          <Select value={activityType} onValueChange={setActivityType}>
            <SelectTrigger>
              <SelectValue placeholder="Selecciona el tipo de actividad" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Visita de cortesía">Visita de cortesía</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="notes">Notas (Opcional)</Label>
          <Textarea
            id="notes"
            placeholder="Agrega notas sobre esta actividad..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
          />
        </div>

        {currentLocation && (
          <div className="p-4 bg-warning/10 border border-warning/20 rounded-lg">
            <h4 className="font-medium mb-2 text-warning-foreground">Ubicación Capturada</h4>
            <p className="text-sm text-muted-foreground">
              Lat: {currentLocation.latitude.toFixed(6)}<br />
              Lng: {currentLocation.longitude.toFixed(6)}<br />
              {currentLocation.accuracy && (
                <>Precisión: {Math.round(currentLocation.accuracy)}m</>
              )}
            </p>
          </div>
        )}

        <div className="flex gap-2">
          <Button
            onClick={getCurrentLocation}
            disabled={loading}
            variant="outline"
            className="flex-1"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <CheckSquare className="h-4 w-4 mr-2" />
            )}
            {currentLocation ? 'Actualizar Ubicación' : 'Capturar Ubicación'}
          </Button>
          
          {currentLocation && activityType && (
            <Button
              onClick={saveLocation}
              disabled={loading}
              className="flex-1 bg-warning hover:bg-warning/90 text-warning-foreground"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              Guardar Actividad
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default LocationCapture;