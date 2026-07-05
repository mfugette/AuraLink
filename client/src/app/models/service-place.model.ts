// A nearby automotive service returned by the Places finder.
export interface ServicePlace {
  id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  distanceMiles: number;
  rating: number | null;
  ratingCount: number;
  phone: string | null;
  openNow: boolean | null;
  mapsUrl: string | null;
}

export type ServiceCategory = 'mechanic' | 'tow' | 'tire' | 'parts';

export interface ServiceSearchResponse {
  origin: { lat: number; lng: number };
  resolvedLocation: string | null;
  places: ServicePlace[];
}
