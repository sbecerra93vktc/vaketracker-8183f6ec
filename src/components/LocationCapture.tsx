import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { MapPin, Loader2 } from 'lucide-react';

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
  const [visitType, setVisitType] = useState('check_in');
  const [notes, setNotes] = useState('');
  const { toast } = useToast();

  const getCurrentLocation = () => {
    setLoading(true);
    
    if (!navigator.geolocation) {
      toast({
        variant: 'destructive',
        title: 'Location not supported',
        description: 'Your browser does not support location services.',
      });
      setLoading(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude, accuracy } = position.coords;
        setCurrentLocation({ latitude, longitude, accuracy });
        toast({
          title: 'Location captured!',
          description: `Accuracy: ${Math.round(accuracy || 0)}m`,
        });
        setLoading(false);
      },
      (error) => {
        console.error('Location error:', error);
        toast({
          variant: 'destructive',
          title: 'Location access denied',
          description: 'Please enable location services and try again.',
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
        title: 'No location captured',
        description: 'Please capture your location first.',
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
        title: 'Location saved!',
        description: 'Your location has been recorded successfully.',
      });

      // Reset form
      setCurrentLocation(null);
      setNotes('');
      setVisitType('check_in');
      
      if (onLocationCaptured) {
        onLocationCaptured();
      }
    } catch (error) {
      console.error('Error saving location:', error);
      toast({
        variant: 'destructive',
        title: 'Error saving location',
        description: 'Please try again.',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MapPin className="h-5 w-5" />
          Share Your Location
        </CardTitle>
        <CardDescription>
          Capture and share your current location for territory tracking
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="visitType">Visit Type</Label>
          <Select value={visitType} onValueChange={setVisitType}>
            <SelectTrigger>
              <SelectValue placeholder="Select visit type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="check_in">Check In</SelectItem>
              <SelectItem value="customer_visit">Customer Visit</SelectItem>
              <SelectItem value="delivery">Delivery</SelectItem>
              <SelectItem value="meeting">Meeting</SelectItem>
              <SelectItem value="break">Break</SelectItem>
              <SelectItem value="check_out">Check Out</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="notes">Notes (Optional)</Label>
          <Textarea
            id="notes"
            placeholder="Add any notes about this location..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
          />
        </div>

        {currentLocation && (
          <div className="p-4 bg-muted rounded-lg">
            <h4 className="font-medium mb-2">Location Captured</h4>
            <p className="text-sm text-muted-foreground">
              Lat: {currentLocation.latitude.toFixed(6)}<br />
              Lng: {currentLocation.longitude.toFixed(6)}<br />
              {currentLocation.accuracy && (
                <>Accuracy: {Math.round(currentLocation.accuracy)}m</>
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
              <MapPin className="h-4 w-4 mr-2" />
            )}
            {currentLocation ? 'Update Location' : 'Capture Location'}
          </Button>
          
          {currentLocation && (
            <Button
              onClick={saveLocation}
              disabled={loading}
              className="flex-1"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              Save Location
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default LocationCapture;