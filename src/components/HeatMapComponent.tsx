import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Thermometer, TrendingUp } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

interface HeatMapData {
  region: string;
  count: number;
  intensity: number;
}

const HeatMapComponent = () => {
  const [heatMapData, setHeatMapData] = useState<HeatMapData[]>([]);
  const [selectedCountry, setSelectedCountry] = useState<string>('Guatemala');
  const [loading, setLoading] = useState(true);
  const { userRole } = useAuth();

  const detectStateFromCoordinates = (lat: number, lng: number, country: string): string => {
    if (country === 'México') {
      if (lat >= 19.0 && lat <= 25.0 && lng >= -89.0 && lng <= -86.0) return 'Quintana Roo';
      if (lat >= 20.0 && lat <= 22.5 && lng >= -90.5 && lng <= -88.0) return 'Yucatán';
      if (lat >= 19.0 && lat <= 21.5 && lng >= -91.0 && lng <= -89.0) return 'Campeche';
      if (lat >= 25.0 && lat <= 32.7 && lng >= -115.0 && lng <= -109.0) return 'Baja California';
      return 'Otra región';
    }
    if (country === 'Guatemala') {
      // Guatemala City and surrounding metropolitan area (zones 1-25)
      if (lat >= 14.4 && lat <= 14.8 && lng >= -90.8 && lng <= -90.3) return 'Guatemala (Capital)';
      // Mixco, Villa Nueva, San José Pinula (metropolitan area)
      if (lat >= 14.4 && lat <= 14.8 && lng >= -90.8 && lng <= -90.2) return 'Guatemala (Metropolitana)';
      // Other regions
      if (lat >= 15.5 && lat <= 16.0 && lng >= -91.5 && lng <= -90.5) return 'Alta Verapaz';
      if (lat >= 15.0 && lat <= 15.8 && lng >= -90.8 && lng <= -90.0) return 'Baja Verapaz';
      if (lat >= 14.8 && lat <= 15.8 && lng >= -92.0 && lng <= -91.0) return 'Quiché';
      if (lat >= 14.2 && lat <= 15.0 && lng >= -91.8 && lng <= -90.8) return 'Chimaltenango';
      if (lat >= 14.3 && lat <= 14.8 && lng >= -91.0 && lng <= -90.5) return 'Sacatepéquez';
      if (lat >= 13.8 && lat <= 14.5 && lng >= -90.5 && lng <= -89.5) return 'Jalapa';
      if (lat >= 13.5 && lat <= 14.3 && lng >= -90.2 && lng <= -89.2) return 'Jutiapa';
      return 'Guatemala';
    }
    if (country === 'El Salvador') {
      if (lat >= 13.5 && lat <= 14.5 && lng >= -89.5 && lng >= -88.8) return 'San Salvador';
      if (lat >= 13.8 && lat <= 14.2 && lng >= -89.8 && lng <= -89.2) return 'Santa Ana';
      if (lat >= 13.0 && lat <= 13.8 && lng >= -89.5 && lng >= -88.8) return 'La Libertad';
      return 'El Salvador';
    }
    if (country === 'Honduras') {
      if (lat >= 14.0 && lat <= 14.3 && lng >= -87.5 && lng <= -86.8) return 'Francisco Morazán';
      if (lat >= 15.3 && lat <= 15.8 && lng >= -88.2 && lng >= -87.5) return 'Cortés';
      if (lat >= 15.0 && lat <= 15.5 && lng >= -87.8 && lng <= -87.0) return 'Atlántida';
      return 'Honduras';
    }
    return country || 'Región detectada';
  };

  const detectCountryFromCoordinates = (lat: number, lng: number): string => {
    // More specific ranges first to avoid overlaps
    if (lat >= 13.0 && lat <= 17.8 && lng >= -92.5 && lng <= -88.0) return 'Guatemala';
    if (lat >= 12.0 && lat <= 14.5 && lng >= -90.5 && lng <= -87.0) return 'El Salvador';
    if (lat >= 12.5 && lat <= 16.5 && lng >= -89.5 && lng <= -83.0) return 'Honduras';
    if (lat >= 8.0 && lat <= 11.5 && lng >= -86.0 && lng <= -82.5) return 'Costa Rica';
    if (lat >= 7.0 && lat <= 9.7 && lng >= -83.0 && lng <= -77.0) return 'Panamá';
    if (lat >= -4.5 && lat <= 13.5 && lng >= -82.0 && lng <= -66.0) return 'Colombia';
    // Mexico should be checked after Central American countries
    if (lat >= 14.5 && lat <= 32.7 && lng >= -118.4 && lng <= -86.7) return 'México';
    if (lat >= 24.0 && lat <= 50.0 && lng >= -130.0 && lng <= -65.0) return 'Estados Unidos';
    if (lat >= 42.0 && lat <= 70.0 && lng >= -140.0 && lng <= -52.0) return 'Canadá';
    return '';
  };

  const fetchHeatMapData = async () => {
    try {
      setLoading(true);
      
      const { data: locations, error } = await supabase
        .from('locations')
        .select('latitude, longitude, country, state');

      if (error) throw error;

      // Filter by selected country and group by state/region
      const regionCounts: Record<string, number> = {};
      
      locations?.forEach(location => {
        const detectedCountry = location.country || detectCountryFromCoordinates(location.latitude, location.longitude);
        
        if (detectedCountry === selectedCountry) {
          const region = location.state || detectStateFromCoordinates(location.latitude, location.longitude, detectedCountry);
          regionCounts[region] = (regionCounts[region] || 0) + 1;
        }
      });

      // Convert to heat map data with intensity
      const maxCount = Math.max(...Object.values(regionCounts));
      const heatData = Object.entries(regionCounts).map(([region, count]) => ({
        region,
        count,
        intensity: maxCount > 0 ? (count / maxCount) * 100 : 0
      }));

      // Sort by count descending
      heatData.sort((a, b) => b.count - a.count);
      
      setHeatMapData(heatData);
    } catch (error) {
      console.error('Error fetching heat map data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHeatMapData();
  }, [selectedCountry]);

  const getIntensityColor = (intensity: number) => {
    if (intensity >= 80) return 'bg-red-700';
    if (intensity >= 60) return 'bg-red-600';
    if (intensity >= 40) return 'bg-red-500';
    if (intensity >= 20) return 'bg-red-400';
    return 'bg-red-300';
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-warning">
          <Thermometer className="h-5 w-5" />
          Mapa de Calor por Actividades
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          <div className="flex items-center gap-4">
            <Label>País:</Label>
            <Select value={selectedCountry} onValueChange={setSelectedCountry}>
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Guatemala">Guatemala</SelectItem>
                <SelectItem value="México">México</SelectItem>
                <SelectItem value="El Salvador">El Salvador</SelectItem>
                <SelectItem value="Honduras">Honduras</SelectItem>
                <SelectItem value="Costa Rica">Costa Rica</SelectItem>
                <SelectItem value="Panamá">Panamá</SelectItem>
                <SelectItem value="Colombia">Colombia</SelectItem>
                <SelectItem value="Estados Unidos">Estados Unidos</SelectItem>
                <SelectItem value="Canadá">Canadá</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {loading ? (
            <div className="text-center py-8 text-muted-foreground">
              Cargando datos del mapa de calor...
            </div>
          ) : heatMapData.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No hay actividades registradas para {selectedCountry}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {heatMapData.map((data) => (
                  <div
                    key={data.region}
                    className="relative overflow-hidden rounded-lg border p-4 space-y-2"
                  >
                    <div className={`absolute inset-0 ${getIntensityColor(data.intensity)} opacity-20`} />
                    <div className="relative z-10">
                      <div className="flex items-center justify-between">
                        <h3 className="font-medium text-sm">{data.region}</h3>
                        <div className="flex items-center gap-1">
                          <TrendingUp className="h-4 w-4 text-red-600" />
                          <span className="text-sm font-bold text-red-600">{data.count}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 mt-2">
                        <div className="flex-1 bg-gray-200 rounded-full h-2">
                          <div
                            className={`h-full rounded-full transition-all ${getIntensityColor(data.intensity)}`}
                            style={{ width: `${data.intensity}%` }}
                          />
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {data.intensity.toFixed(0)}%
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              
              <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground mt-6">
                <span>Menor intensidad</span>
                <div className="flex gap-1">
                  <div className="w-4 h-3 bg-red-300 rounded" />
                  <div className="w-4 h-3 bg-red-400 rounded" />
                  <div className="w-4 h-3 bg-red-500 rounded" />
                  <div className="w-4 h-3 bg-red-600 rounded" />
                  <div className="w-4 h-3 bg-red-700 rounded" />
                </div>
                <span>Mayor intensidad</span>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default HeatMapComponent;
