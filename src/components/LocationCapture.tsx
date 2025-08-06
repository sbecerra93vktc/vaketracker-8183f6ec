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
      // Get address and detect country/state from coordinates
      let address = '';
      let country = '';
      let state = '';
      
      try {
        const response = await fetch(
          `https://api.opencagedata.com/geocode/v1/json?q=${currentLocation.latitude}+${currentLocation.longitude}&key=demo&limit=1`
        );
        const data = await response.json();
        if (data.results && data.results[0]) {
          address = data.results[0].formatted;
          country = data.results[0].components?.country || '';
          state = data.results[0].components?.state || data.results[0].components?.province || '';
        }
      } catch (geocodeError) {
        console.warn('Geocoding failed:', geocodeError);
        address = `${currentLocation.latitude.toFixed(6)}, ${currentLocation.longitude.toFixed(6)}`;
        
        // Fallback region detection for the Americas
        const lat = currentLocation.latitude;
        const lng = currentLocation.longitude;
        
        // More specific ranges first to avoid overlaps - Guatemala checked before Mexico
        if (lat >= 13.0 && lat <= 17.8 && lng >= -92.5 && lng <= -88.0) {
          country = 'Guatemala';
          // Guatemala City and surrounding metropolitan area (zones 1-25)
          if (lat >= 14.4 && lat <= 14.8 && lng >= -90.8 && lng <= -90.3) state = 'Guatemala (Capital)';
          // Mixco, Villa Nueva, San José Pinula (metropolitan area)
          else if (lat >= 14.4 && lat <= 14.8 && lng >= -90.8 && lng <= -90.2) state = 'Guatemala (Metropolitana)';
          // Other regions
          else if (lat >= 15.5 && lat <= 16.0 && lng >= -91.5 && lng <= -90.5) state = 'Alta Verapaz';
          else if (lat >= 15.0 && lat <= 15.8 && lng >= -90.8 && lng <= -90.0) state = 'Baja Verapaz';
          else if (lat >= 14.8 && lat <= 15.8 && lng >= -92.0 && lng <= -91.0) state = 'Quiché';
          else if (lat >= 14.2 && lat <= 15.0 && lng >= -91.8 && lng <= -90.8) state = 'Chimaltenango';
          else if (lat >= 14.3 && lat <= 14.8 && lng >= -91.0 && lng <= -90.5) state = 'Sacatepéquez';
          else if (lat >= 13.8 && lat <= 14.5 && lng >= -90.5 && lng <= -89.5) state = 'Jalapa';
          else if (lat >= 13.5 && lat <= 14.3 && lng >= -90.2 && lng <= -89.2) state = 'Jutiapa';
          else state = 'Guatemala';
        } 
        // El Salvador
        else if (lat >= 12.0 && lat <= 14.5 && lng >= -90.5 && lng <= -87.0) {
          country = 'El Salvador';
          if (lat >= 13.5 && lat <= 14.5 && lng >= -89.5 && lng <= -88.8) state = 'San Salvador';
          else if (lat >= 13.8 && lat <= 14.2 && lng >= -89.8 && lng <= -89.2) state = 'Santa Ana';
          else if (lat >= 13.0 && lat <= 13.8 && lng >= -89.5 && lng <= -88.8) state = 'La Libertad';
          else state = 'El Salvador';
        } 
        // Honduras
        else if (lat >= 12.5 && lat <= 16.5 && lng >= -89.5 && lng <= -83.0) {
          country = 'Honduras';
          if (lat >= 14.0 && lat <= 14.3 && lng >= -87.5 && lng <= -86.8) state = 'Francisco Morazán';
          else if (lat >= 15.3 && lat <= 15.8 && lng >= -88.2 && lng <= -87.5) state = 'Cortés';
          else if (lat >= 15.0 && lat <= 15.5 && lng >= -87.8 && lng <= -87.0) state = 'Atlántida';
          else state = 'Honduras';
        }
        // Mexico (checked after Central American countries to avoid overlap)
        else if (lat >= 14.5 && lat <= 32.7 && lng >= -118.4 && lng <= -86.7) {
          country = 'México';
          if (lat >= 19.0 && lat <= 25.0 && lng >= -89.0 && lng <= -86.0) state = 'Quintana Roo';
          else if (lat >= 20.0 && lat <= 22.5 && lng >= -90.5 && lng <= -88.0) state = 'Yucatán';
          else if (lat >= 19.0 && lat <= 21.5 && lng >= -91.0 && lng <= -89.0) state = 'Campeche';
          else if (lat >= 25.0 && lat <= 32.7 && lng >= -115.0 && lng <= -109.0) state = 'Baja California';
          else state = 'Otra región';
        } 
        // Costa Rica
        else if (lat >= 8.0 && lat <= 11.5 && lng >= -86.0 && lng <= -82.5) {
          country = 'Costa Rica';
          state = 'Región detectada';
        }
        // Panama
        else if (lat >= 7.0 && lat <= 9.7 && lng >= -83.0 && lng <= -77.0) {
          country = 'Panamá';
          state = 'Región detectada';
        }
        // Colombia
        else if (lat >= -4.5 && lat <= 13.5 && lng >= -82.0 && lng <= -66.0) {
          country = 'Colombia';
          state = 'Región detectada';
        }
        // USA
        else if (lat >= 24.0 && lat <= 50.0 && lng >= -130.0 && lng <= -65.0) {
          country = 'Estados Unidos';
          state = 'Región detectada';
        }
        // Canada
        else if (lat >= 42.0 && lat <= 70.0 && lng >= -140.0 && lng <= -52.0) {
          country = 'Canadá';
          state = 'Región detectada';
        }
      }

      const visitType = activityType === 'Visita programada' && subActivity 
        ? `${activityType} - ${subActivity}` 
        : activityType;
      
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
          country: country || null,
          state: state || null,
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
              <SelectItem value="Visita en frío">Visita en frío</SelectItem>
              <SelectItem value="Visita programada">Visita programada</SelectItem>
              <SelectItem value="Visita de cortesía">Visita de cortesía</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {activityType === 'Visita programada' && (
          <div className="space-y-2">
            <Label htmlFor="subActivity">Tipo de Visita Programada</Label>
            <Select value={subActivity} onValueChange={setSubActivity}>
              <SelectTrigger>
                <SelectValue placeholder="Selecciona el tipo de visita" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Negociación en curso">Negociación en curso</SelectItem>
                <SelectItem value="Visita Pre-entrega e instalación">Visita Pre-entrega e instalación</SelectItem>
                <SelectItem value="Visita técnica">Visita técnica</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}

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
          
          {currentLocation && activityType && (activityType !== 'Visita programada' || subActivity) && (
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