import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon, BarChart3 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

interface ActivityData {
  state: string;
  activities: number;
}

interface Profile {
  user_id: string;
  first_name: string;
  last_name: string;
  country: string;
}

const ActivityChart = () => {
  const [activityData, setActivityData] = useState<ActivityData[]>([]);
  const [selectedCountry, setSelectedCountry] = useState<string>('Mexico');
  const [selectedUser, setSelectedUser] = useState<string>('all');
  const [dateFrom, setDateFrom] = useState<Date | undefined>(new Date(new Date().getFullYear(), 0, 1));
  const [dateTo, setDateTo] = useState<Date | undefined>(new Date());
  const [loading, setLoading] = useState(true);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const { userRole } = useAuth();

  // All Mexican states
  const mexicanStates = [
    'Aguascalientes', 'Baja California', 'Baja California Sur', 'Campeche', 'Chiapas', 'Chihuahua',
    'Ciudad de México', 'Coahuila', 'Colima', 'Durango', 'Estado de México', 'Guanajuato',
    'Guerrero', 'Hidalgo', 'Jalisco', 'Michoacán', 'Morelos', 'Nayarit', 'Nuevo León',
    'Oaxaca', 'Puebla', 'Querétaro', 'Quintana Roo', 'San Luis Potosí', 'Sinaloa',
    'Sonora', 'Tabasco', 'Tamaulipas', 'Tlaxcala', 'Veracruz', 'Yucatán', 'Zacatecas'
  ];

  // All Guatemalan departments
  const guatemalanDepartments = [
    'Guatemala (Capital)', 'Alta Verapaz', 'Baja Verapaz', 'Chimaltenango', 'Chiquimula',
    'El Progreso', 'Escuintla', 'Huehuetenango', 'Izabal', 'Jalapa', 'Jutiapa', 'Petén',
    'Quetzaltenango', 'Quiché', 'Retalhuleu', 'Sacatepéquez', 'San Marcos', 'Santa Rosa',
    'Sololá', 'Suchitepéquez', 'Totonicapán', 'Zacapa'
  ];

  // Other countries' states/departments
  const countryRegions = {
    'Mexico': mexicanStates,
    'Guatemala': guatemalanDepartments,
    'El Salvador': ['Ahuachapán', 'Cabañas', 'Chalatenango', 'Cuscatlán', 'La Libertad', 'La Paz', 'La Unión', 'Morazán', 'San Miguel', 'San Salvador', 'San Vicente', 'Santa Ana', 'Sonsonate', 'Usulután'],
    'Honduras': ['Atlántida', 'Choluteca', 'Colón', 'Comayagua', 'Copán', 'Cortés', 'El Paraíso', 'Francisco Morazán', 'Gracias a Dios', 'Intibucá', 'Islas de la Bahía', 'La Paz', 'Lempira', 'Ocotepeque', 'Olancho', 'Santa Bárbara', 'Valle', 'Yoro'],
    'Nicaragua': ['Boaco', 'Carazo', 'Chinandega', 'Chontales', 'Costa Caribe Norte', 'Costa Caribe Sur', 'Estelí', 'Granada', 'Jinotega', 'León', 'Madriz', 'Managua', 'Masaya', 'Matagalpa', 'Nueva Segovia', 'Río San Juan', 'Rivas'],
    'Costa Rica': ['Cartago', 'Guanacaste', 'Heredia', 'Limón', 'Puntarenas', 'San José']
  };

  const detectStateFromCoordinates = (lat: number, lng: number, country: string): string => {
    if (country === 'Mexico') {
      // Quintana Roo coordinates detection
      if (lat >= 17.8 && lat <= 21.6 && lng >= -89.2 && lng <= -86.7) return 'Quintana Roo';
      // Add more Mexican state detection logic here based on coordinates
      if (lat >= 25.5 && lat <= 31.8 && lng >= -109.1 && lng <= -103.2) return 'Chihuahua';
      if (lat >= 22.3 && lat <= 26.9 && lng >= -107.1 && lng <= -102.5) return 'Durango';
      if (lat >= 18.9 && lat <= 22.8 && lng >= -105.7 && lng <= -101.5) return 'Jalisco';
      // Add more states as needed
      return 'Otra región';
    }
    
    if (country === 'Guatemala') {
      // Guatemala detection logic
      if (lat >= 14.5 && lat <= 14.7 && lng >= -90.7 && lng <= -90.4) return 'Guatemala (Capital)';
      if (lat >= 16.0 && lat <= 17.8 && lng >= -92.3 && lng <= -88.3) return 'Petén';
      // Add more departments
      return 'Guatemala (Capital)';
    }
    
    return country || 'Región detectada';
  };

  const detectCountryFromCoordinates = (lat: number, lng: number): string => {
    // Guatemala first (more specific range to avoid overlap with Mexico)
    if (lat >= 13.0 && lat <= 17.8 && lng >= -92.5 && lng <= -88.0) return 'Guatemala';
    // El Salvador
    if (lat >= 12.0 && lat <= 14.5 && lng >= -90.5 && lng <= -87.0) return 'El Salvador';
    // Honduras  
    if (lat >= 12.5 && lat <= 16.5 && lng >= -89.5 && lng <= -83.0) return 'Honduras';
    // Costa Rica
    if (lat >= 8.0 && lat <= 11.5 && lng >= -86.0 && lng <= -82.5) return 'Costa Rica';
    // Mexico (broader range but checked last to avoid conflicts)
    if (lat >= 14.5 && lat <= 32.7 && lng >= -118.4 && lng <= -86.7) return 'Mexico';
    return '';
  };

  const fetchProfiles = async () => {
    try {
      const { data: profilesData, error } = await supabase
        .from('profiles')
        .select('user_id, first_name, last_name, country')
        .eq('country', selectedCountry);

      if (error) throw error;
      setProfiles(profilesData || []);
    } catch (error) {
      console.error('Error fetching profiles:', error);
    }
  };

  const fetchActivityData = async () => {
    try {
      setLoading(true);
      console.log('Fetching activity data for country:', selectedCountry, 'user:', selectedUser, 'dates:', dateFrom, dateTo);
      
      let query = supabase
        .from('locations')
        .select('latitude, longitude, country, state, user_id, created_at');

      // Add date filters
      if (dateFrom) {
        query = query.gte('created_at', format(dateFrom, 'yyyy-MM-dd'));
      }
      if (dateTo) {
        const nextDay = new Date(dateTo);
        nextDay.setDate(nextDay.getDate() + 1);
        query = query.lt('created_at', format(nextDay, 'yyyy-MM-dd'));
      }

      // Add user filter
      if (selectedUser !== 'all') {
        query = query.eq('user_id', selectedUser);
      }

      const { data: locations, error } = await query;

      if (error) throw error;
      console.log('Fetched locations:', locations);

      // Get all regions for the selected country
      const allRegions = countryRegions[selectedCountry as keyof typeof countryRegions] || [];
      
      // Initialize all regions with 0 activities
      const stateCounts: Record<string, number> = {};
      allRegions.forEach(region => {
        stateCounts[region] = 0;
      });
      
      locations?.forEach(location => {
        const detectedCountry = location.country || detectCountryFromCoordinates(location.latitude, location.longitude);
        console.log(`Location: ${location.latitude}, ${location.longitude} -> Country: ${detectedCountry}`);
        
        if (detectedCountry === selectedCountry) {
          const state = location.state || detectStateFromCoordinates(location.latitude, location.longitude, detectedCountry);
          console.log(`Matched location in ${selectedCountry}, state: ${state}`);
          
          // Only count if the state is in our known regions
          if (allRegions.includes(state)) {
            stateCounts[state] = (stateCounts[state] || 0) + 1;
          } else if (selectedCountry === 'Mexico') {
            // For Mexico, show the actual state name instead of country
            stateCounts[state] = (stateCounts[state] || 0) + 1;
          }
        }
      });

      console.log('State counts for', selectedCountry, ':', stateCounts);
      
      // Convert to chart data format and include all regions
      const chartData = Object.entries(stateCounts)
        .map(([state, activities]) => ({
          state,
          activities
        }))
        .sort((a, b) => b.activities - a.activities); // Sort by activity count descending

      console.log('Chart data:', chartData);
      setActivityData(chartData);
    } catch (error) {
      console.error('Error fetching activity data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfiles();
  }, [selectedCountry]);

  useEffect(() => {
    fetchActivityData();
  }, [selectedCountry, selectedUser, dateFrom, dateTo]);

  // Custom tooltip for the chart
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-popover text-popover-foreground p-3 rounded-lg border shadow-lg">
          <p className="font-semibold">{label}</p>
          <p className="text-sm">
            <span className="text-primary">Actividades: </span>
            <span className="font-medium">{payload[0].value}</span>
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5" />
          Gráfico de Actividades por Estado
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4 mb-6">
          {/* Filters */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Country Filter */}
            <div className="space-y-2">
              <Label htmlFor="country-select">País</Label>
              <Select value={selectedCountry} onValueChange={setSelectedCountry}>
                <SelectTrigger id="country-select">
                  <SelectValue placeholder="Seleccionar país" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Mexico">Mexico</SelectItem>
                  <SelectItem value="Guatemala">Guatemala</SelectItem>
                  <SelectItem value="El Salvador">El Salvador</SelectItem>
                  <SelectItem value="Honduras">Honduras</SelectItem>
                  <SelectItem value="Nicaragua">Nicaragua</SelectItem>
                  <SelectItem value="Costa Rica">Costa Rica</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* User Filter */}
            <div className="space-y-2">
              <Label htmlFor="user-select">Usuario</Label>
              <Select value={selectedUser} onValueChange={setSelectedUser}>
                <SelectTrigger id="user-select">
                  <SelectValue placeholder="Todos los usuarios" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los usuarios</SelectItem>
                  {profiles.map((profile) => (
                    <SelectItem key={profile.user_id} value={profile.user_id}>
                      {profile.first_name} {profile.last_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Date From Filter */}
            <div className="space-y-2">
              <Label>Fecha Desde</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !dateFrom && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dateFrom ? format(dateFrom, "dd/MM/yyyy") : "Seleccionar fecha"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={dateFrom}
                    onSelect={setDateFrom}
                    initialFocus
                    className="p-3 pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>

            {/* Date To Filter */}
            <div className="space-y-2">
              <Label>Fecha Hasta</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !dateTo && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dateTo ? format(dateTo, "dd/MM/yyyy") : "Seleccionar fecha"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={dateTo}
                    onSelect={setDateTo}
                    initialFocus
                    className="p-3 pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>
        </div>

        {/* Chart */}
        <div className="h-[400px] w-full">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-muted-foreground">Cargando datos...</div>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={activityData} margin={{ top: 20, right: 30, left: 20, bottom: 80 }}>
                <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                <XAxis 
                  dataKey="state" 
                  angle={-45}
                  textAnchor="end"
                  height={100}
                  interval={0}
                  fontSize={12}
                />
                <YAxis />
                <Tooltip content={<CustomTooltip />} />
                <Legend />
                <Bar 
                  dataKey="activities" 
                  fill="hsl(var(--primary))" 
                  name="Actividades"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Summary */}
        <div className="mt-4 p-4 bg-muted rounded-lg">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
            <div>
              <div className="text-2xl font-bold text-primary">
                {activityData.reduce((sum, item) => sum + item.activities, 0)}
              </div>
              <div className="text-sm text-muted-foreground">Total Actividades</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-primary">
                {activityData.filter(item => item.activities > 0).length}
              </div>
              <div className="text-sm text-muted-foreground">Estados con Actividad</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-primary">
                {activityData.length > 0 ? Math.max(...activityData.map(item => item.activities)) : 0}
              </div>
              <div className="text-sm text-muted-foreground">Máximo por Estado</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-primary">
                {activityData.length > 0 ? 
                  activityData.find(item => item.activities === Math.max(...activityData.map(i => i.activities)))?.state || 'N/A'
                  : 'N/A'
                }
              </div>
              <div className="text-sm text-muted-foreground">Estado Más Activo</div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default ActivityChart;
