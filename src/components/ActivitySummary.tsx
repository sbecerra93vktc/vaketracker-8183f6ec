import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Loader2 } from 'lucide-react';

interface ActivitySummary {
  user_email: string;
  first_name: string;
  last_name: string;
  total_activities: number;
  visita_en_frio: number;
  negociacion_en_curso: number;
  visita_pre_entrega: number;
  visita_tecnica: number;
  visita_cortesia: number;
}

const ActivitySummary = () => {
  const [summaries, setSummaries] = useState<ActivitySummary[]>([]);
  const [loading, setLoading] = useState(true);
  const { userRole } = useAuth();

  const fetchActivitySummaries = async () => {
    try {
      setLoading(true);
      
      // Get all users with their profiles
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('user_id, email, first_name, last_name');

      if (profilesError) throw profilesError;

      // Get location data with activity counts
      const { data: locations, error: locationsError } = await supabase
        .from('locations')
        .select('user_id, visit_type');

      if (locationsError) throw locationsError;

      // Process the data to create summaries
      const summaryData: Record<string, ActivitySummary> = {};

      profiles?.forEach(profile => {
        summaryData[profile.user_id] = {
          user_email: profile.email,
          first_name: profile.first_name || '',
          last_name: profile.last_name || '',
          total_activities: 0,
          visita_en_frio: 0,
          negociacion_en_curso: 0,
          visita_pre_entrega: 0,
          visita_tecnica: 0,
          visita_cortesia: 0,
        };
      });

      // Count activities by type
      locations?.forEach(location => {
        if (summaryData[location.user_id]) {
          summaryData[location.user_id].total_activities++;
          
          const visitType = location.visit_type?.toLowerCase() || '';
          
          if (visitType.includes('visita en frío')) {
            summaryData[location.user_id].visita_en_frio++;
          } else if (visitType.includes('negociación en curso')) {
            summaryData[location.user_id].negociacion_en_curso++;
          } else if (visitType.includes('visita pre-entrega')) {
            summaryData[location.user_id].visita_pre_entrega++;
          } else if (visitType.includes('visita técnica')) {
            summaryData[location.user_id].visita_tecnica++;
          } else if (visitType.includes('visita de cortesía')) {
            summaryData[location.user_id].visita_cortesia++;
          }
        }
      });

      setSummaries(Object.values(summaryData));
    } catch (error) {
      console.error('Error fetching activity summaries:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchActivitySummaries();
  }, []);

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center p-6">
          <Loader2 className="h-6 w-6 animate-spin text-warning" />
          <span className="ml-2">Cargando resumen de actividades...</span>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-warning">Resumen de Actividades por Usuario</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Usuario</TableHead>
              <TableHead className="text-center">Total</TableHead>
              <TableHead className="text-center">Visita en Frío</TableHead>
              <TableHead className="text-center">Negociación</TableHead>
              <TableHead className="text-center">Pre-entrega</TableHead>
              <TableHead className="text-center">Técnica</TableHead>
              <TableHead className="text-center">Cortesía</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {summaries.map((summary, index) => (
              <TableRow key={index}>
                <TableCell className="font-medium">
                  {summary.first_name && summary.last_name 
                    ? `${summary.first_name} ${summary.last_name}`
                    : summary.user_email
                  }
                </TableCell>
                <TableCell className="text-center font-bold text-warning">
                  {summary.total_activities}
                </TableCell>
                <TableCell className="text-center">{summary.visita_en_frio}</TableCell>
                <TableCell className="text-center">{summary.negociacion_en_curso}</TableCell>
                <TableCell className="text-center">{summary.visita_pre_entrega}</TableCell>
                <TableCell className="text-center">{summary.visita_tecnica}</TableCell>
                <TableCell className="text-center">{summary.visita_cortesia}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
};

export default ActivitySummary;