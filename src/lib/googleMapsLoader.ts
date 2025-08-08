import { Loader } from '@googlemaps/js-api-loader';
import { supabase } from '@/integrations/supabase/client';

let loaderInstance: Loader | null = null;
let isLoaded = false;
let loadPromise: Promise<void> | null = null;

export const loadGoogleMaps = async (): Promise<void> => {
  // If already loaded, return immediately
  if (isLoaded && window.google) {
    return Promise.resolve();
  }

  // If load is in progress, return the existing promise
  if (loadPromise) {
    return loadPromise;
  }

  // Start loading
  loadPromise = (async () => {
    try {
      console.log('[GoogleMapsLoader] Starting Google Maps API load...');
      
      // Get Google Maps API key with better error handling
      const { data: keyData, error: keyError } = await supabase.functions.invoke('get-google-maps-key');
      
      console.log('[GoogleMapsLoader] API key response:', { 
        hasData: !!keyData, 
        hasApiKey: !!keyData?.apiKey, 
        error: keyError 
      });
      
      if (keyError) {
        console.error('[GoogleMapsLoader] Error from edge function:', keyError);
        throw new Error(`Failed to get Google Maps API key: ${keyError.message}`);
      }
      
      if (!keyData?.apiKey) {
        console.error('[GoogleMapsLoader] No API key in response:', keyData);
        throw new Error('Google Maps API key not found in response');
      }

      console.log('[GoogleMapsLoader] API key retrieved successfully, initializing loader...');

      // Create loader instance only once
      if (!loaderInstance) {
        loaderInstance = new Loader({
          apiKey: keyData.apiKey,
          version: 'weekly',
          libraries: ['places', 'marker']
        });
      }

      console.log('[GoogleMapsLoader] Loading Google Maps API...');
      await loaderInstance.load();
      isLoaded = true;
      console.log('[GoogleMapsLoader] Google Maps API loaded successfully');
    } catch (error) {
      console.error('[GoogleMapsLoader] Failed to load Google Maps API:', error);
      loadPromise = null; // Reset so it can be retried
      throw error;
    }
  })();

  return loadPromise;
};

export const geocodeLocation = async (lat: number, lng: number): Promise<{ address?: string; country?: string; state?: string }> => {
  try {
    await loadGoogleMaps();
    
    const geocoder = new google.maps.Geocoder();
    const result = await new Promise<google.maps.GeocoderResult[]>((resolve, reject) => {
      geocoder.geocode(
        { location: { lat, lng } },
        (results, status) => {
          if (status === 'OK' && results) {
            resolve(results);
          } else {
            reject(new Error(`Geocoding failed: ${status}`));
          }
        }
      );
    });

    if (result && result.length > 0) {
      const place = result[0];
      let country = '';
      let state = '';
      
      // Extract country and state from address components
      place.address_components?.forEach(component => {
        if (component.types.includes('country')) {
          country = component.long_name;
        }
        if (component.types.includes('administrative_area_level_1')) {
          state = component.long_name;
        }
      });

      return {
        address: place.formatted_address,
        country: country || undefined,
        state: state || undefined
      };
    }
  } catch (error) {
    console.error('Geocoding error:', error);
  }

  return {};
};