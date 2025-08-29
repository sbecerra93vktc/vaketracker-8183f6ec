import { create } from 'zustand';

interface Activity {
  id: string;
  latitude: number;
  longitude: number;
  address: string;
  notes: string;
  visit_type: string;
  created_at: string;
  country?: string;
  state?: string;
  user_id: string;
  
  // LocationHistory fields
  user_name?: string;
  user_email?: string;
  
  // GoogleMapComponent fields
  name?: string;
  email?: string;
  region?: string;
  business_name?: string;
  contact_person?: string;
  contact_email?: string;
  phone?: string;
  photos?: string[];
}

interface MapCamera {
  latitude: number;
  longitude: number;
  zoom: number;
}

interface ActivityStore {
  selectedActivity: Activity | null;
  mapCamera: MapCamera | null;
  setSelectedActivity: (activity: Activity | null) => void;
  clearSelectedActivity: () => void;
  moveMapToLocation: (latitude: number, longitude: number, zoom?: number) => void;
  clearMapCamera: () => void;
}

export const useActivityStore = create<ActivityStore>((set) => ({
  selectedActivity: null,
  mapCamera: null,
  setSelectedActivity: (activity) => set({ selectedActivity: activity }),
  clearSelectedActivity: () => set({ selectedActivity: null }),
  moveMapToLocation: (latitude, longitude, zoom = 15) => set({ 
    mapCamera: { latitude, longitude, zoom } 
  }),
  clearMapCamera: () => set({ mapCamera: null }),
}));
