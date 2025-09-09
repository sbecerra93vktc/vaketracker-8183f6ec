import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { MapPin, Clock, User, Filter, Globe, List, Grid3X3, Loader2, Phone, Search, MessageCircle, Navigation, Users, UserCheck, Download, Trash, Edit } from 'lucide-react';
import ActivityMediaDisplay from './ActivityMediaDisplay';
import { useActivityStore } from '@/stores/activityStore';
 
import { useToast } from '@/hooks/use-toast';

interface Location {
  id: string;
  latitude: number;
  longitude: number;
  address: string;
  notes: string;
  visit_type: string;
  created_at: string;
  country?: string;
  state?: string;
  user_name?: string;
  user_email?: string;
  user_id: string;
  // Optional business/contact fields if present
  phone?: string;
  business_name?: string;
  contact_person?: string;
  contact_email?: string;
  // Enriched from profile when available
  user_phone?: string;
}

const LocationHistory = () => {
  
  const [locations, setLocations] = useState<Location[]>([]);
  const [filteredLocations, setFilteredLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadingFilters, setLoadingFilters] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [currentPage, setCurrentPage] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [filteredTotalCount, setFilteredTotalCount] = useState(0);
  const [selectedUser, setSelectedUser] = useState<string>('all');
  const [selectedDateFrom, setSelectedDateFrom] = useState<string>('');
  const [selectedDateTo, setSelectedDateTo] = useState<string>('');
  const [selectedCountry, setSelectedCountry] = useState<string>('all');
  const [selectedState, setSelectedState] = useState<string>('all');
  const [selectedVisitType, setSelectedVisitType] = useState<string>('all');
  const [showFilters, setShowFilters] = useState(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
  const [activityView, setActivityView] = useState<'all' | 'my'>('all');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [activityToDelete, setActivityToDelete] = useState<Location | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [activityToEdit, setActivityToEdit] = useState<Location | null>(null);
  const [editForm, setEditForm] = useState({
    address: '',
    notes: '',
    visit_type: '',
    business_name: '',
    contact_person: '',
    contact_email: '',
    phone: ''
  });
  const { userRole, user } = useAuth();
  const { selectedActivity, setSelectedActivity, clearSelectedActivity, moveMapToLocation } = useActivityStore();
  const { toast } = useToast();

  const ITEMS_PER_PAGE = 10;

  const canDeleteActivity = (activity: Location) => {
    if (!user) return false;
    return userRole === 'admin' || activity.user_id === user.id;
  };

  const canEditActivity = (activity: Location) => {
    if (!user) return false;
    return userRole === 'admin' || activity.user_id === user.id;
  };

  const openDeleteDialog = (activity: Location) => {
    if (!canDeleteActivity(activity)) {
      toast({
        variant: 'destructive',
        title: 'No autorizado',
        description: 'No tienes permiso para eliminar esta actividad.',
      });
      return;
    }
    setActivityToDelete(activity);
    setDeleteDialogOpen(true);
  };

  const confirmDeleteActivity = async () => {
    if (!activityToDelete) return;

    try {
      const { error } = await supabase
        .from('locations')
        .delete()
        .eq('id', activityToDelete.id);

      if (error) {
        console.error('Error deleting activity:', error);
        toast({
          variant: 'destructive',
          title: 'Error al eliminar',
          description: 'No se pudo eliminar la actividad.',
        });
        return;
      }

      // Update local state
      setLocations(prev => prev.filter(l => l.id !== activityToDelete.id));
      setFilteredLocations(prev => prev.filter(l => l.id !== activityToDelete.id));
      setTotalCount(prev => Math.max(0, prev - 1));
      if (selectedActivity?.id === activityToDelete.id) {
        clearSelectedActivity();
      }

      toast({
        title: 'Actividad eliminada',
        description: 'La actividad fue eliminada correctamente.',
      });
    } catch (err) {
      console.error('Unexpected error deleting activity:', err);
      toast({
        variant: 'destructive',
        title: 'Error inesperado',
        description: 'Ocurrió un error al eliminar la actividad.',
      });
    } finally {
      setDeleteDialogOpen(false);
      setActivityToDelete(null);
    }
  };

  const openEditDialog = (activity: Location) => {
    if (!canEditActivity(activity)) {
      toast({
        variant: 'destructive',
        title: 'No autorizado',
        description: 'No tienes permiso para editar esta actividad.',
      });
      return;
    }
    setActivityToEdit(activity);
    setEditForm({
      address: activity.address || '',
      notes: activity.notes || '',
      visit_type: activity.visit_type || '',
      business_name: activity.business_name || '',
      contact_person: activity.contact_person || '',
      contact_email: activity.contact_email || '', // This will be mapped to 'email' in the database
      phone: activity.phone || ''
    });
    setEditDialogOpen(true);
  };

  const handleEditFormChange = (field: string, value: string) => {
    setEditForm(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const confirmEditActivity = async () => {
    if (!activityToEdit) return;

    try {
      // Validate required fields
      if (!editForm.address.trim() || !editForm.visit_type.trim()) {
        toast({
          variant: 'destructive',
          title: 'Campos requeridos',
          description: 'La dirección y tipo de visita son obligatorios.',
        });
        return;
      }

      console.log('Updating activity:', activityToEdit.id, 'with data:', editForm);
      console.log('Current user:', user?.id, 'Activity user:', activityToEdit.user_id);

      const updateData = {
        address: editForm.address.trim(),
        notes: editForm.notes.trim(),
        visit_type: editForm.visit_type.trim(),
        business_name: editForm.business_name.trim() || null,
        contact_person: editForm.contact_person.trim() || null,
        email: editForm.contact_email.trim() || null, // Note: database column is 'email', not 'contact_email'
        phone: editForm.phone.trim() || null
      };

      console.log('Update data being sent:', updateData);

      const { data, error } = await supabase
        .from('locations')
        .update(updateData)
        .eq('id', activityToEdit.id)
        .select();

      if (error) {
        console.error('Supabase error updating activity:', error);
        toast({
          variant: 'destructive',
          title: 'Error al actualizar',
          description: `Error: ${error.message || 'No se pudo actualizar la actividad.'}`,
        });
        return;
      }

      console.log('Successfully updated activity:', data);

      // Update local state
      const updatedActivity = {
        ...activityToEdit,
        ...editForm
      };

      setLocations(prev => prev.map(l => l.id === activityToEdit.id ? updatedActivity : l));
      setFilteredLocations(prev => prev.map(l => l.id === activityToEdit.id ? updatedActivity : l));
      
      if (selectedActivity?.id === activityToEdit.id) {
        setSelectedActivity({
          ...selectedActivity,
          ...editForm
        });
      }

      toast({
        title: 'Actividad actualizada',
        description: 'La actividad fue actualizada correctamente.',
      });
    } catch (err) {
      console.error('Unexpected error updating activity:', err);
      toast({
        variant: 'destructive',
        title: 'Error inesperado',
        description: 'Ocurrió un error al actualizar la actividad.',
      });
    } finally {
      setEditDialogOpen(false);
      setActivityToEdit(null);
    }
  };

  useEffect(() => {
    fetchLocations(true); // Reset and fetch first page
  }, [userRole, activityView]);

  useEffect(() => {
    applyFilters();
  }, [locations, selectedUser, selectedDateFrom, selectedDateTo, selectedCountry, selectedState, selectedVisitType]);

  // Reset state filter when country changes
  useEffect(() => {
    if (selectedCountry !== 'all') {
      setSelectedState('all');
    }
  }, [selectedCountry]);

  const fetchLocations = async (reset = false) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      if (reset) {
        setCurrentPage(0);
        setLocations([]);
        setLoading(true);
      } else {
        setLoadingMore(true);
      }

      // Build the base query
      let query = supabase
        .from('locations')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false });

      // Apply filters to the query
      if (userRole !== 'admin') {
        // Non-admin users always see only their own activities
        query = query.eq('user_id', user.id);
      } else {
        // Admin users can filter by activity view
        if (activityView === 'my') {
          // Show only admin's own activities
          query = query.eq('user_id', user.id);
        } else if (activityView === 'all') {
          // Show all team activities (can filter by specific user if selected)
          if (selectedUser !== 'all') {
            query = query.eq('user_id', selectedUser);
          }
          // If no specific user selected, show all team activities
        }
      }

      // Filter by date range
      if (selectedDateFrom) {
        const fromDate = new Date(selectedDateFrom);
        query = query.gte('created_at', fromDate.toISOString());
      }

      if (selectedDateTo) {
        const toDate = new Date(selectedDateTo);
        toDate.setHours(23, 59, 59, 999); // Include the entire day
        query = query.lte('created_at', toDate.toISOString());
      }

      // Filter by visit type
      if (selectedVisitType !== 'all') {
        query = query.eq('visit_type', selectedVisitType);
      }

      // Apply search query if present
      if (searchQuery.trim()) {
        query = query.or(`address.ilike.%${searchQuery}%,notes.ilike.%${searchQuery}%,visit_type.ilike.%${searchQuery}%`);
      }

      // Apply pagination
      const from = reset ? 0 : locations.length;
      const to = from + ITEMS_PER_PAGE - 1;
      query = query.range(from, to);

      const { data: locationsData, error: locationsError, count } = await query;

      if (locationsError) {
        console.error('Error fetching locations:', locationsError);
        return;
      }


      setTotalCount(count || 0);

      // If admin, fetch user profiles separately for names
      let enrichedLocations = locationsData || [];
      if (userRole === 'admin' && locationsData && locationsData.length > 0) {
        const userIds = [...new Set(locationsData.map(loc => loc.user_id))];
        const { data: profilesData } = await supabase
          .from('profiles')
          .select('user_id, first_name, last_name, email, phone')
          .in('user_id', userIds);

        const profilesMap = new Map(
          profilesData?.map(p => [p.user_id, p]) || []
        );

        enrichedLocations = locationsData.map(location => ({
          ...location,
          user_name: profilesMap.get(location.user_id) 
            ? `${profilesMap.get(location.user_id)?.first_name} ${profilesMap.get(location.user_id)?.last_name}`
            : 'Unknown User',
          user_email: profilesMap.get(location.user_id)?.email || '',
          user_phone: profilesMap.get(location.user_id)?.phone || undefined,
        }));
      } else if (userRole !== 'admin' && locationsData && locationsData.length > 0) {
        // For non-admin (own activities), enrich with the current user's profile phone
        const { data: profileData } = await supabase
          .from('profiles')
          .select('user_id, phone')
          .eq('user_id', user.id)
          .single();

        enrichedLocations = locationsData.map(location => ({
          ...location,
          user_phone: profileData?.phone || undefined,
        }));
      }

      if (reset) {
        setLocations(enrichedLocations);
        setCurrentPage(1);
        // Set filtered count to the count returned from database (which already has filters applied)
        setFilteredTotalCount(count || 0);
      } else {
        setLocations(prev => [...prev, ...enrichedLocations]);
        setCurrentPage(prev => prev + 1);
      }

      // Check if there are more items
      const totalFetched = reset ? enrichedLocations.length : locations.length + enrichedLocations.length;
      setHasMore((count || 0) > totalFetched);

    } catch (error) {
      console.error('Error fetching locations:', error);
    } finally {
      setLoading(false);
      setLoadingMore(false);
      setLoadingFilters(false);
    }
  };

  const loadMore = () => {
    if (!loadingMore && hasMore) {
      fetchLocations(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...locations];

    // User filter (client-side fallback - should be applied at database level but this ensures it works)
    if (selectedUser !== 'all') {
      filtered = filtered.filter(location => location.user_id === selectedUser);
    }

    // Country filter (client-side for existing data)
    if (selectedCountry !== 'all') {
      filtered = filtered.filter(location => {
        const locationCountry = location.country || detectCountryFromCoordinates(location.latitude, location.longitude);
        return locationCountry === selectedCountry;
      });
    }

    // State filter (client-side for existing data)
    if (selectedState !== 'all') {
      filtered = filtered.filter(location => {
        const locationState = location.state || detectStateFromCoordinates(
          location.latitude, 
          location.longitude, 
          location.country || detectCountryFromCoordinates(location.latitude, location.longitude)
        );
        return locationState === selectedState;
      });
    }

    // Visit type filter
    if (selectedVisitType !== 'all') {
      filtered = filtered.filter(location => location.visit_type === selectedVisitType);
    }

    setFilteredLocations(filtered);
    
    // Update filtered total count to reflect filtered results
    setFilteredTotalCount(filtered.length);
  };

  const handleFilterChange = () => {
    // Reset and fetch with new filters
    setLoadingFilters(true);
    fetchLocations(true);
    // Clear selected activity when filters change
    clearSelectedActivity();
  };

  const handleVisitTypeChange = (value: string) => {
    setSelectedVisitType(value);
    setTimeout(handleFilterChange, 100);
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const query = e.target.value;
    setSearchQuery(query);
  };

  const handleSearch = () => {
    // Clear selected activity when search changes
    clearSelectedActivity();
    setLoadingFilters(true);
    fetchLocations(true);
  };

  const handleResetSearch = () => {
    setSearchQuery('');
    clearSelectedActivity();
    setLoadingFilters(true);
    fetchLocations(true);
  };

  // Handle activity selection
  const handleActivitySelect = (activity: Location) => {
    // If clicking the same activity, clear the selection
    if (selectedActivity?.id === activity.id) {
      clearSelectedActivity();
      return;
    }
    
    // Map Location to Activity interface with all fields
    const mappedActivity = {
      ...activity,
      // Map user_name to name for consistency
      name: activity.user_name,
      email: activity.user_email,
      // Map region from country/state
      region: activity.state || activity.country || detectCountryFromCoordinates(activity.latitude, activity.longitude),
      // Prefer activity phone, fall back to user profile phone if present
      phone: activity.phone || activity.user_phone,
    };
    setSelectedActivity(mappedActivity);
    
    // Move map camera to the selected activity location
    moveMapToLocation(activity.latitude, activity.longitude);
  };



  const getUniqueUsers = () => {
    const users = locations.map(loc => ({
      id: loc.user_id,
      name: loc.user_name || 'Unknown User'
    }));
    return Array.from(new Map(users.map(user => [user.id, user])).values());
  };

  const getUniqueCountries = () => {
    const countries = locations.map(loc => {
      // For existing records without country data, detect from coordinates
      return loc.country || detectCountryFromCoordinates(loc.latitude, loc.longitude);
    }).filter(Boolean);
    return [...new Set(countries)];
  };

  const getUniqueStates = () => {
    let filteredLocations = locations;
    
    // If a country is selected, only show states from that country
    if (selectedCountry !== 'all') {
      filteredLocations = locations.filter(loc => {
        // For existing records without country data, detect from coordinates
        if (!loc.country) {
          const detectedCountry = detectCountryFromCoordinates(loc.latitude, loc.longitude);
          return detectedCountry === selectedCountry;
        }
        return loc.country === selectedCountry;
      });
    }
    
    const states = filteredLocations.map(loc => {
      // For existing records without state data, detect from coordinates  
      if (!loc.state) {
        return detectStateFromCoordinates(loc.latitude, loc.longitude, loc.country || detectCountryFromCoordinates(loc.latitude, loc.longitude));
      }
      return loc.state;
    }).filter(Boolean);
    
    return [...new Set(states)];
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

  const getVisitTypeColor = (visitType: string) => {
    if (visitType.includes('Visita en frío')) return 'bg-blue-600 text-white';
    if (visitType.includes('Visita programada')) return 'bg-yellow-600 text-white';
    if (visitType.includes('Visita de cortesía')) return 'bg-green-600 text-white';
    if (visitType.includes('Negociación en curso')) return 'bg-purple-600 text-white';
    if (visitType.includes('Visita pre-entrega')) return 'bg-orange-600 text-white';
    if (visitType.includes('Visita técnica')) return 'bg-red-600 text-white';
    return 'bg-gray-600 text-white';
  };

  // Ensure we pass a safe tel: URL. Keeps leading + and digits only
  const getDialHref = (rawPhone?: string) => {
    if (!rawPhone) return '';
    const sanitized = String(rawPhone).replace(/[^\d+]/g, '');
    return `tel:${sanitized}`;
  };

  // Get WhatsApp URL with phone number
  const getWhatsAppHref = (rawPhone?: string) => {
    if (!rawPhone) return '';
    const sanitized = String(rawPhone).replace(/[^\d+]/g, '');
    return `https://wa.me/${sanitized}`;
  };

  // Get Google Maps URL for address
  const getGoogleMapsHref = (address: string, latitude?: number, longitude?: number) => {
    if (!address) return '';
    
    // Use a format that forces web version and avoids mobile intents
    if (latitude && longitude) {
      // Use the web-specific format that avoids intents
      return `https://www.google.com/maps/@${latitude},${longitude},15z/data=!3m1!1e3`;
    }
    
    // For addresses, use web search format
    const encodedAddress = encodeURIComponent(address);
    return `https://www.google.com/maps/search/${encodedAddress}/@0,0,2z`;
  };

  const formatVisitType = (visitType: string) => {
    return visitType || 'Actividad';
  };

  // Excel Export functionality
  const exportToExcel = () => {
    try {
      // Prepare data for export
      const exportData = filteredLocations.map(location => ({
        'ID de Actividad': location.id,
        'Tipo de Visita': location.visit_type || 'No especificado',
        'Dirección': location.address,
        'Latitud': location.latitude.toFixed(6),
        'Longitud': location.longitude.toFixed(6),
        'País': location.country || detectCountryFromCoordinates(location.latitude, location.longitude) || 'No detectado',
        'Región/Estado': location.state || detectStateFromCoordinates(
          location.latitude, 
          location.longitude,
          location.country || detectCountryFromCoordinates(location.latitude, location.longitude)
        ) || 'No detectado',
        'Notas': location.notes || 'Sin notas',
        'Nombre del Negocio': location.business_name || 'No especificado',
        'Contacto': location.contact_person || 'No especificado',
        'Email del Contacto': location.contact_email || 'No especificado',
        'Teléfono del Contacto': location.phone || 'No especificado',
        'Usuario': location.user_name || 'Usuario desconocido',
        'Email del Usuario': location.user_email || 'No disponible',
        'Fecha de Creación': new Date(location.created_at).toLocaleString('es-ES'),
        'ID del Usuario': location.user_id,
      }));

      // Create CSV content
      const headers = Object.keys(exportData[0]);
      const csvContent = [
        headers.join(','),
        ...exportData.map(row => 
          headers.map(header => {
            const value = row[header];
            // Escape commas and quotes in CSV
            if (typeof value === 'string' && (value.includes(',') || value.includes('"') || value.includes('\n'))) {
              return `"${value.replace(/"/g, '""')}"`;
            }
            return value;
          }).join(',')
        )
      ].join('\n');

      // Create and download file
      const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      
      // Generate filename with current date
      const now = new Date();
      const dateStr = now.toISOString().split('T')[0];
      const timeStr = now.toTimeString().split(' ')[0].replace(/:/g, '-');
      const filename = `actividades_${dateStr}_${timeStr}.csv`;
      
      link.setAttribute('href', url);
      link.setAttribute('download', filename);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      // Show success message
      toast({
        title: 'Exportación exitosa',
        description: `Se exportaron ${exportData.length} actividades a ${filename}`,
      });
      
    } catch (error) {
      console.error('Error exporting to Excel:', error);
      toast({
        variant: 'destructive',
        title: 'Error en la exportación',
        description: 'No se pudo exportar los datos. Intenta de nuevo.',
      });
    }
  };

  if (loading && currentPage === 0) { // Only show full loading if it's the initial fetch
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center">Loading locations...</div>
        </CardContent>
      </Card>
    );
  }

  // Display range for the current page
  const startIndex = filteredLocations.length > 0 ? (currentPage - 1) * ITEMS_PER_PAGE + 1 : 0;
  const endIndex = (currentPage - 1) * ITEMS_PER_PAGE + filteredLocations.length;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="flex items-center gap-2">
              <MapPin className="h-5 w-5 text-warning" />
              {userRole === 'admin' 
                ? (activityView === 'my' ? 'Mis Actividades' : 'Actividades del Equipo')
                : 'Historial de Ubicaciones'
              }
            </div>
            
            {/* Activity View Tabs - Only show for admin users */}
            {userRole === 'admin' && (
              <div className="flex border rounded-lg p-1 bg-muted/50">
                <button
                  onClick={() => {
                    setActivityView('all');
                    setSelectedUser('all');
                    clearSelectedActivity();
                    setTimeout(handleFilterChange, 100);
                  }}
                  className={`flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                    activityView === 'all'
                      ? 'bg-background text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <Users className="h-3 w-3" />
                  <span className="hidden sm:inline">Todo el Equipo</span>
                  <span className="sm:hidden">Equipo</span>
                </button>
                <button
                  onClick={() => {
                    setActivityView('my');
                    setSelectedUser('all');
                    clearSelectedActivity();
                    setTimeout(handleFilterChange, 100);
                  }}
                  className={`flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                    activityView === 'my'
                      ? 'bg-background text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <UserCheck className="h-3 w-3" />
                  <span className="hidden sm:inline">Mis Actividades</span>
                  <span className="sm:hidden">Mías</span>
                </button>
              </div>
            )}
          </div>
          
          {/* Mobile-first responsive controls */}
          <div className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto">
            {/* Search section */}
            <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
              <div className="relative flex-1 sm:flex-none">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Buscar actividades..."
                  value={searchQuery}
                  onChange={handleSearchChange}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      handleSearch();
                    }
                  }}
                  className="pl-10 w-full sm:w-64"
                />
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={handleSearch}
                  className="bg-warning text-white border-warning hover:bg-warning/90 flex-1 sm:flex-none"
                  size="sm"
                >
                  <Search className="h-4 w-4 sm:mr-2" />
                  <span className="hidden sm:inline">Buscar</span>
                </Button>
                {searchQuery && (
                  <Button
                    onClick={handleResetSearch}
                    variant="outline"
                    size="sm"
                    className="text-red-600 border-red-300 hover:bg-red-50 flex-1 sm:flex-none"
                  >
                    <span className="hidden sm:inline">Limpiar</span>
                    <span className="sm:hidden">×</span>
                  </Button>
                )}
              </div>
            </div>
            
            {/* View mode, filters, and export */}
            <div className="flex gap-2">
              <div className="flex border rounded-lg p-1">
                <Button
                  variant={viewMode === 'list' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setViewMode('list')}
                  className="h-8 px-2"
                >
                  <List className="h-4 w-4" />
                </Button>
                <Button
                  variant={viewMode === 'grid' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setViewMode('grid')}
                  className="h-8 px-2"
                >
                  <Grid3X3 className="h-4 w-4" />
                </Button>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowFilters(!showFilters)}
                className="text-warning border-warning/20 hover:bg-warning/10"
              >
                <Filter className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">Filtros</span>
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={exportToExcel}
                disabled={filteredLocations.length === 0}
                className="text-green-600 border-green-300 hover:bg-green-50"
                title="Exportar actividades a Excel"
              >
                <Download className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">Exportar</span>
                <span className="sm:hidden">Excel</span>
              </Button>
            </div>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {showFilters && (
          <div className="mb-6 p-4 border rounded-lg bg-warning/5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-warning" />
                <h3 className="text-sm font-medium">
                  Filtros aplicados
                  {searchQuery && (
                    <span className="ml-2 text-warning">• Búsqueda: "{searchQuery}"</span>
                  )}
                </h3>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSelectedUser('all');
                    setSelectedDateFrom('');
                    setSelectedDateTo('');
                    setSelectedCountry('all');
                    setSelectedState('all');
                    setSelectedVisitType('all');
                    setSearchQuery('');
                    setFilteredTotalCount(0); // Reset filtered count when clearing filters
                    if (userRole === 'admin') {
                      setActivityView('all');
                    }
                    clearSelectedActivity();
                    setTimeout(handleFilterChange, 100);
                  }}
                  className="text-xs w-full sm:w-auto"
                >
                  Limpiar filtros
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={exportToExcel}
                  disabled={filteredLocations.length === 0}
                  className="text-xs text-green-600 border-green-300 hover:bg-green-50 w-full sm:w-auto"
                >
                  <Download className="h-3 w-3 mr-1" />
                  Exportar Excel
                </Button>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              <div className="space-y-1">
                <Label htmlFor="country-filter" className="text-xs font-medium">País</Label>
                <Select value={selectedCountry} onValueChange={(value) => {
                  setSelectedCountry(value);
                  setTimeout(handleFilterChange, 100);
                }}>
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue placeholder="Todos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="México">México</SelectItem>
                    <SelectItem value="Guatemala">Guatemala</SelectItem>
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

              {selectedCountry !== 'all' && (
                <div className="space-y-1">
                  <Label htmlFor="state-filter" className="text-xs font-medium">Región</Label>
                  <Select value={selectedState} onValueChange={(value) => {
                    setSelectedState(value);
                    setTimeout(handleFilterChange, 100);
                  }}>
                    <SelectTrigger className="h-9 text-sm">
                      <SelectValue placeholder="Todas" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas</SelectItem>
                      {getUniqueStates().map(state => (
                        <SelectItem key={state} value={state}>
                          {state}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {userRole === 'admin' && activityView === 'all' && (
                <div className="space-y-1">
                  <Label htmlFor="user-filter" className="text-xs font-medium">Usuario</Label>
                  <Select value={selectedUser} onValueChange={(value) => {
                    setSelectedUser(value);
                    setTimeout(handleFilterChange, 100);
                  }}>
                    <SelectTrigger className="h-9 text-sm">
                      <SelectValue placeholder="Todos" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      {getUniqueUsers().map(user => (
                        <SelectItem key={user.id} value={user.id}>
                          {user.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="space-y-1">
                <Label htmlFor="visit-type-filter" className="text-xs font-medium">Tipo</Label>
                <Select value={selectedVisitType} onValueChange={handleVisitTypeChange}>
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue placeholder="Todos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="Visita en frío">Visita en frío</SelectItem>
                    <SelectItem value="Negociación">Negociación</SelectItem>
                    <SelectItem value="Pre-entrega">Pre-entrega</SelectItem>
                    <SelectItem value="Técnica">Técnica</SelectItem>
                    <SelectItem value="Visita de cortesía">Visita de cortesía</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label htmlFor="date-from-filter" className="text-xs font-medium">Desde</Label>
                <Input
                  type="date"
                  value={selectedDateFrom}
                  onChange={(e) => {
                    setSelectedDateFrom(e.target.value);
                    setTimeout(handleFilterChange, 100);
                  }}
                  className="h-9 text-sm"
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="date-to-filter" className="text-xs font-medium">Hasta</Label>
                <Input
                  type="date"
                  value={selectedDateTo}
                  onChange={(e) => {
                    setSelectedDateTo(e.target.value);
                    setTimeout(handleFilterChange, 100);
                  }}
                  className="h-9 text-sm"
                />
              </div>
            </div>
          </div>
        )}

        {loadingFilters ? (
          <div className="text-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-warning mx-auto mb-2" />
            <p className="text-muted-foreground">Aplicando filtros...</p>
          </div>
        ) : filteredLocations.length === 0 && currentPage === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            {locations.length === 0 ? 'No hay actividades registradas aún' : 'No se encontraron actividades con los filtros seleccionados'}
          </div>
        ) : (
          <div>
            <div className="text-sm text-muted-foreground mb-4">
              {filteredLocations.length > 0 ? (
                <>
                  Mostrando {filteredLocations.length} {filteredLocations.length === 1 ? 'actividad' : 'actividades'}
                  {filteredTotalCount !== totalCount && (
                    <span className="ml-1">(de {filteredTotalCount} {filteredTotalCount === 1 ? 'actividad' : 'actividades'} filtradas)</span>
                  )}
                  <span className="ml-1">de {totalCount} total</span>
                </>
              ) : (
                'No hay actividades para mostrar'
              )}
            </div>
            {viewMode === 'list' ? (
              <div className="space-y-4">
                {selectedActivity ? (
                  <div className="space-y-4">
                    {/* Mobile-first header design */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <h3 className="text-lg font-semibold text-warning bg-gradient-to-r from-warning/10 to-orange-500/10 px-3 py-2 rounded-lg">
                          <span className="hidden sm:inline">Detalles de Actividad</span>
                          <span className="sm:hidden">Detalles</span>
                        </h3>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={clearSelectedActivity}
                          className="text-xs bg-white/90 backdrop-blur-sm border-warning/30 hover:bg-warning/10"
                        >
                          <span className="hidden sm:inline">Cerrar</span>
                          <span className="sm:hidden">×</span>
                        </Button>
                      </div>
                      
                      {/* Action buttons - Mobile optimized */}
                      {(selectedActivity && (canEditActivity(selectedActivity) || canDeleteActivity(selectedActivity))) && (
                        <div className="flex gap-2 sm:gap-3">
                          {selectedActivity && canEditActivity(selectedActivity) && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                openEditDialog(selectedActivity as unknown as Location);
                              }}
                              className="flex-1 sm:flex-none text-xs bg-white/90 backdrop-blur-sm border-blue-300 text-blue-600 hover:bg-blue-50 h-9"
                              title="Editar actividad"
                            >
                              <Edit className="h-4 w-4 sm:mr-2" />
                              <span className="hidden sm:inline">Editar</span>
                            </Button>
                          )}
                          {selectedActivity && canDeleteActivity(selectedActivity) && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                openDeleteDialog(selectedActivity as unknown as Location);
                              }}
                              className="flex-1 sm:flex-none text-xs bg-white/90 backdrop-blur-sm border-red-300 text-red-600 hover:bg-red-50 h-9"
                              title="Eliminar actividad"
                            >
                              <Trash className="h-4 w-4 sm:mr-2" />
                              <span className="hidden sm:inline">Eliminar</span>
                            </Button>
                          )}
                        </div>
                      )}
                    </div>
                    
                    <div className="group relative overflow-hidden rounded-2xl border-0 bg-gradient-to-br from-warning/10 via-warning/5 to-white p-4 sm:p-6 backdrop-blur-sm shadow-2xl ring-2 ring-warning/60">
                      {/* Glass morphism effect */}
                      <div className="absolute inset-0 bg-white/20 backdrop-blur-[2px] rounded-2xl"></div>
                      
                      {/* Selection indicator with glow */}
                      <div className="absolute top-3 right-3 sm:top-5 sm:right-5 w-3 h-3 sm:w-4 sm:h-4 bg-gradient-to-r from-warning to-orange-500 rounded-full animate-pulse shadow-lg shadow-warning/50 z-10">
                        <div className="absolute inset-0.5 sm:inset-1 bg-white rounded-full"></div>
                      </div>

                      {/* Content wrapper */}
                      <div className="relative z-10">
                        {/* Header section - Mobile optimized */}
                        <div className="space-y-3 mb-4 sm:mb-6">
                          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                            <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
                              <div className={`inline-flex items-center rounded-full px-3 sm:px-4 py-1.5 sm:py-2 text-xs font-bold shadow-lg ${getVisitTypeColor(selectedActivity.visit_type)} backdrop-blur-sm`}>
                                {formatVisitType(selectedActivity.visit_type)}
                              </div>
                              {userRole === 'admin' && selectedActivity.user_name && (
                                <div className="flex items-center gap-2 text-xs sm:text-sm bg-gradient-to-r from-blue-500/10 to-purple-500/10 px-3 sm:px-4 py-1.5 sm:py-2 rounded-full border border-blue-200/50">
                                  <User className="h-3 w-3 sm:h-4 sm:w-4 text-blue-600" />
                                  <span className="font-semibold text-blue-700 truncate">{selectedActivity.user_name}</span>
                                </div>
                              )}
                            </div>
                            <div className="flex items-center gap-2 text-xs bg-white/90 backdrop-blur-sm px-3 sm:px-4 py-1.5 sm:py-2 rounded-full shadow-sm border border-gray-200/50">
                              <Clock className="h-3 w-3 text-gray-600" />
                              <span className="font-medium text-gray-700">
                                <span className="hidden sm:inline">{new Date(selectedActivity.created_at).toLocaleString()}</span>
                                <span className="sm:hidden">{new Date(selectedActivity.created_at).toLocaleDateString()}</span>
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Address and location section - Mobile optimized */}
                        <div className="space-y-4 mb-4 sm:mb-6">
                          <div className="flex items-start gap-3 sm:gap-4">
                            <div className="flex-shrink-0 w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br from-warning/20 to-orange-500/20 rounded-lg sm:rounded-xl flex items-center justify-center">
                              <MapPin className="h-5 w-5 sm:h-6 sm:w-6 text-warning" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-base sm:text-lg font-semibold text-gray-900 leading-relaxed mb-3 break-words">
                                {selectedActivity.address}
                              </p>
                                <div className="space-y-2 sm:space-y-0 sm:flex sm:flex-wrap sm:items-center sm:gap-3">
                                  <div className="flex items-center gap-2 bg-gradient-to-r from-green-500/10 to-emerald-500/10 px-2 sm:px-3 py-1.5 sm:py-2 rounded-lg border border-green-200/50">
                                  <Globe className="h-3 w-3 sm:h-4 sm:w-4 text-green-600" />
                                  <span className="font-semibold text-green-700 text-xs sm:text-sm">
                                    {selectedActivity.country || detectCountryFromCoordinates(selectedActivity.latitude, selectedActivity.longitude)}
                                  </span>
                                  <span className="text-green-400 font-bold hidden sm:inline">•</span>
                                  {(selectedActivity.state || detectStateFromCoordinates(
                                      selectedActivity.latitude, 
                                      selectedActivity.longitude,
                                      selectedActivity.country || detectCountryFromCoordinates(selectedActivity.latitude, selectedActivity.longitude)
                                    )) !== 'Región detectada' && (
                                    <span className="font-medium text-green-600 text-xs sm:text-sm">
                                      {selectedActivity.state || detectStateFromCoordinates(
                                        selectedActivity.latitude, 
                                        selectedActivity.longitude,
                                        selectedActivity.country || detectCountryFromCoordinates(selectedActivity.latitude, selectedActivity.longitude)
                                      )}
                                    </span>
                                  )}
                                </div>
                              </div>
                              {/* Google Maps Navigation Button - Mobile optimized */}
                              <div className="mt-3">
                                <Button asChild className="bg-blue-600 text-white hover:bg-blue-700 w-full h-10 sm:h-auto">
                                  <a
                                    href={getGoogleMapsHref(selectedActivity.address, selectedActivity.latitude, selectedActivity.longitude)}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    aria-label={`Abrir ${selectedActivity.address} en Google Maps`}
                                    onClick={(e) => {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      const href = getGoogleMapsHref(selectedActivity.address, selectedActivity.latitude, selectedActivity.longitude);
                                      if (href) {
                                        // Try to open in new tab
                                        try {
                                          const newWindow = window.open(href, '_blank', 'noopener,noreferrer');
                                          // Don't show error message - let the browser handle it naturally
                                          // The href attribute will work as fallback if window.open fails
                                        } catch (error) {
                                          // Silent fallback - the href attribute will handle it
                                          console.log('Window.open failed, using href fallback');
                                        }
                                      }
                                    }}
                                    onTouchEnd={(e) => {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      const href = getGoogleMapsHref(selectedActivity.address, selectedActivity.latitude, selectedActivity.longitude);
                                      if (href) {
                                        try {
                                          const newWindow = window.open(href, '_blank', 'noopener,noreferrer');
                                          // Silent - let browser handle it naturally
                                        } catch (error) {
                                          console.log('Window.open failed, using href fallback');
                                        }
                                      }
                                    }}
                                  >
                                    <Navigation className="h-4 w-4 mr-2" />
                                    <span className="hidden sm:inline">Abrir en Directorio</span>
                                    <span className="sm:hidden">Directorio</span>
                                  </a>
                                </Button>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Notes section - Mobile optimized */}
                        {selectedActivity.notes && (
                          <div className="mb-4 sm:mb-6 p-3 sm:p-4 bg-gradient-to-r from-amber-50/80 to-orange-50/80 rounded-lg sm:rounded-xl border-l-4 border-amber-400 backdrop-blur-sm">
                            <p className="text-sm text-amber-900 leading-relaxed font-medium break-words">
                              {selectedActivity.notes}
                            </p>
                          </div>
                        )}

                        {/* Business information section - Mobile optimized */}
                        {(selectedActivity.business_name || selectedActivity.contact_person || selectedActivity.contact_email || selectedActivity.phone) && (
                          <div className="mb-4 sm:mb-6 p-3 sm:p-4 bg-gradient-to-r from-blue-50/80 to-indigo-50/80 rounded-lg sm:rounded-xl border-l-4 border-blue-400 backdrop-blur-sm">
                            <h4 className="text-sm font-semibold text-blue-900 mb-3">Información de Negocio</h4>
                            <div className="space-y-3">
                              {selectedActivity.business_name && (
                                <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2 text-sm">
                                  <span className="font-medium text-blue-700 text-xs sm:text-sm">Negocio:</span>
                                  <span className="text-blue-800 text-sm break-words">{selectedActivity.business_name}</span>
                                </div>
                              )}
                              {selectedActivity.contact_person && (
                                <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2 text-sm">
                                  <span className="font-medium text-blue-700 text-xs sm:text-sm">Contacto:</span>
                                  <span className="text-blue-800 text-sm break-words">{selectedActivity.contact_person}</span>
                                </div>
                              )}
                              {selectedActivity.contact_email && (
                                <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2 text-sm">
                                  <span className="font-medium text-blue-700 text-xs sm:text-sm">Email:</span>
                                  <span className="text-blue-800 text-sm break-all">{selectedActivity.contact_email}</span>
                                </div>
                              )}
                              {selectedActivity.phone && (
                                <div className="space-y-3">
                                  <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2 text-sm">
                                    <span className="font-medium text-blue-700 text-xs sm:text-sm">Teléfono:</span>
                                    <span className="text-blue-800 text-sm">{selectedActivity.phone}</span>
                                  </div>
                                  <div className="flex flex-col sm:flex-row gap-2">
                                    <Button asChild className="bg-green-600 text-white hover:bg-green-700 h-10 sm:h-auto flex-1 sm:flex-none">
                                      <a
                                        href={getDialHref(selectedActivity.phone)}
                                        aria-label={`Llamar al ${selectedActivity.phone}`}
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          // Let the default behavior handle the phone call
                                        }}
                                        onTouchEnd={(e) => {
                                          e.stopPropagation();
                                          // Let the default behavior handle the phone call
                                        }}
                                      >
                                        <Phone className="h-4 w-4 mr-2" /> 
                                        <span className="hidden sm:inline">Llamar</span>
                                        <span className="sm:hidden">Llamar</span>
                                      </a>
                                    </Button>
                                    <Button asChild className="bg-green-500 text-white hover:bg-green-600 h-10 sm:h-auto flex-1 sm:flex-none">
                                      <a
                                        href={getWhatsAppHref(selectedActivity.phone)}
                                        aria-label={`Enviar WhatsApp a ${selectedActivity.phone}`}
                                        onClick={(e) => {
                                          e.preventDefault();
                                          e.stopPropagation();
                                          const href = getWhatsAppHref(selectedActivity.phone);
                                          if (href) {
                                            try {
                                              const newWindow = window.open(href, '_blank', 'noopener,noreferrer');
                                              // Silent - let browser handle it naturally
                                            } catch (error) {
                                              console.log('Window.open failed, using href fallback');
                                            }
                                          }
                                        }}
                                        onTouchEnd={(e) => {
                                          e.preventDefault();
                                          e.stopPropagation();
                                          const href = getWhatsAppHref(selectedActivity.phone);
                                          if (href) {
                                            try {
                                              const newWindow = window.open(href, '_blank', 'noopener,noreferrer');
                                              // Silent - let browser handle it naturally
                                            } catch (error) {
                                              console.log('Window.open failed, using href fallback');
                                            }
                                          }
                                        }}
                                      >
                                        <MessageCircle className="h-4 w-4 mr-2" /> 
                                        <span className="hidden sm:inline">WhatsApp</span>
                                        <span className="sm:hidden">WhatsApp</span>
                                      </a>
                                    </Button>
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        )}

                        
                        {/* Media display */}
                        <div className="mt-auto">
                          <ActivityMediaDisplay 
                            activityId={selectedActivity.id} 
                            activityAddress={selectedActivity.address}
                          />
                        </div>
                      </div>

                      {/* Enhanced selection overlay */}
                      <div className="absolute inset-0 bg-gradient-to-t from-warning/10 via-transparent to-transparent opacity-100 rounded-2xl pointer-events-none"></div>
                      
                      {/* Border glow effect */}
                      <div className="absolute inset-0 rounded-2xl opacity-100 pointer-events-none" style={{
                        background: 'linear-gradient(45deg, transparent, rgba(245, 158, 11, 0.1), transparent)',
                        border: '1px solid rgba(245, 158, 11, 0.2)'
                      }}></div>
                    </div>
                  </div>
                ) : (
                  <>
                    {filteredLocations.map((location) => (
                      <div
                        key={location.id}
                        className={`group relative overflow-hidden rounded-2xl border-0 bg-gradient-to-br from-white via-gray-50/30 to-white p-6 cursor-pointer transition-all duration-500 hover:shadow-2xl hover:scale-[1.02] hover:-translate-y-1 backdrop-blur-sm ${
                          selectedActivity?.id === location.id 
                            ? 'ring-2 ring-warning/60 shadow-2xl scale-[1.02] -translate-y-1 bg-gradient-to-br from-warning/10 via-warning/5 to-white' 
                            : 'hover:border-warning/40 hover:bg-gradient-to-br hover:from-white hover:via-warning/5 hover:to-white'
                        }`}
                        onClick={() => handleActivitySelect(location)}
                      >
                        {/* Glass morphism effect */}
                        <div className="absolute inset-0 bg-white/20 backdrop-blur-[2px] rounded-2xl"></div>
                        
                        {/* Selection indicator with glow */}
                        {selectedActivity?.id === location.id && (
                          <div className="absolute top-5 right-5 w-4 h-4 bg-gradient-to-r from-warning to-orange-500 rounded-full animate-pulse shadow-lg shadow-warning/50 z-10">
                            <div className="absolute inset-1 bg-white rounded-full"></div>
                          </div>
                        )}

                        {/* Content wrapper */}
                        <div className="relative z-10">
                          {/* Header section - Mobile optimized */}
                          <div className="space-y-3 mb-4 sm:mb-6">
                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                              <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
                                <div className={`inline-flex items-center rounded-full px-3 sm:px-4 py-1.5 sm:py-2 text-xs font-bold shadow-lg ${getVisitTypeColor(location.visit_type)} backdrop-blur-sm`}>
                                  {formatVisitType(location.visit_type)}
                                </div>
                                {userRole === 'admin' && location.user_name && (
                                  <div className="flex items-center gap-2 text-xs sm:text-sm bg-gradient-to-r from-blue-500/10 to-purple-500/10 px-3 sm:px-4 py-1.5 sm:py-2 rounded-full border border-blue-200/50">
                                    <User className="h-3 w-3 sm:h-4 sm:w-4 text-blue-600" />
                                    <span className="font-semibold text-blue-700 truncate">{location.user_name}</span>
                                  </div>
                                )}
                              </div>
                              <div className="flex items-center gap-2 text-xs bg-white/90 backdrop-blur-sm px-3 sm:px-4 py-1.5 sm:py-2 rounded-full shadow-sm border border-gray-200/50">
                                <Clock className="h-3 w-3 text-gray-600" />
                                <span className="font-medium text-gray-700">
                                  <span className="hidden sm:inline">{new Date(location.created_at).toLocaleString()}</span>
                                  <span className="sm:hidden">{new Date(location.created_at).toLocaleDateString()}</span>
                                </span>
                              </div>
                            </div>
                            
                            {/* Action buttons - Mobile optimized */}
                            {(canEditActivity(location) || canDeleteActivity(location)) && (
                              <div className="flex gap-2 sm:gap-3">
                                {canEditActivity(location) && (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={(e) => {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      openEditDialog(location);
                                    }}
                                    className="flex-1 sm:flex-none text-xs bg-white/90 backdrop-blur-sm border-blue-300 text-blue-600 hover:bg-blue-50 h-9"
                                    title="Editar actividad"
                                  >
                                    <Edit className="h-4 w-4 sm:mr-2" />
                                    <span className="hidden sm:inline">Editar</span>
                                  </Button>
                                )}
                                {canDeleteActivity(location) && (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={(e) => {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      openDeleteDialog(location);
                                    }}
                                    className="flex-1 sm:flex-none text-xs bg-white/90 backdrop-blur-sm border-red-300 text-red-600 hover:bg-red-50 h-9"
                                    title="Eliminar actividad"
                                  >
                                    <Trash className="h-4 w-4 sm:mr-2" />
                                    <span className="hidden sm:inline">Eliminar</span>
                                  </Button>
                                )}
                              </div>
                            )}
                          </div>

                          {/* Address and location section - Mobile optimized */}
                          <div className="space-y-4 mb-4 sm:mb-6">
                            <div className="flex items-start gap-3 sm:gap-4">
                              <div className="flex-shrink-0 w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br from-warning/20 to-orange-500/20 rounded-lg sm:rounded-xl flex items-center justify-center">
                                <MapPin className="h-5 w-5 sm:h-6 sm:w-6 text-warning" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-base sm:text-lg font-semibold text-gray-900 leading-relaxed mb-3 break-words">
                                  {location.address}
                                </p>
                                <div className="space-y-2 sm:space-y-0 sm:flex sm:flex-wrap sm:items-center sm:gap-3">
                                  <div className="flex items-center gap-2 bg-gradient-to-r from-green-500/10 to-emerald-500/10 px-2 sm:px-3 py-1.5 sm:py-2 rounded-lg border border-green-200/50">
                                    <Globe className="h-3 w-3 sm:h-4 sm:w-4 text-green-600" />
                                    <span className="font-semibold text-green-700 text-xs sm:text-sm">
                                      {location.country || detectCountryFromCoordinates(location.latitude, location.longitude)}
                                    </span>
                                    <span className="text-green-400 font-bold hidden sm:inline">•</span>
                                    {(location.state || detectStateFromCoordinates(
                                        location.latitude, 
                                        location.longitude,
                                        location.country || detectCountryFromCoordinates(location.latitude, location.longitude)
                                      )) !== 'Región detectada' && (
                                      <span className="font-medium text-green-600 text-xs sm:text-sm">
                                        {location.state || detectStateFromCoordinates(
                                          location.latitude, 
                                          location.longitude,
                                          location.country || detectCountryFromCoordinates(location.latitude, location.longitude)
                                        )}
                                      </span>
                                    )}
                                  </div>
                                </div>
                                {/* Action buttons - Mobile optimized */}
                                <div className="mt-3 space-y-2">
                                  {/* Google Maps Navigation Button - Smaller size */}
                                  <Button asChild className="bg-blue-600 text-white hover:bg-blue-700 w-full h-8 text-xs">
                                    <a
                                      href={getGoogleMapsHref(location.address, location.latitude, location.longitude)}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      aria-label={`Abrir ${location.address} en Google Maps`}
                                      onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        const href = getGoogleMapsHref(location.address, location.latitude, location.longitude);
                                        if (href) {
                                          try {
                                            const newWindow = window.open(href, '_blank', 'noopener,noreferrer');
                                            // Silent - let browser handle it naturally
                                          } catch (error) {
                                            console.log('Window.open failed, using href fallback');
                                          }
                                        }
                                      }}
                                      onTouchEnd={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        const href = getGoogleMapsHref(location.address, location.latitude, location.longitude);
                                        if (href) {
                                          try {
                                            const newWindow = window.open(href, '_blank', 'noopener,noreferrer');
                                            // Silent - let browser handle it naturally
                                          } catch (error) {
                                            console.log('Window.open failed, using href fallback');
                                          }
                                        }
                                      }}
                                    >
                                      <Navigation className="h-3 w-3 mr-1" />
                                      <span className="hidden sm:inline">Google Maps</span>
                                      <span className="sm:hidden">Maps</span>
                                    </a>
                                  </Button>
                                  
                                  {/* Phone and WhatsApp buttons - Show if phone number exists */}
                                  {location.phone && (
                                    <div className="flex gap-2">
                                      <Button asChild className="bg-green-600 text-white hover:bg-green-700 flex-1 h-8 text-xs">
                                        <a
                                          href={getDialHref(location.phone)}
                                          aria-label={`Llamar al ${location.phone}`}
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            // Let the default behavior handle the phone call
                                          }}
                                          onTouchEnd={(e) => {
                                            e.stopPropagation();
                                            // Let the default behavior handle the phone call
                                          }}
                                        >
                                          <Phone className="h-3 w-3 mr-1" /> 
                                          <span className="hidden sm:inline">Llamar</span>
                                          <span className="sm:hidden">Call</span>
                                        </a>
                                      </Button>
                                      <Button asChild className="bg-green-500 text-white hover:bg-green-600 flex-1 h-8 text-xs">
                                        <a
                                          href={getWhatsAppHref(location.phone)}
                                          aria-label={`Enviar WhatsApp a ${location.phone}`}
                                          onClick={(e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            const href = getWhatsAppHref(location.phone);
                                            if (href) {
                                              try {
                                                const newWindow = window.open(href, '_blank', 'noopener,noreferrer');
                                                // Silent - let browser handle it naturally
                                              } catch (error) {
                                                console.log('Window.open failed, using href fallback');
                                              }
                                            }
                                          }}
                                          onTouchEnd={(e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            const href = getWhatsAppHref(location.phone);
                                            if (href) {
                                              try {
                                                const newWindow = window.open(href, '_blank', 'noopener,noreferrer');
                                                // Silent - let browser handle it naturally
                                              } catch (error) {
                                                console.log('Window.open failed, using href fallback');
                                              }
                                            }
                                          }}
                                        >
                                          <MessageCircle className="h-3 w-3 mr-1" /> 
                                          <span className="hidden sm:inline">WhatsApp</span>
                                          <span className="sm:hidden">WA</span>
                                        </a>
                                      </Button>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Notes section - Mobile optimized */}
                          {location.notes && (
                            <div className="mb-4 sm:mb-6 p-3 sm:p-4 bg-gradient-to-r from-amber-50/80 to-orange-50/80 rounded-lg sm:rounded-xl border-l-4 border-amber-400 backdrop-blur-sm">
                              <p className="text-sm text-amber-900 leading-relaxed font-medium break-words">
                                {location.notes}
                              </p>
                            </div>
                          )}
                          
                          {/* Media display */}
                          <div className="mt-auto">
                            <ActivityMediaDisplay 
                              activityId={location.id} 
                              activityAddress={location.address}
                            />
                          </div>
                        </div>

                        {/* Enhanced hover overlay effect */}
                        <div className={`absolute inset-0 bg-gradient-to-t from-warning/10 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-all duration-500 rounded-2xl pointer-events-none ${
                          selectedActivity?.id === location.id ? 'opacity-100' : ''
                        }`}></div>
                        
                        {/* Subtle border glow on hover */}
                        <div className={`absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none ${
                          selectedActivity?.id === location.id ? 'opacity-100' : ''
                        }`} style={{
                          background: 'linear-gradient(45deg, transparent, rgba(245, 158, 11, 0.1), transparent)',
                          border: '1px solid rgba(245, 158, 11, 0.2)'
                        }}></div>
                      </div>
                    ))}
                  </>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 lg:gap-6">
                {filteredLocations.map((location) => (
                  <div
                    key={location.id}
                    className={`group relative overflow-hidden rounded-xl sm:rounded-2xl border-0 bg-gradient-to-br from-white via-gray-50/30 to-white p-4 sm:p-5 cursor-pointer transition-all duration-500 hover:shadow-2xl hover:scale-[1.02] sm:hover:scale-[1.03] hover:-translate-y-1 backdrop-blur-sm ${
                      selectedActivity?.id === location.id 
                        ? 'ring-2 ring-warning/60 shadow-2xl scale-[1.02] sm:scale-[1.03] -translate-y-1 bg-gradient-to-br from-warning/10 via-warning/5 to-white' 
                        : 'hover:border-warning/40 hover:bg-gradient-to-br hover:from-white hover:via-warning/5 hover:to-white'
                    }`}
                    onClick={() => handleActivitySelect(location)}
                  >
                    {/* Glass morphism effect */}
                    <div className="absolute inset-0 bg-white/20 backdrop-blur-[2px] rounded-xl sm:rounded-2xl"></div>
                    
                    {/* Selection indicator with glow */}
                    {selectedActivity?.id === location.id && (
                      <div className="absolute top-3 right-3 sm:top-4 sm:right-4 w-3 h-3 sm:w-4 sm:h-4 bg-gradient-to-r from-warning to-orange-500 rounded-full animate-pulse shadow-lg shadow-warning/50 z-10">
                        <div className="absolute inset-0.5 sm:inset-1 bg-white rounded-full"></div>
                      </div>
                    )}

                    {/* Content wrapper */}
                    <div className="relative z-10">
                      {/* Header with badge and date - Mobile optimized */}
                      <div className="space-y-2 mb-3 sm:mb-4">
                        <div className="flex items-start justify-between">
                          <div className={`inline-flex items-center rounded-full px-2.5 sm:px-3 py-1 sm:py-1.5 text-xs font-bold shadow-lg ${getVisitTypeColor(location.visit_type)} backdrop-blur-sm`}>
                            {formatVisitType(location.visit_type)}
                          </div>
                          <div className="flex items-center gap-1.5 sm:gap-2 text-xs bg-white/90 backdrop-blur-sm px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-full shadow-sm border border-gray-200/50">
                            <Clock className="h-3 w-3 text-gray-600" />
                            <span className="font-medium text-gray-700">
                              <span className="hidden sm:inline">{new Date(location.created_at).toLocaleDateString()}</span>
                              <span className="sm:hidden">{new Date(location.created_at).toLocaleDateString().split('/')[0]}/{new Date(location.created_at).toLocaleDateString().split('/')[1]}</span>
                            </span>
                          </div>
                        </div>
                        
                        {/* Action buttons for grid view - Mobile optimized */}
                        {(canEditActivity(location) || canDeleteActivity(location)) && (
                          <div className="flex gap-2">
                            {canEditActivity(location) && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  openEditDialog(location);
                                }}
                                className="flex-1 text-xs bg-white/90 backdrop-blur-sm border-blue-300 text-blue-600 hover:bg-blue-50 h-8"
                                title="Editar actividad"
                              >
                                <Edit className="h-3.5 w-3.5 sm:mr-1" />
                                <span className="hidden sm:inline text-xs">Editar</span>
                              </Button>
                            )}
                            {canDeleteActivity(location) && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  openDeleteDialog(location);
                                }}
                                className="flex-1 text-xs bg-white/90 backdrop-blur-sm border-red-300 text-red-600 hover:bg-red-50 h-8"
                                title="Eliminar actividad"
                              >
                                <Trash className="h-3.5 w-3.5 sm:mr-1" />
                                <span className="hidden sm:inline text-xs">Eliminar</span>
                              </Button>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Address section - Mobile optimized */}
                      <div className="space-y-3 mb-3 sm:mb-4">
                        <div className="flex items-start gap-2.5 sm:gap-3">
                          <div className="flex-shrink-0 w-8 h-8 sm:w-10 sm:h-10 bg-gradient-to-br from-warning/20 to-orange-500/20 rounded-md sm:rounded-lg flex items-center justify-center">
                            <MapPin className="h-4 w-4 sm:h-5 sm:w-5 text-warning" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-gray-900 line-clamp-2 leading-relaxed mb-2 break-words">
                              {location.address}
                            </p>
                            <div className="space-y-1.5 sm:space-y-0 sm:flex sm:items-center sm:gap-2">
                              <div className="flex items-center gap-1 bg-gradient-to-r from-green-500/10 to-emerald-500/10 px-2 py-1 rounded-md border border-green-200/50">
                                <Globe className="h-3 w-3 text-green-600" />
                                <span className="font-semibold text-green-700 text-xs">
                                  {location.country || detectCountryFromCoordinates(location.latitude, location.longitude)}
                                </span>
                                <span className="text-green-400 font-bold hidden sm:inline">•</span>
                                {(location.state || detectStateFromCoordinates(
                                    location.latitude, 
                                    location.longitude,
                                    location.country || detectCountryFromCoordinates(location.latitude, location.longitude)
                                  )) !== 'Región detectada' && (
                                  <span className="font-medium text-green-600 text-xs">
                                    {location.state || detectStateFromCoordinates(
                                      location.latitude, 
                                      location.longitude,
                                      location.country || detectCountryFromCoordinates(location.latitude, location.longitude)
                                    )}
                                  </span>
                                )}
                              </div>
                            </div>
                            {/* Action buttons - Mobile optimized */}
                            <div className="mt-2 space-y-1.5">
                              {/* Google Maps Navigation Button - Smaller size */}
                              <Button asChild className="bg-blue-600 text-white hover:bg-blue-700 w-full text-xs h-7">
                                <a
                                  href={getGoogleMapsHref(location.address, location.latitude, location.longitude)}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  aria-label={`Abrir ${location.address} en Google Maps`}
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    const href = getGoogleMapsHref(location.address, location.latitude, location.longitude);
                                    if (href) {
                                      try {
                                        const newWindow = window.open(href, '_blank', 'noopener,noreferrer');
                                        // Silent - let browser handle it naturally
                                      } catch (error) {
                                        console.log('Window.open failed, using href fallback');
                                      }
                                    }
                                  }}
                                  onTouchEnd={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    const href = getGoogleMapsHref(location.address, location.latitude, location.longitude);
                                    if (href) {
                                      try {
                                        const newWindow = window.open(href, '_blank', 'noopener,noreferrer');
                                        // Silent - let browser handle it naturally
                                      } catch (error) {
                                        console.log('Window.open failed, using href fallback');
                                      }
                                    }
                                  }}
                                >
                                  <Navigation className="h-3 w-3 mr-1" />
                                  <span className="hidden sm:inline">Maps</span>
                                  <span className="sm:hidden">Maps</span>
                                </a>
                              </Button>
                              
                              {/* Phone and WhatsApp buttons - Show if phone number exists */}
                              {location.phone && (
                                <div className="flex gap-1">
                                  <Button asChild className="bg-green-600 text-white hover:bg-green-700 flex-1 text-xs h-7">
                                    <a
                                      href={getDialHref(location.phone)}
                                      aria-label={`Llamar al ${location.phone}`}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        // Let the default behavior handle the phone call
                                      }}
                                      onTouchEnd={(e) => {
                                        e.stopPropagation();
                                        // Let the default behavior handle the phone call
                                      }}
                                    >
                                      <Phone className="h-3 w-3" /> 
                                    </a>
                                  </Button>
                                  <Button asChild className="bg-green-500 text-white hover:bg-green-600 flex-1 text-xs h-7">
                                    <a
                                      href={getWhatsAppHref(location.phone)}
                                      aria-label={`Enviar WhatsApp a ${location.phone}`}
                                      onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        const href = getWhatsAppHref(location.phone);
                                        if (href) {
                                          try {
                                            const newWindow = window.open(href, '_blank', 'noopener,noreferrer');
                                            // Silent - let browser handle it naturally
                                          } catch (error) {
                                            console.log('Window.open failed, using href fallback');
                                          }
                                        }
                                      }}
                                      onTouchEnd={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        const href = getWhatsAppHref(location.phone);
                                        if (href) {
                                          try {
                                            const newWindow = window.open(href, '_blank', 'noopener,noreferrer');
                                            // Silent - let browser handle it naturally
                                          } catch (error) {
                                            console.log('Window.open failed, using href fallback');
                                          }
                                        }
                                      }}
                                    >
                                      <MessageCircle className="h-3 w-3" /> 
                                    </a>
                                  </Button>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* User info for admin - Mobile optimized */}
                      {userRole === 'admin' && location.user_name && (
                        <div className="flex items-center gap-2 text-xs bg-gradient-to-r from-blue-500/10 to-purple-500/10 px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-full border border-blue-200/50 mb-3 sm:mb-4">
                          <User className="h-3 w-3 text-blue-600" />
                          <span className="font-semibold text-blue-700 truncate">{location.user_name}</span>
                        </div>
                      )}

                      {/* Notes preview - Mobile optimized */}
                      {location.notes && (
                        <div className="mb-3 sm:mb-4 p-2.5 sm:p-3 bg-gradient-to-r from-amber-50/80 to-orange-50/80 rounded-lg border-l-3 border-amber-400 backdrop-blur-sm">
                          <p className="text-xs text-amber-900 line-clamp-2 leading-relaxed font-medium break-words">
                            {location.notes}
                          </p>
                        </div>
                      )}
                      
                      {/* Media display */}
                      <div className="mt-auto">
                        <ActivityMediaDisplay 
                          activityId={location.id} 
                          activityAddress={location.address}
                        />
                      </div>
                    </div>

                    {/* Enhanced hover overlay effect */}
                    <div className={`absolute inset-0 bg-gradient-to-t from-warning/10 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-all duration-500 rounded-2xl pointer-events-none ${
                      selectedActivity?.id === location.id ? 'opacity-100' : ''
                    }`}></div>
                    
                    {/* Subtle border glow on hover */}
                    <div className={`absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none ${
                      selectedActivity?.id === location.id ? 'opacity-100' : ''
                    }`} style={{
                      background: 'linear-gradient(45deg, transparent, rgba(245, 158, 11, 0.1), transparent)',
                      border: '1px solid rgba(245, 158, 11, 0.2)'
                    }}></div>
                  </div>
                ))}
              </div>
            )}
            {loadingMore && (
              <div className="text-center py-4">
                <Loader2 className="h-6 w-6 animate-spin text-warning" />
                <span className="ml-2">Cargando más actividades...</span>
              </div>
            )}
                         {!loadingMore && hasMore && (
               <div className="text-center py-4">
                 <Button onClick={loadMore} className="bg-warning text-white border-warning hover:bg-warning/90 w-full sm:w-auto">
                   {loadingMore ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                   Cargar más
                 </Button>
               </div>
             )}
          </div>
        )}
      </CardContent>
      
      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Trash className="h-5 w-5 text-red-600" />
              Eliminar Actividad
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p>¿Estás seguro de que quieres eliminar esta actividad?</p>
              {activityToDelete && (
                <div className="p-3 bg-gray-50 rounded-lg border">
                  <p className="font-medium text-sm text-gray-900">{activityToDelete.address}</p>
                  <p className="text-xs text-gray-600 mt-1">
                    {activityToDelete.visit_type} • {new Date(activityToDelete.created_at).toLocaleDateString()}
                  </p>
                </div>
              )}
              <p className="text-red-600 text-sm font-medium">Esta acción no se puede deshacer.</p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDeleteActivity}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              <Trash className="h-4 w-4 mr-2" />
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Edit Activity Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit className="h-5 w-5 text-blue-600" />
              Editar Actividad
            </DialogTitle>
            <DialogDescription>
              Modifica los detalles de la actividad. Los cambios se guardarán inmediatamente.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-6 py-4">
            {/* Address */}
            <div className="space-y-2">
              <Label htmlFor="edit-address">Dirección *</Label>
              <Textarea
                id="edit-address"
                value={editForm.address}
                onChange={(e) => handleEditFormChange('address', e.target.value)}
                placeholder="Ingresa la dirección completa"
                className="min-h-[80px]"
                required
              />
            </div>

            {/* Visit Type */}
            <div className="space-y-2">
              <Label htmlFor="edit-visit-type">Tipo de Visita *</Label>
              <Select value={editForm.visit_type} onValueChange={(value) => handleEditFormChange('visit_type', value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona el tipo de visita" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Visita en frío">Visita en frío</SelectItem>
                  <SelectItem value="Negociación">Negociación</SelectItem>
                  <SelectItem value="Pre-entrega">Pre-entrega</SelectItem>
                  <SelectItem value="Técnica">Técnica</SelectItem>
                  <SelectItem value="Visita de cortesía">Visita de cortesía</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <Label htmlFor="edit-notes">Notas</Label>
              <Textarea
                id="edit-notes"
                value={editForm.notes}
                onChange={(e) => handleEditFormChange('notes', e.target.value)}
                placeholder="Agrega notas adicionales sobre la visita"
                className="min-h-[100px]"
              />
            </div>

            {/* Business Information */}
            <div className="space-y-4">
              <h4 className="text-sm font-semibold text-gray-900 border-b pb-2">Información del Negocio</h4>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-business-name">Nombre del Negocio</Label>
                  <Input
                    id="edit-business-name"
                    value={editForm.business_name}
                    onChange={(e) => handleEditFormChange('business_name', e.target.value)}
                    placeholder="Nombre de la empresa"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="edit-contact-person">Persona de Contacto</Label>
                  <Input
                    id="edit-contact-person"
                    value={editForm.contact_person}
                    onChange={(e) => handleEditFormChange('contact_person', e.target.value)}
                    placeholder="Nombre del contacto"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="edit-contact-email">Email del Contacto</Label>
                  <Input
                    id="edit-contact-email"
                    type="email"
                    value={editForm.contact_email}
                    onChange={(e) => handleEditFormChange('contact_email', e.target.value)}
                    placeholder="email@ejemplo.com"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="edit-phone">Teléfono del Contacto</Label>
                  <Input
                    id="edit-phone"
                    type="tel"
                    value={editForm.phone}
                    onChange={(e) => handleEditFormChange('phone', e.target.value)}
                    placeholder="+1234567890"
                  />
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={confirmEditActivity} className="bg-blue-600 hover:bg-blue-700">
              <Edit className="h-4 w-4 mr-2" />
              Guardar Cambios
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
};

export default LocationHistory;