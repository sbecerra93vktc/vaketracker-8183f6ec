import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Thermometer } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import * as d3 from 'd3';

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
  const svgRef = useRef<SVGSVGElement>(null);

  // Guatemala state coordinates for creating polygons
  const guatemalaStates = {
    'Guatemala (Capital)': [
      [-90.8, 14.4], [-90.3, 14.4], [-90.3, 14.8], [-90.8, 14.8], [-90.8, 14.4]
    ],
    'Alta Verapaz': [
      [-91.5, 15.5], [-90.5, 15.5], [-90.5, 16.0], [-91.5, 16.0], [-91.5, 15.5]
    ],
    'Baja Verapaz': [
      [-90.8, 15.0], [-90.0, 15.0], [-90.0, 15.8], [-90.8, 15.8], [-90.8, 15.0]
    ],
    'Quiché': [
      [-92.0, 14.8], [-91.0, 14.8], [-91.0, 15.8], [-92.0, 15.8], [-92.0, 14.8]
    ],
    'Chimaltenango': [
      [-91.8, 14.2], [-90.8, 14.2], [-90.8, 15.0], [-91.8, 15.0], [-91.8, 14.2]
    ],
    'Sacatepéquez': [
      [-91.0, 14.3], [-90.5, 14.3], [-90.5, 14.8], [-91.0, 14.8], [-91.0, 14.3]
    ],
    'Jalapa': [
      [-90.5, 13.8], [-89.5, 13.8], [-89.5, 14.5], [-90.5, 14.5], [-90.5, 13.8]
    ],
    'Jutiapa': [
      [-90.2, 13.5], [-89.2, 13.5], [-89.2, 14.3], [-90.2, 14.3], [-90.2, 13.5]
    ],
    'Petén': [
      [-92.3, 16.0], [-88.3, 16.0], [-88.3, 17.8], [-92.3, 17.8], [-92.3, 16.0]
    ],
    'Izabal': [
      [-89.5, 15.2], [-88.1, 15.2], [-88.1, 15.9], [-89.5, 15.9], [-89.5, 15.2]
    ],
    'Zacapa': [
      [-90.0, 14.6], [-89.0, 14.6], [-89.0, 15.2], [-90.0, 15.2], [-90.0, 14.6]
    ],
    'El Progreso': [
      [-90.2, 14.8], [-89.8, 14.8], [-89.8, 15.1], [-90.2, 15.1], [-90.2, 14.8]
    ],
    'Escuintla': [
      [-91.3, 13.8], [-90.3, 13.8], [-90.3, 14.5], [-91.3, 14.5], [-91.3, 13.8]
    ],
    'Santa Rosa': [
      [-90.8, 13.8], [-89.8, 13.8], [-89.8, 14.3], [-90.8, 14.3], [-90.8, 13.8]
    ],
    'Sololá': [
      [-91.5, 14.4], [-90.8, 14.4], [-90.8, 14.9], [-91.5, 14.9], [-91.5, 14.4]
    ],
    'Retalhuleu': [
      [-92.0, 14.2], [-91.2, 14.2], [-91.2, 14.7], [-92.0, 14.7], [-92.0, 14.2]
    ],
    'San Marcos': [
      [-92.3, 14.8], [-91.6, 14.8], [-91.6, 15.3], [-92.3, 15.3], [-92.3, 14.8]
    ],
    'Huehuetenango': [
      [-92.2, 15.2], [-91.2, 15.2], [-91.2, 16.0], [-92.2, 16.0], [-92.2, 15.2]
    ],
    'Quetzaltenango': [
      [-91.8, 14.6], [-91.2, 14.6], [-91.2, 15.0], [-91.8, 15.0], [-91.8, 14.6]
    ],
    'Totonicapán': [
      [-91.6, 14.7], [-91.1, 14.7], [-91.1, 15.1], [-91.6, 15.1], [-91.6, 14.7]
    ],
    'Suchitepéquez': [
      [-91.7, 14.2], [-91.0, 14.2], [-91.0, 14.6], [-91.7, 14.6], [-91.7, 14.2]
    ]
  };

  const detectStateFromCoordinates = (lat: number, lng: number, country: string): string => {
    if (country === 'Guatemala') {
      // More precise Guatemala state detection
      if (lat >= 16.0 && lat <= 17.8 && lng >= -92.3 && lng <= -88.3) return 'Petén';
      if (lat >= 15.5 && lat <= 16.0 && lng >= -91.5 && lng <= -90.5) return 'Alta Verapaz';
      if (lat >= 15.0 && lat <= 15.8 && lng >= -90.8 && lng <= -90.0) return 'Baja Verapaz';
      if (lat >= 14.8 && lat <= 15.8 && lng >= -92.0 && lng <= -91.0) return 'Quiché';
      if (lat >= 14.2 && lat <= 15.0 && lng >= -91.8 && lng <= -90.8) return 'Chimaltenango';
      if (lat >= 14.3 && lat <= 14.8 && lng >= -91.0 && lng <= -90.5) return 'Sacatepéquez';
      if (lat >= 13.8 && lat <= 14.5 && lng >= -90.5 && lng <= -89.5) return 'Jalapa';
      if (lat >= 13.5 && lat <= 14.3 && lng >= -90.2 && lng <= -89.2) return 'Jutiapa';
      if (lat >= 15.2 && lat <= 15.9 && lng >= -89.5 && lng <= -88.1) return 'Izabal';
      if (lat >= 14.6 && lat <= 15.2 && lng >= -90.0 && lng <= -89.0) return 'Zacapa';
      if (lat >= 14.8 && lat <= 15.1 && lng >= -90.2 && lng <= -89.8) return 'El Progreso';
      if (lat >= 13.8 && lat <= 14.5 && lng >= -91.3 && lng <= -90.3) return 'Escuintla';
      if (lat >= 13.8 && lat <= 14.3 && lng >= -90.8 && lng <= -89.8) return 'Santa Rosa';
      if (lat >= 14.4 && lat <= 14.9 && lng >= -91.5 && lng <= -90.8) return 'Sololá';
      if (lat >= 14.2 && lat <= 14.7 && lng >= -92.0 && lng <= -91.2) return 'Retalhuleu';
      if (lat >= 14.8 && lat <= 15.3 && lng >= -92.3 && lng <= -91.6) return 'San Marcos';
      if (lat >= 15.2 && lat <= 16.0 && lng >= -92.2 && lng <= -91.2) return 'Huehuetenango';
      if (lat >= 14.6 && lat <= 15.0 && lng >= -91.8 && lng <= -91.2) return 'Quetzaltenango';
      if (lat >= 14.7 && lat <= 15.1 && lng >= -91.6 && lng <= -91.1) return 'Totonicapán';
      if (lat >= 14.2 && lat <= 14.6 && lng >= -91.7 && lng <= -91.0) return 'Suchitepéquez';
      if (lat >= 14.4 && lat <= 14.8 && lng >= -90.8 && lng <= -90.3) return 'Guatemala (Capital)';
      return 'Guatemala';
    }
    
    // Simplified detection for other countries
    if (country === 'México') {
      if (lat >= 19.0 && lat <= 25.0 && lng >= -89.0 && lng <= -86.0) return 'Quintana Roo';
      if (lat >= 20.0 && lat <= 22.5 && lng >= -90.5 && lng <= -88.0) return 'Yucatán';
      if (lat >= 19.0 && lat <= 21.5 && lng >= -91.0 && lng <= -89.0) return 'Campeche';
      if (lat >= 25.0 && lat <= 32.7 && lng >= -115.0 && lng <= -109.0) return 'Baja California';
      return 'Otra región';
    }
    
    if (country === 'El Salvador') {
      if (lat >= 13.5 && lat <= 14.5 && lng >= -89.5 && lng <= -88.8) return 'San Salvador';
      if (lat >= 13.8 && lat <= 14.2 && lng >= -89.8 && lng <= -89.2) return 'Santa Ana';
      if (lat >= 13.0 && lat <= 13.8 && lng >= -89.5 && lng <= -88.8) return 'La Libertad';
      return 'El Salvador';
    }
    
    if (country === 'Honduras') {
      if (lat >= 14.0 && lat <= 14.3 && lng >= -87.5 && lng <= -86.8) return 'Francisco Morazán';
      if (lat >= 15.3 && lat <= 15.8 && lng >= -88.2 && lng <= -87.5) return 'Cortés';
      if (lat >= 15.0 && lat <= 15.5 && lng >= -87.8 && lng <= -87.0) return 'Atlántida';
      return 'Honduras';
    }
    
    return country || 'Región detectada';
  };

  const detectCountryFromCoordinates = (lat: number, lng: number): string => {
    if (lat >= 13.0 && lat <= 17.8 && lng >= -92.5 && lng <= -88.0) return 'Guatemala';
    if (lat >= 12.0 && lat <= 14.5 && lng >= -90.5 && lng <= -87.0) return 'El Salvador';
    if (lat >= 12.5 && lat <= 16.5 && lng >= -89.5 && lng <= -83.0) return 'Honduras';
    if (lat >= 8.0 && lat <= 11.5 && lng >= -86.0 && lng <= -82.5) return 'Costa Rica';
    if (lat >= 7.0 && lat <= 9.7 && lng >= -83.0 && lng <= -77.0) return 'Panamá';
    if (lat >= -4.5 && lat <= 13.5 && lng >= -82.0 && lng <= -66.0) return 'Colombia';
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

      const regionCounts: Record<string, number> = {};
      
      locations?.forEach(location => {
        const detectedCountry = location.country || detectCountryFromCoordinates(location.latitude, location.longitude);
        
        if (detectedCountry === selectedCountry) {
          const region = location.state || detectStateFromCoordinates(location.latitude, location.longitude, detectedCountry);
          regionCounts[region] = (regionCounts[region] || 0) + 1;
        }
      });

      const maxCount = Math.max(...Object.values(regionCounts), 1);
      const heatData = Object.entries(regionCounts).map(([region, count]) => ({
        region,
        count,
        intensity: maxCount > 0 ? (count / maxCount) * 100 : 0
      }));

      setHeatMapData(heatData);
    } catch (error) {
      console.error('Error fetching heat map data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getIntensityColor = (intensity: number) => {
    if (intensity >= 80) return '#b91c1c'; // red-700
    if (intensity >= 60) return '#dc2626'; // red-600
    if (intensity >= 40) return '#ef4444'; // red-500
    if (intensity >= 20) return '#f87171'; // red-400
    if (intensity > 0) return '#fca5a5'; // red-300
    return '#f3f4f6'; // gray-100 for no data
  };

  const drawHeatMap = () => {
    if (!svgRef.current || loading) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const width = 800;
    const height = 600;
    
    svg.attr("width", width).attr("height", height);

    if (selectedCountry === 'Guatemala') {
      // Create a map projection for Guatemala
      const projection = d3.geoMercator()
        .center([-90.5, 15.5])
        .scale(8000)
        .translate([width / 2, height / 2]);

      const path = d3.geoPath().projection(projection);

      // Draw state polygons for Guatemala
      Object.entries(guatemalaStates).forEach(([stateName, coordinates]) => {
        const stateData = heatMapData.find(d => d.region === stateName);
        const intensity = stateData ? stateData.intensity : 0;
        
        const pathData = d3.geoPath().projection(projection)({
          type: "Feature",
          properties: {},
          geometry: {
            type: "Polygon",
            coordinates: [coordinates]
          }
        });

        svg.append("path")
          .attr("d", pathData)
          .attr("fill", getIntensityColor(intensity))
          .attr("stroke", "#374151")
          .attr("stroke-width", 1)
          .attr("opacity", 0.8)
          .on("mouseover", function(event, d) {
            d3.select(this).attr("stroke-width", 2);
            
            // Create tooltip
            const tooltip = d3.select("body").append("div")
              .attr("class", "tooltip")
              .style("position", "absolute")
              .style("background", "rgba(0, 0, 0, 0.8)")
              .style("color", "white")
              .style("padding", "8px")
              .style("border-radius", "4px")
              .style("font-size", "12px")
              .style("pointer-events", "none")
              .style("z-index", "1000");
            
            tooltip.html(`
              <strong>${stateName}</strong><br/>
              Actividades: ${stateData ? stateData.count : 0}
            `)
            .style("left", (event.pageX + 10) + "px")
            .style("top", (event.pageY - 10) + "px");
          })
          .on("mouseout", function() {
            d3.select(this).attr("stroke-width", 1);
            d3.selectAll(".tooltip").remove();
          });
      });

    } else {
      // For other countries, show a simple message
      svg.append("text")
        .attr("x", width / 2)
        .attr("y", height / 2)
        .attr("text-anchor", "middle")
        .attr("class", "text-muted-foreground")
        .style("font-size", "16px")
        .text(`Mapa de ${selectedCountry} próximamente disponible`);
    }
  };

  useEffect(() => {
    fetchHeatMapData();
  }, [selectedCountry]);

  useEffect(() => {
    if (!loading && heatMapData.length > 0) {
      drawHeatMap();
    }
  }, [heatMapData, loading, selectedCountry]);

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
          ) : (
            <div className="space-y-4">
              <div className="w-full flex justify-center">
                <svg ref={svgRef} className="border rounded-lg bg-background"></svg>
              </div>
              
              <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground">
                <span>Menor intensidad</span>
                <div className="flex gap-1">
                  <div className="w-4 h-3 rounded" style={{ backgroundColor: '#fca5a5' }} />
                  <div className="w-4 h-3 rounded" style={{ backgroundColor: '#f87171' }} />
                  <div className="w-4 h-3 rounded" style={{ backgroundColor: '#ef4444' }} />
                  <div className="w-4 h-3 rounded" style={{ backgroundColor: '#dc2626' }} />
                  <div className="w-4 h-3 rounded" style={{ backgroundColor: '#b91c1c' }} />
                </div>
                <span>Mayor intensidad</span>
              </div>

              {selectedCountry === 'Guatemala' && heatMapData.length > 0 && (
                <div className="mt-4 text-center text-sm text-muted-foreground">
                  <p>Pasa el cursor sobre las regiones para ver detalles</p>
                </div>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default HeatMapComponent;