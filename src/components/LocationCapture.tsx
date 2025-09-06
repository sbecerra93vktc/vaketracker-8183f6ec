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
import MediaRecorder, { MediaFile } from './MediaRecorder';

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
  const [mediaFiles, setMediaFiles] = useState<MediaFile[]>([]);
  const { toast } = useToast();

  const handleMediaFilesChange = (files: MediaFile[]) => {
    setMediaFiles(files);
  };

  const handleUploadActivity = async (files: MediaFile[]) => {
    // This function will be called when the upload activity button is clicked
    // The files are already set in the mediaFiles state, so we can proceed with saving
    if (currentLocation && activityType && (activityType !== 'Visita programada' || subActivity)) {
      await saveLocation();
    } else {
      toast({
        variant: 'destructive',
        title: 'Información incompleta',
        description: 'Por favor completa la ubicación y tipo de actividad antes de subir.',
      });
    }
  };

  const getCurrentLocation = async () => {
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

    // Check if we're on iOS
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const isSafari = /Safari/.test(navigator.userAgent) && !/Chrome/.test(navigator.userAgent);
    
    // For iOS, try to request permission first
    if (isIOS && 'permissions' in navigator) {
      try {
        const permission = await navigator.permissions.query({ name: 'geolocation' as PermissionName });
        if (permission.state === 'denied') {
          toast({
            variant: 'destructive',
            title: 'Permisos de ubicación denegados',
            description: 'Ve a Configuración > Safari > Ubicación y selecciona "Permitir". Luego recarga la página.',
          });
          setLoading(false);
          return;
        }
      } catch (error) {
        // Permissions API not supported, continue with normal flow
        console.log('Permissions API not supported, continuing with normal geolocation request');
      }
    }
    
    // More conservative options for iOS Safari
    const options: PositionOptions = isIOS ? {
      enableHighAccuracy: false, // Start with less accuracy for better compatibility
      timeout: 20000, // Shorter timeout for iOS
      maximumAge: 300000, // Allow cached position for 5 minutes
    } : {
      enableHighAccuracy: true,
      timeout: 30000,
      maximumAge: 60000,
    };

    // Try to get current position
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
        let errorMessage = 'Por favor habilita los servicios de ubicación e intenta de nuevo.';
        let title = 'Error al obtener ubicación';
        
        switch (error.code) {
          case error.PERMISSION_DENIED:
            title = 'Permisos de ubicación requeridos';
            if (isIOS) {
              errorMessage = 'Para usar esta función:\n1. Ve a Configuración > Safari > Ubicación\n2. Selecciona "Permitir"\n3. Recarga esta página\n4. Intenta de nuevo';
            } else {
              errorMessage = 'Por favor permite el acceso a la ubicación en tu navegador y recarga la página.';
            }
            break;
          case error.POSITION_UNAVAILABLE:
            title = 'Ubicación no disponible';
            errorMessage = 'No se pudo obtener tu ubicación. Verifica que el GPS esté activado y que tengas conexión a internet.';
            break;
          case error.TIMEOUT:
            title = 'Tiempo de espera agotado';
            errorMessage = 'La solicitud de ubicación tardó demasiado. Intenta de nuevo.';
            break;
        }
        
        toast({
          variant: 'destructive',
          title,
          description: errorMessage,
        });
        setLoading(false);
      },
      options
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
      
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) throw new Error('User not authenticated');
      
      // Insert the location first
      const { data: locationData, error: locationError } = await supabase
        .from('locations')
        .insert({
          user_id: user.user.id,
          latitude: lat,
          longitude: lng,
          accuracy: currentLocation.accuracy,
          address,
          notes: sanitizedNotes || null,
          visit_type: visitType,
          country: country || null,
          state: state || null,
          business_name: sanitizedBusinessName || null,
          contact_person: sanitizedContactPerson || null,
          email: email.trim() || null,
          phone: phone.trim() || null,
        })
        .select()
        .single();

      if (locationError) {
        throw locationError;
      }

      // Upload media files if any
      if (mediaFiles.length > 0) {
        await uploadMediaFiles(locationData.id, user.user.id);
      }

      // Production logging for activity save success
      if (import.meta.env.VITE_PRODUCTION_MODE === 'true') {
        console.log('Activity saved successfully', {
          activity_id: locationData.id,
          media_files_count: mediaFiles.length,
          timestamp: new Date().toISOString(),
        });
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
      setMediaFiles([]);
      
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
        // Production logging for activity save failure
        if (import.meta.env.VITE_PRODUCTION_MODE === 'true') {
          console.error('Activity save failed', {
            error_type: 'activity_save_error',
            timestamp: new Date().toISOString(),
          });
        }

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

  const uploadMediaFiles = async (activityId: string, userId: string) => {
    const failedUploads: string[] = [];
    
    const uploadPromises = mediaFiles.map(async (mediaFile, index) => {
      let bucket: string;
      let filePath: string;

      switch (mediaFile.type) {
        case 'photo':
          bucket = 'activity-photos';
          break;
        case 'video':
          bucket = 'activity-videos';
          break;
        case 'audio':
          bucket = 'activity-audio';
          break;
        default:
          return;
      }

      // Generate unique file path with timestamp
      const timestamp = Date.now();
      const uniqueFileName = `${timestamp}-${mediaFile.file.name}`;
      filePath = `${userId}/${activityId}/${uniqueFileName}`;

      // Retry logic for uploads
      let attempt = 0;
      const maxRetries = 2;
      
      while (attempt <= maxRetries) {
        try {
          // Upload file to storage
          const { error: storageError } = await supabase.storage
            .from(bucket)
            .upload(filePath, mediaFile.file);

          if (storageError) {
            throw storageError;
          }

          // Insert file record into database
          const { error: dbError } = await supabase
            .from('activity_files')
            .insert({
              activity_id: activityId,
              file_type: mediaFile.type,
              file_path: filePath,
              file_name: mediaFile.file.name,
              file_size: mediaFile.file.size,
              duration: mediaFile.duration,
              user_id: userId,
            });

          if (dbError) {
            throw dbError;
          }

          // Production logging for media upload success
          if (import.meta.env.VITE_PRODUCTION_MODE === 'true') {
            console.log('Media upload successful', {
              file_type: mediaFile.type,
              file_size: mediaFile.file.size,
              timestamp: new Date().toISOString(),
            });
          }

          // Success - break out of retry loop
          break;
          
        } catch (error) {
          console.error(`Upload attempt ${attempt + 1} failed:`, error);
          
          // Production logging for media upload failure
          if (import.meta.env.VITE_PRODUCTION_MODE === 'true') {
            console.error('Media upload failed', {
              file_type: mediaFile.type,
              file_size: mediaFile.file.size,
              attempt: attempt + 1,
              timestamp: new Date().toISOString(),
            });
          }
          
          attempt++;
          
          if (attempt > maxRetries) {
            failedUploads.push(mediaFile.file.name);
          } else {
            // Wait before retrying
            await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
          }
        }
      }
    });

    await Promise.all(uploadPromises);
    
    // Show toast for failed uploads
    if (failedUploads.length > 0) {
      toast({
        variant: "destructive",
        title: "Algunos archivos no se pudieron cargar",
        description: `Archivos fallidos: ${failedUploads.join(', ')}`,
      });
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

        {/* Enhanced debugging for activity type selection - development only */}
        {/* {import.meta.env.DEV && (
          <div className="p-2 bg-blue-50 border border-blue-200 rounded text-xs space-y-1">
            <div>📝 Debug Activity: "{activityType}" | Show Media = {(activityType === 'Visita en frío' || activityType === 'Visita programada' || activityType === 'Visita de cortesía') ? 'YES ✅' : 'NO ❌'}</div>
            <div>📱 Device: {'ontouchstart' in window ? 'Mobile' : 'Desktop'} | Touch Points: {navigator.maxTouchPoints || 0}</div>
            <div>🌐 Browser: {navigator.userAgent.includes('Mobile') ? 'Mobile Browser' : 'Desktop Browser'}</div>
            <div>📐 Screen: {window.innerWidth}x{window.innerHeight}</div>
          </div>
        )} */}

        {/* {(activityType === 'Visita en frío' || activityType === 'Visita programada' || activityType === 'Visita de cortesía') && ( */}
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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

            <div className="w-full">
              <MediaRecorder
                onFilesChange={handleMediaFilesChange}
                onUploadActivity={handleUploadActivity}
                maxAudioFiles={5}
                maxVideoFiles={5}
                maxPhotoFiles={10}
                showUploadActivityButton={true}
              />
            </div>
          </div>
        {/* )} */}

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