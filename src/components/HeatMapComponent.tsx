import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Thermometer } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import * as d3 from 'd3';
import * as topojson from 'topojson-client';

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

  // Comprehensive state/region coordinates for all countries
  const countryRegions = {
    'Mexico': {
      'Aguascalientes': [[-102.5, 21.7], [-102.0, 21.7], [-102.0, 22.3], [-102.5, 22.3], [-102.5, 21.7]],
      'Baja California': [[-117.1, 32.0], [-114.1, 32.0], [-114.1, 32.7], [-117.1, 32.7], [-117.1, 32.0]],
      'Baja California Sur': [[-115.0, 23.0], [-109.4, 23.0], [-109.4, 28.0], [-115.0, 28.0], [-115.0, 23.0]],
      'Campeche': [[-92.5, 17.8], [-89.1, 17.8], [-89.1, 20.7], [-92.5, 20.7], [-92.5, 17.8]],
      'Chiapas': [[-94.5, 14.5], [-90.2, 14.5], [-90.2, 17.5], [-94.5, 17.5], [-94.5, 14.5]],
      'Chihuahua': [[-109.1, 25.5], [-103.2, 25.5], [-103.2, 31.8], [-109.1, 31.8], [-109.1, 25.5]],
      'Ciudad de México': [[-99.4, 19.1], [-98.9, 19.1], [-98.9, 19.6], [-99.4, 19.6], [-99.4, 19.1]],
      'Coahuila': [[-105.7, 25.0], [-99.8, 25.0], [-99.8, 29.9], [-105.7, 29.9], [-105.7, 25.0]],
      'Colima': [[-104.8, 18.6], [-103.5, 18.6], [-103.5, 19.6], [-104.8, 19.6], [-104.8, 18.6]],
      'Durango': [[-107.1, 22.3], [-102.5, 22.3], [-102.5, 26.9], [-107.1, 26.9], [-107.1, 22.3]],
      'Estado de México': [[-100.5, 18.9], [-98.6, 18.9], [-98.6, 20.4], [-100.5, 20.4], [-100.5, 18.9]],
      'Guanajuato': [[-102.1, 19.9], [-99.6, 19.9], [-99.6, 21.7], [-102.1, 21.7], [-102.1, 19.9]],
      'Guerrero': [[-102.2, 16.6], [-98.0, 16.6], [-98.0, 18.9], [-102.2, 18.9], [-102.2, 16.6]],
      'Hidalgo': [[-99.9, 19.6], [-97.9, 19.6], [-97.9, 21.4], [-99.9, 21.4], [-99.9, 19.6]],
      'Jalisco': [[-105.7, 18.9], [-101.5, 18.9], [-101.5, 22.8], [-105.7, 22.8], [-105.7, 18.9]],
      'Michoacán': [[-103.7, 17.9], [-100.0, 17.9], [-100.0, 20.4], [-103.7, 20.4], [-103.7, 17.9]],
      'Morelos': [[-99.6, 18.3], [-98.6, 18.3], [-98.6, 19.1], [-99.6, 19.1], [-99.6, 18.3]],
      'Nayarit': [[-105.8, 20.6], [-103.7, 20.6], [-103.7, 23.1], [-105.8, 23.1], [-105.8, 20.6]],
      'Nuevo León': [[-101.6, 23.1], [-98.8, 23.1], [-98.8, 27.8], [-101.6, 27.8], [-101.6, 23.1]],
      'Oaxaca': [[-98.8, 15.6], [-93.5, 15.6], [-93.5, 18.7], [-98.8, 18.7], [-98.8, 15.6]],
      'Puebla': [[-99.0, 17.5], [-96.4, 17.5], [-96.4, 20.9], [-99.0, 20.9], [-99.0, 17.5]],
      'Querétaro': [[-100.9, 20.1], [-99.0, 20.1], [-99.0, 21.7], [-100.9, 21.7], [-100.9, 20.1]],
      'Quintana Roo': [[-89.2, 17.8], [-86.7, 17.8], [-86.7, 21.6], [-89.2, 21.6], [-89.2, 17.8]],
      'San Luis Potosí': [[-102.0, 21.1], [-98.3, 21.1], [-98.3, 24.5], [-102.0, 24.5], [-102.0, 21.1]],
      'Sinaloa': [[-109.5, 22.5], [-105.4, 22.5], [-105.4, 26.9], [-109.5, 26.9], [-109.5, 22.5]],
      'Sonora': [[-115.0, 26.0], [-108.4, 26.0], [-108.4, 32.5], [-115.0, 32.5], [-115.0, 26.0]],
      'Tabasco': [[-94.8, 17.3], [-91.4, 17.3], [-91.4, 18.7], [-94.8, 18.7], [-94.8, 17.3]],
      'Tamaulipas': [[-100.2, 22.2], [-97.1, 22.2], [-97.1, 27.7], [-100.2, 27.7], [-100.2, 22.2]],
      'Tlaxcala': [[-98.8, 19.1], [-97.7, 19.1], [-97.7, 19.9], [-98.8, 19.9], [-98.8, 19.1]],
      'Veracruz': [[-98.6, 17.1], [-93.6, 17.1], [-93.6, 22.5], [-98.6, 22.5], [-98.6, 17.1]],
      'Yucatán': [[-90.5, 19.5], [-87.5, 19.5], [-87.5, 21.6], [-90.5, 21.6], [-90.5, 19.5]],
      'Zacatecas': [[-104.4, 21.0], [-101.0, 21.0], [-101.0, 25.1], [-104.4, 25.1], [-104.4, 21.0]]
    },
    'Guatemala': {
      'Guatemala (Capital)': [[-90.8, 14.4], [-90.3, 14.4], [-90.3, 14.8], [-90.8, 14.8], [-90.8, 14.4]],
      'Alta Verapaz': [[-91.5, 15.5], [-90.5, 15.5], [-90.5, 16.0], [-91.5, 16.0], [-91.5, 15.5]],
      'Baja Verapaz': [[-90.8, 15.0], [-90.0, 15.0], [-90.0, 15.8], [-90.8, 15.8], [-90.8, 15.0]],
      'Chimaltenango': [[-91.8, 14.2], [-90.8, 14.2], [-90.8, 15.0], [-91.8, 15.0], [-91.8, 14.2]],
      'Chiquimula': [[-89.8, 14.3], [-89.1, 14.3], [-89.1, 14.9], [-89.8, 14.9], [-89.8, 14.3]],
      'El Progreso': [[-90.2, 14.8], [-89.8, 14.8], [-89.8, 15.1], [-90.2, 15.1], [-90.2, 14.8]],
      'Escuintla': [[-91.3, 13.8], [-90.3, 13.8], [-90.3, 14.5], [-91.3, 14.5], [-91.3, 13.8]],
      'Huehuetenango': [[-92.2, 15.2], [-91.2, 15.2], [-91.2, 16.0], [-92.2, 16.0], [-92.2, 15.2]],
      'Izabal': [[-89.5, 15.2], [-88.1, 15.2], [-88.1, 15.9], [-89.5, 15.9], [-89.5, 15.2]],
      'Jalapa': [[-90.5, 13.8], [-89.5, 13.8], [-89.5, 14.5], [-90.5, 14.5], [-90.5, 13.8]],
      'Jutiapa': [[-90.2, 13.5], [-89.2, 13.5], [-89.2, 14.3], [-90.2, 14.3], [-90.2, 13.5]],
      'Petén': [[-92.3, 16.0], [-88.3, 16.0], [-88.3, 17.8], [-92.3, 17.8], [-92.3, 16.0]],
      'Quetzaltenango': [[-91.8, 14.6], [-91.2, 14.6], [-91.2, 15.0], [-91.8, 15.0], [-91.8, 14.6]],
      'Quiché': [[-92.0, 14.8], [-91.0, 14.8], [-91.0, 15.8], [-92.0, 15.8], [-92.0, 14.8]],
      'Retalhuleu': [[-92.0, 14.2], [-91.2, 14.2], [-91.2, 14.7], [-92.0, 14.7], [-92.0, 14.2]],
      'Sacatepéquez': [[-91.0, 14.3], [-90.5, 14.3], [-90.5, 14.8], [-91.0, 14.8], [-91.0, 14.3]],
      'San Marcos': [[-92.3, 14.8], [-91.6, 14.8], [-91.6, 15.3], [-92.3, 15.3], [-92.3, 14.8]],
      'Santa Rosa': [[-90.8, 13.8], [-89.8, 13.8], [-89.8, 14.3], [-90.8, 14.3], [-90.8, 13.8]],
      'Sololá': [[-91.5, 14.4], [-90.8, 14.4], [-90.8, 14.9], [-91.5, 14.9], [-91.5, 14.4]],
      'Suchitepéquez': [[-91.7, 14.2], [-91.0, 14.2], [-91.0, 14.6], [-91.7, 14.6], [-91.7, 14.2]],
      'Totonicapán': [[-91.6, 14.7], [-91.1, 14.7], [-91.1, 15.1], [-91.6, 15.1], [-91.6, 14.7]],
      'Zacapa': [[-90.0, 14.6], [-89.0, 14.6], [-89.0, 15.2], [-90.0, 15.2], [-90.0, 14.6]]
    },
    'El Salvador': {
      'Ahuachapán': [[-90.2, 13.9], [-89.7, 13.9], [-89.7, 14.3], [-90.2, 14.3], [-90.2, 13.9]],
      'Cabañas': [[-89.1, 13.7], [-88.7, 13.7], [-88.7, 14.2], [-89.1, 14.2], [-89.1, 13.7]],
      'Chalatenango': [[-89.3, 14.0], [-88.8, 14.0], [-88.8, 14.4], [-89.3, 14.4], [-89.3, 14.0]],
      'Cuscatlán': [[-89.0, 13.6], [-88.6, 13.6], [-88.6, 14.0], [-89.0, 14.0], [-89.0, 13.6]],
      'La Libertad': [[-89.8, 13.3], [-89.2, 13.3], [-89.2, 13.8], [-89.8, 13.8], [-89.8, 13.3]],
      'La Paz': [[-89.2, 13.4], [-88.8, 13.4], [-88.8, 13.8], [-89.2, 13.8], [-89.2, 13.4]],
      'La Unión': [[-88.2, 13.2], [-87.7, 13.2], [-87.7, 13.8], [-88.2, 13.8], [-88.2, 13.2]],
      'Morazán': [[-88.4, 13.6], [-87.9, 13.6], [-87.9, 14.2], [-88.4, 14.2], [-88.4, 13.6]],
      'San Miguel': [[-88.4, 13.3], [-87.9, 13.3], [-87.9, 13.9], [-88.4, 13.9], [-88.4, 13.3]],
      'San Salvador': [[-89.4, 13.6], [-89.0, 13.6], [-89.0, 14.0], [-89.4, 14.0], [-89.4, 13.6]],
      'San Vicente': [[-88.9, 13.5], [-88.5, 13.5], [-88.5, 13.9], [-88.9, 13.9], [-88.9, 13.5]],
      'Santa Ana': [[-89.8, 13.9], [-89.4, 13.9], [-89.4, 14.3], [-89.8, 14.3], [-89.8, 13.9]],
      'Sonsonate': [[-90.0, 13.6], [-89.6, 13.6], [-89.6, 14.0], [-90.0, 14.0], [-90.0, 13.6]],
      'Usulután': [[-88.6, 13.2], [-88.0, 13.2], [-88.0, 13.8], [-88.6, 13.8], [-88.6, 13.2]]
    },
    'Honduras': {
      'Atlántida': [[-87.8, 15.4], [-87.0, 15.4], [-87.0, 15.9], [-87.8, 15.9], [-87.8, 15.4]],
      'Choluteca': [[-87.8, 13.0], [-86.9, 13.0], [-86.9, 13.8], [-87.8, 13.8], [-87.8, 13.0]],
      'Colón': [[-86.5, 15.5], [-85.8, 15.5], [-85.8, 16.0], [-86.5, 16.0], [-86.5, 15.5]],
      'Comayagua': [[-88.2, 14.2], [-87.4, 14.2], [-87.4, 14.8], [-88.2, 14.8], [-88.2, 14.2]],
      'Copán': [[-89.4, 14.5], [-88.8, 14.5], [-88.8, 15.1], [-89.4, 15.1], [-89.4, 14.5]],
      'Cortés': [[-88.4, 15.2], [-87.8, 15.2], [-87.8, 15.8], [-88.4, 15.8], [-88.4, 15.2]],
      'El Paraíso': [[-86.8, 13.5], [-85.9, 13.5], [-85.9, 14.2], [-86.8, 14.2], [-86.8, 13.5]],
      'Francisco Morazán': [[-87.6, 13.8], [-86.8, 13.8], [-86.8, 14.6], [-87.6, 14.6], [-87.6, 13.8]],
      'Gracias a Dios': [[-85.5, 14.5], [-83.2, 14.5], [-83.2, 15.9], [-85.5, 15.9], [-85.5, 14.5]],
      'Intibucá': [[-88.4, 14.0], [-87.8, 14.0], [-87.8, 14.6], [-88.4, 14.6], [-88.4, 14.0]],
      'Islas de la Bahía': [[-86.6, 16.2], [-85.8, 16.2], [-85.8, 16.6], [-86.6, 16.6], [-86.6, 16.2]],
      'La Paz': [[-88.1, 14.0], [-87.5, 14.0], [-87.5, 14.5], [-88.1, 14.5], [-88.1, 14.0]],
      'Lempira': [[-89.0, 14.3], [-88.3, 14.3], [-88.3, 14.9], [-89.0, 14.9], [-89.0, 14.3]],
      'Ocotepeque': [[-89.4, 14.2], [-88.8, 14.2], [-88.8, 14.8], [-89.4, 14.8], [-89.4, 14.2]],
      'Olancho': [[-86.8, 14.2], [-85.2, 14.2], [-85.2, 15.8], [-86.8, 15.8], [-86.8, 14.2]],
      'Santa Bárbara': [[-88.8, 14.7], [-88.0, 14.7], [-88.0, 15.3], [-88.8, 15.3], [-88.8, 14.7]],
      'Valle': [[-87.7, 13.2], [-87.0, 13.2], [-87.0, 13.8], [-87.7, 13.8], [-87.7, 13.2]],
      'Yoro': [[-87.8, 14.8], [-87.0, 14.8], [-87.0, 15.6], [-87.8, 15.6], [-87.8, 14.8]]
    },
    'Nicaragua': {
      'Boaco': [[-85.8, 12.2], [-85.2, 12.2], [-85.2, 12.8], [-85.8, 12.8], [-85.8, 12.2]],
      'Carazo': [[-86.8, 11.4], [-86.2, 11.4], [-86.2, 12.0], [-86.8, 12.0], [-86.8, 11.4]],
      'Chinandega': [[-87.8, 12.4], [-86.8, 12.4], [-86.8, 13.4], [-87.8, 13.4], [-87.8, 12.4]],
      'Chontales': [[-85.6, 11.8], [-84.8, 11.8], [-84.8, 12.6], [-85.6, 12.6], [-85.6, 11.8]],
      'Costa Caribe Norte': [[-85.0, 13.5], [-83.2, 13.5], [-83.2, 15.1], [-85.0, 15.1], [-85.0, 13.5]],
      'Costa Caribe Sur': [[-85.0, 11.0], [-82.8, 11.0], [-82.8, 13.5], [-85.0, 13.5], [-85.0, 11.0]],
      'Estelí': [[-86.8, 13.0], [-86.0, 13.0], [-86.0, 13.6], [-86.8, 13.6], [-86.8, 13.0]],
      'Granada': [[-86.2, 11.7], [-85.8, 11.7], [-85.8, 12.1], [-86.2, 12.1], [-86.2, 11.7]],
      'Jinotega': [[-86.4, 13.0], [-85.4, 13.0], [-85.4, 13.8], [-86.4, 13.8], [-86.4, 13.0]],
      'León': [[-87.2, 12.2], [-86.4, 12.2], [-86.4, 12.8], [-87.2, 12.8], [-87.2, 12.2]],
      'Madriz': [[-86.8, 13.3], [-86.2, 13.3], [-86.2, 13.7], [-86.8, 13.7], [-86.8, 13.3]],
      'Managua': [[-86.6, 11.8], [-85.8, 11.8], [-85.8, 12.4], [-86.6, 12.4], [-86.6, 11.8]],
      'Masaya': [[-86.4, 11.8], [-85.8, 11.8], [-85.8, 12.2], [-86.4, 12.2], [-86.4, 11.8]],
      'Matagalpa': [[-86.2, 12.8], [-85.2, 12.8], [-85.2, 13.6], [-86.2, 13.6], [-86.2, 12.8]],
      'Nueva Segovia': [[-86.8, 13.6], [-86.0, 13.6], [-86.0, 14.0], [-86.8, 14.0], [-86.8, 13.6]],
      'Río San Juan': [[-85.4, 10.8], [-83.8, 10.8], [-83.8, 11.6], [-85.4, 11.6], [-85.4, 10.8]],
      'Rivas': [[-86.0, 11.0], [-85.4, 11.0], [-85.4, 11.8], [-86.0, 11.8], [-86.0, 11.0]]
    },
    'Costa Rica': {
      'Cartago': [[-84.2, 9.6], [-83.7, 9.6], [-83.7, 10.1], [-84.2, 10.1], [-84.2, 9.6]],
      'Guanacaste': [[-86.2, 10.0], [-85.0, 10.0], [-85.0, 11.2], [-86.2, 11.2], [-86.2, 10.0]],
      'Heredia': [[-84.4, 9.9], [-83.9, 9.9], [-83.9, 10.3], [-84.4, 10.3], [-84.4, 9.9]],
      'Limón': [[-83.8, 9.0], [-82.5, 9.0], [-82.5, 10.8], [-83.8, 10.8], [-83.8, 9.0]],
      'Puntarenas': [[-85.4, 8.4], [-82.8, 8.4], [-82.8, 11.2], [-85.4, 11.2], [-85.4, 8.4]],
      'San José': [[-84.4, 9.5], [-83.7, 9.5], [-83.7, 10.2], [-84.4, 10.2], [-84.4, 9.5]]
    }
  };

  // Improved state boundaries and detection
  const mexicanStates = {
    'Quintana Roo': [
      [[-86.0, 18.5], [-86.0, 22.0], [-88.0, 22.0], [-88.0, 18.5], [-86.0, 18.5]]
    ],
    'Yucatán': [
      [[-88.0, 20.0], [-88.0, 21.6], [-90.5, 21.6], [-90.5, 20.0], [-88.0, 20.0]]
    ],
    'Campeche': [
      [[-90.5, 17.8], [-90.5, 20.8], [-92.5, 20.8], [-92.5, 17.8], [-90.5, 17.8]]
    ]
  };

  const detectStateFromCoordinates = (lat: number, lng: number, country: string): string => {
    if (country === 'Guatemala') {
      // Guatemala City area - expanded to include more of the central region
      if (lat >= 14.5 && lat <= 14.7 && lng >= -90.7 && lng <= -90.4) return 'Guatemala (Capital)';
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
      return 'Guatemala (Capital)'; // Default for Guatemala coordinates
    }
    
    if (country === 'Mexico') {
      const regions = countryRegions.Mexico;
      for (const [stateName, coordinates] of Object.entries(regions)) {
        // Check if point is inside the bounding box for this state
        const lngs = coordinates.map(coord => coord[0]);
        const lats = coordinates.map(coord => coord[1]);
        const minLng = Math.min(...lngs);
        const maxLng = Math.max(...lngs);
        const minLat = Math.min(...lats);
        const maxLat = Math.max(...lats);
        
        if (lat >= minLat && lat <= maxLat && lng >= minLng && lng <= maxLng) {
          return stateName;
        }
      }
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
      console.log('Fetching heat map data for country:', selectedCountry);
      
      const { data: locations, error } = await supabase
        .from('locations')
        .select('latitude, longitude, country, state');

      if (error) throw error;
      console.log('Fetched locations:', locations);

      const regionCounts: Record<string, number> = {};
      
      locations?.forEach(location => {
        const detectedCountry = location.country || detectCountryFromCoordinates(location.latitude, location.longitude);
        console.log(`Location: ${location.latitude}, ${location.longitude} -> Country: ${detectedCountry}`);
        
        if (detectedCountry === selectedCountry) {
          const region = location.state || detectStateFromCoordinates(location.latitude, location.longitude, detectedCountry);
          console.log(`Matched location in ${selectedCountry}, region: ${region}`);
          regionCounts[region] = (regionCounts[region] || 0) + 1;
        }
      });

      console.log('Region counts for', selectedCountry, ':', regionCounts);
      const maxCount = Math.max(...Object.values(regionCounts), 1);
      const heatData = Object.entries(regionCounts).map(([region, count]) => ({
        region,
        count,
        intensity: maxCount > 0 ? (count / maxCount) * 100 : 0
      }));

      console.log('Heat map data:', heatData);
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

    // Create geographic visualizations for countries with state boundaries
    if (selectedCountry === 'Guatemala') {
      // Create a map projection for Guatemala
      const projection = d3.geoMercator()
        .center([-90.5, 15.5])
        .scale(8000)
        .translate([width / 2, height / 2]);

      // Draw all Guatemala states with their boundaries and colors
      Object.entries(countryRegions.Guatemala).forEach(([stateName, coordinates]) => {
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

        if (pathData) {
          svg.append("path")
            .attr("d", pathData)
            .attr("fill", getIntensityColor(intensity))
            .attr("stroke", "#374151")
            .attr("stroke-width", 1)
            .attr("opacity", 0.8)
            .style("cursor", "pointer")
            .on("mouseover", function(event) {
              d3.select(this).attr("stroke-width", 2).attr("opacity", 1);
              
              // Create tooltip
              const tooltip = d3.select("body").append("div")
                .attr("class", "heatmap-tooltip")
                .style("position", "absolute")
                .style("background", "rgba(0, 0, 0, 0.9)")
                .style("color", "white")
                .style("padding", "8px 12px")
                .style("border-radius", "6px")
                .style("font-size", "13px")
                .style("pointer-events", "none")
                .style("z-index", "1000")
                .style("box-shadow", "0 4px 6px rgba(0, 0, 0, 0.1)");
              
              tooltip.html(`
                <div><strong>${stateName}</strong></div>
                <div>Actividades: ${stateData ? stateData.count : 0}</div>
                <div>Intensidad: ${intensity.toFixed(0)}%</div>
              `)
              .style("left", (event.pageX + 10) + "px")
              .style("top", (event.pageY - 10) + "px");
            })
            .on("mouseout", function() {
              d3.select(this).attr("stroke-width", 1).attr("opacity", 0.8);
              d3.selectAll(".heatmap-tooltip").remove();
            });
        }
      });

    } else if (selectedCountry === 'México') {
      // Create a map projection for Mexico (focused on southern region)
      const projection = d3.geoMercator()
        .center([-88.5, 20.0])
        .scale(4000)
        .translate([width / 2, height / 2]);

      // Draw Mexican states with their boundaries and colors
      Object.entries(mexicanStates).forEach(([stateName, coordinates]) => {
        const stateData = heatMapData.find(d => d.region === stateName);
        const intensity = stateData ? stateData.intensity : 0;
        
        const pathData = d3.geoPath().projection(projection)({
          type: "Feature",
          properties: {},
          geometry: {
            type: "Polygon",
            coordinates: coordinates
          }
        });

        if (pathData) {
          svg.append("path")
            .attr("d", pathData)
            .attr("fill", getIntensityColor(intensity))
            .attr("stroke", "#374151")
            .attr("stroke-width", 1)
            .attr("opacity", 0.8)
            .style("cursor", "pointer")
            .on("mouseover", function(event) {
              d3.select(this).attr("stroke-width", 2).attr("opacity", 1);
              
              // Create tooltip
              const tooltip = d3.select("body").append("div")
                .attr("class", "heatmap-tooltip")
                .style("position", "absolute")
                .style("background", "rgba(0, 0, 0, 0.9)")
                .style("color", "white")
                .style("padding", "8px 12px")
                .style("border-radius", "6px")
                .style("font-size", "13px")
                .style("pointer-events", "none")
                .style("z-index", "1000")
                .style("box-shadow", "0 4px 6px rgba(0, 0, 0, 0.1)");
              
              tooltip.html(`
                <div><strong>${stateName}</strong></div>
                <div>Actividades: ${stateData ? stateData.count : 0}</div>
                <div>Intensidad: ${intensity.toFixed(0)}%</div>
              `)
              .style("left", (event.pageX + 10) + "px")
              .style("top", (event.pageY - 10) + "px");
            })
            .on("mouseout", function() {
              d3.select(this).attr("stroke-width", 1).attr("opacity", 0.8);
              d3.selectAll(".heatmap-tooltip").remove();
            });
        }
      });

    } else {
      // For other countries, show data as an interactive bar chart
      if (heatMapData.length > 0) {
        const maxCount = Math.max(...heatMapData.map(d => d.count));
        
        svg.append("text")
          .attr("x", width / 2)
          .attr("y", 30)
          .attr("text-anchor", "middle")
          .attr("font-size", "18px")
          .attr("font-weight", "bold")
          .attr("fill", "#374151")
          .text(`Actividades por región en ${selectedCountry}`);
        
        // Show regions as interactive colored bars
        heatMapData.forEach((data, index) => {
          const y = 70 + index * 50;
          const barWidth = (data.count / maxCount) * 500;
          
          // Background rectangle
          svg.append("rect")
            .attr("x", 50)
            .attr("y", y)
            .attr("width", 600)
            .attr("height", 40)
            .attr("fill", "#f9fafb")
            .attr("stroke", "#e5e7eb")
            .attr("rx", 6)
            .style("cursor", "pointer");
          
          // Data rectangle with hover effect
          svg.append("rect")
            .attr("x", 50)
            .attr("y", y)
            .attr("width", barWidth)
            .attr("height", 40)
            .attr("fill", getIntensityColor(data.intensity))
            .attr("rx", 6)
            .style("cursor", "pointer")
            .on("mouseover", function() {
              d3.select(this).attr("opacity", 0.8);
            })
            .on("mouseout", function() {
              d3.select(this).attr("opacity", 1);
            });
          
          // Region name
          svg.append("text")
            .attr("x", 60)
            .attr("y", y + 25)
            .attr("font-size", "14px")
            .attr("font-weight", "600")
            .attr("fill", "#1f2937")
            .text(data.region);
          
          // Count
          svg.append("text")
            .attr("x", 660)
            .attr("y", y + 25)
            .attr("font-size", "13px")
            .attr("fill", "#6b7280")
            .attr("text-anchor", "end")
            .text(`${data.count} actividades (${data.intensity.toFixed(0)}%)`);
        });
      } else {
        // No data message for countries without activities
        svg.append("text")
          .attr("x", width / 2)
          .attr("y", height / 2 - 20)
          .attr("text-anchor", "middle")
          .attr("font-size", "18px")
          .attr("font-weight", "600")
          .attr("fill", "#6b7280")
          .text(`Sin actividades en ${selectedCountry}`);
        
        svg.append("text")
          .attr("x", width / 2)
          .attr("y", height / 2 + 10)
          .attr("text-anchor", "middle")
          .attr("font-size", "14px")
          .attr("fill", "#9ca3af")
          .text("Cuando se registren actividades aparecerán aquí");
      }
    }
  };

  useEffect(() => {
    fetchHeatMapData();
  }, [selectedCountry]);

  useEffect(() => {
    if (!loading) {
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
                <svg 
                  ref={svgRef} 
                  width={800} 
                  height={600}
                  className="border rounded-lg bg-background"
                ></svg>
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