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
import { sanitizeCoordinates, validateInput } from './SecurityLogger';

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
  const [businessName, setBusinessName] = useState('');
  const [contactPerson, setContactPerson] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const { toast } = useToast();

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setPhotoFile(file);
    }
  };

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

    try {
      // Validate and sanitize coordinates
      const { lat, lng } = sanitizeCoordinates(currentLocation.latitude, currentLocation.longitude);
      
      // Validate and sanitize text inputs
      const sanitizedNotes = notes.trim() ? validateInput(notes, 500) : '';
      const sanitizedBusinessName = businessName.trim() ? validateInput(businessName, 100) : '';
      const sanitizedContactPerson = contactPerson.trim() ? validateInput(contactPerson, 100) : '';
      
      setLoading(true);

      // Get address and detect country/state from coordinates
      let address = '';
      let country = '';
      let state = '';
      
      try {
        const { data: geocodeData, error: geocodeError } = await supabase.functions.invoke('geocode', {
          body: { 
            latitude: lat, 
            longitude: lng 
          }
        });

        if (geocodeError) {
          throw geocodeError;
        }

        if (geocodeData) {
          address = geocodeData.address || '';
          country = geocodeData.country || '';
          state = geocodeData.state || '';
        }
      } catch (geocodeError) {
        address = `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
        
        // Fallback region detection for the Americas
        const fallbackLat = lat;
        const fallbackLng = lng;
        
        // More specific ranges first to avoid overlaps - Guatemala checked before Mexico
        if (fallbackLat >= 13.0 && fallbackLat <= 17.8 && fallbackLng >= -92.5 && fallbackLng <= -88.0) {
          country = 'Guatemala';
          // Guatemala City and surrounding metropolitan area (zones 1-25)
          if (fallbackLat >= 14.4 && fallbackLat <= 14.8 && fallbackLng >= -90.8 && fallbackLng <= -90.3) state = 'Guatemala (Capital)';
          // Mixco, Villa Nueva, San José Pinula (metropolitan area)
          else if (fallbackLat >= 14.4 && fallbackLat <= 14.8 && fallbackLng >= -90.8 && fallbackLng <= -90.2) state = 'Guatemala (Metropolitana)';
          // Other regions
          else if (fallbackLat >= 15.5 && fallbackLat <= 16.0 && fallbackLng >= -91.5 && fallbackLng <= -90.5) state = 'Alta Verapaz';
          else if (fallbackLat >= 15.0 && fallbackLat <= 15.8 && fallbackLng >= -90.8 && fallbackLng <= -90.0) state = 'Baja Verapaz';
          else if (fallbackLat >= 14.8 && fallbackLat <= 15.8 && fallbackLng >= -92.0 && fallbackLng <= -91.0) state = 'Quiché';
          else if (fallbackLat >= 14.2 && fallbackLat <= 15.0 && fallbackLng >= -91.8 && fallbackLng <= -90.8) state = 'Chimaltenango';
          else if (fallbackLat >= 14.3 && fallbackLat <= 14.8 && fallbackLng >= -91.0 && fallbackLng <= -90.5) state = 'Sacatepéquez';
          else if (fallbackLat >= 13.8 && fallbackLat <= 14.5 && fallbackLng >= -90.5 && fallbackLng <= -89.5) state = 'Jalapa';
          else if (fallbackLat >= 13.5 && fallbackLat <= 14.3 && fallbackLng >= -90.2 && fallbackLng <= -89.2) state = 'Jutiapa';
          else state = 'Guatemala';
        } 
        // El Salvador
        else if (fallbackLat >= 12.0 && fallbackLat <= 14.5 && fallbackLng >= -90.5 && fallbackLng <= -87.0) {
          country = 'El Salvador';
          if (fallbackLat >= 13.5 && fallbackLat <= 14.5 && fallbackLng >= -89.5 && fallbackLng <= -88.8) state = 'San Salvador';
          else if (fallbackLat >= 13.8 && fallbackLat <= 14.2 && fallbackLng >= -89.8 && fallbackLng <= -89.2) state = 'Santa Ana';
          else if (fallbackLat >= 13.0 && fallbackLat <= 13.8 && fallbackLng >= -89.5 && fallbackLng <= -88.8) state = 'La Libertad';
          else state = 'El Salvador';
        } 
        // Honduras
        else if (fallbackLat >= 12.5 && fallbackLat <= 16.5 && fallbackLng >= -89.5 && fallbackLng <= -83.0) {
          country = 'Honduras';
          if (fallbackLat >= 14.0 && fallbackLat <= 14.3 && fallbackLng >= -87.5 && fallbackLng <= -86.8) state = 'Francisco Morazán';
          else if (fallbackLat >= 15.3 && fallbackLat <= 15.8 && fallbackLng >= -88.2 && fallbackLng <= -87.5) state = 'Cortés';
          else if (fallbackLat >= 15.0 && fallbackLat <= 15.5 && fallbackLng >= -87.8 && fallbackLng <= -87.0) state = 'Atlántida';
          else state = 'Honduras';
        }
        // Mexico (checked after Central American countries to avoid overlap)
        else if (fallbackLat >= 14.5 && fallbackLat <= 32.7 && fallbackLng >= -118.4 && fallbackLng <= -86.7) {
          country = 'México';
          if (fallbackLat >= 19.0 && fallbackLat <= 25.0 && fallbackLng >= -89.0 && fallbackLng <= -86.0) state = 'Quintana Roo';
          else if (fallbackLat >= 20.0 && fallbackLat <= 22.5 && fallbackLng >= -90.5 && fallbackLng <= -88.0) state = 'Yucatán';
          else if (fallbackLat >= 19.0 && fallbackLat <= 21.5 && fallbackLng >= -91.0 && fallbackLng <= -89.0) state = 'Campeche';
          else if (fallbackLat >= 25.0 && fallbackLat <= 32.7 && fallbackLng >= -115.0 && fallbackLng <= -109.0) state = 'Baja California';
          else state = 'Otra región';
        } 
        // Costa Rica
        else if (fallbackLat >= 8.0 && fallbackLat <= 11.5 && fallbackLng >= -86.0 && fallbackLng <= -82.5) {
          country = 'Costa Rica';
          state = 'Región detectada';
        }
        // Panama
        else if (fallbackLat >= 7.0 && fallbackLat <= 9.7 && fallbackLng >= -83.0 && fallbackLng <= -77.0) {
          country = 'Panamá';
          state = 'Región detectada';
        }
        // Colombia
        else if (fallbackLat >= -4.5 && fallbackLat <= 13.5 && fallbackLng >= -82.0 && fallbackLng <= -66.0) {
          country = 'Colombia';
          state = 'Región detectada';
        }
        // USA
        else if (fallbackLat >= 24.0 && fallbackLat <= 50.0 && fallbackLng >= -130.0 && fallbackLng <= -65.0) {
          country = 'Estados Unidos';
          state = 'Región detectada';
        }
        // Canada
        else if (fallbackLat >= 42.0 && fallbackLat <= 70.0 && fallbackLng >= -140.0 && fallbackLng <= -52.0) {
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
          latitude: lat,
          longitude: lng,
          accuracy: currentLocation.accuracy,
          address,
          notes: sanitizedNotes || null,
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
      setBusinessName('');
      setContactPerson('');
      setEmail('');
      setPhone('');
      setPhotoFile(null);
      
      if (onLocationCaptured) {
        onLocationCaptured();
      }
    } catch (error: any) {
      if (error.message && error.message.includes('Invalid')) {
        toast({
          variant: 'destructive',
          title: 'Datos inválidos',
          description: error.message || 'Por favor verifica los datos ingresados.',
        });
      } else {
        toast({
          variant: 'destructive',
          title: 'Error al guardar actividad',
          description: 'Por favor intenta de nuevo.',
        });
      }
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

        {(activityType === 'Visita en frío' || activityType === 'Visita programada' || activityType === 'Visita de cortesía') && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="businessName">Nombre del negocio</Label>
                <Input
                  id="businessName"
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  placeholder="Nombre del negocio"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="contactPerson">Contacto/s de quien nos recibe</Label>
                <Input
                  id="contactPerson"
                  value={contactPerson}
                  onChange={(e) => setContactPerson(e.target.value)}
                  placeholder="Nombre del contacto"
                />
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="email@ejemplo.com"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Teléfono</Label>
                <Input
                  id="phone"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="Número de teléfono"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="photo">Foto del lugar</Label>
              <Input
                id="photo"
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handlePhotoUpload}
                className="cursor-pointer file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-medium file:bg-primary file:text-primary-foreground hover:file:bg-primary/80"
              />
              {photoFile && (
                <div className="mt-2 p-2 bg-secondary rounded-lg">
                  <p className="text-sm text-muted-foreground">
                    Foto seleccionada: {photoFile.name}
                  </p>
                </div>
              )}
            </div>
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