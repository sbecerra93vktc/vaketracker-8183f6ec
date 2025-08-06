import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { MapPin, Clock, User } from 'lucide-react';

interface Location {
  id: string;
  latitude: number;
  longitude: number;
  address: string;
  notes: string;
  visit_type: string;
  created_at: string;
  user_name?: string;
  user_email?: string;
}

const LocationHistory = () => {
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const { userRole } = useAuth();

  useEffect(() => {
    fetchLocations();
  }, [userRole]);

  const fetchLocations = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      let query = supabase
        .from('locations')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20);

      // If not admin, only show own locations
      if (userRole !== 'admin') {
        query = query.eq('user_id', user.id);
      }

      const { data: locationsData, error: locationsError } = await query;

      if (locationsError) {
        console.error('Error fetching locations:', locationsError);
        return;
      }

      // If admin, fetch user profiles separately for names
      if (userRole === 'admin' && locationsData && locationsData.length > 0) {
        const userIds = [...new Set(locationsData.map(loc => loc.user_id))];
        const { data: profilesData } = await supabase
          .from('profiles')
          .select('user_id, first_name, last_name, email')
          .in('user_id', userIds);

        const profilesMap = new Map(
          profilesData?.map(p => [p.user_id, p]) || []
        );

        const enrichedLocations = locationsData.map(location => ({
          ...location,
          user_name: profilesMap.get(location.user_id) 
            ? `${profilesMap.get(location.user_id)?.first_name} ${profilesMap.get(location.user_id)?.last_name}`
            : 'Unknown User',
          user_email: profilesMap.get(location.user_id)?.email || '',
        }));

        setLocations(enrichedLocations);
      } else {
        setLocations(locationsData || []);
      }
    } catch (error) {
      console.error('Error fetching locations:', error);
    } finally {
      setLoading(false);
    }
  };

  const getVisitTypeColor = (visitType: string) => {
    const colors = {
      check_in: 'bg-green-100 text-green-800',
      check_out: 'bg-red-100 text-red-800',
      customer_visit: 'bg-blue-100 text-blue-800',
      delivery: 'bg-purple-100 text-purple-800',
      meeting: 'bg-yellow-100 text-yellow-800',
      break: 'bg-gray-100 text-gray-800',
    };
    return colors[visitType as keyof typeof colors] || 'bg-gray-100 text-gray-800';
  };

  const formatVisitType = (visitType: string) => {
    return visitType.split('_').map(word => 
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ');
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center">Loading locations...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MapPin className="h-5 w-5" />
          {userRole === 'admin' ? 'All Team Locations' : 'Your Location History'}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {locations.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No locations recorded yet
          </div>
        ) : (
          <div className="space-y-4">
            {locations.map((location) => (
              <div
                key={location.id}
                className="border rounded-lg p-4 space-y-3"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <Badge className={getVisitTypeColor(location.visit_type)}>
                      {formatVisitType(location.visit_type)}
                    </Badge>
                    {userRole === 'admin' && location.user_name && (
                      <div className="flex items-center gap-1 text-sm text-muted-foreground">
                        <User className="h-4 w-4" />
                        {location.user_name}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    {new Date(location.created_at).toLocaleString()}
                  </div>
                </div>

                <div className="space-y-1">
                  <p className="text-sm font-medium">{location.address}</p>
                  <p className="text-xs text-muted-foreground">
                    {location.latitude.toFixed(6)}, {location.longitude.toFixed(6)}
                  </p>
                </div>

                {location.notes && (
                  <p className="text-sm text-muted-foreground bg-muted p-2 rounded">
                    {location.notes}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default LocationHistory;