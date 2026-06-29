export interface Part {
  id: string;
  name: string;
  partNumber: string;
  price: number;
  inStock: boolean;
  store: PartStore;
  url?: string;
}

export interface PartStore {
  id: string;
  name: string;
  address: string;
  phone: string;
  distance: number;
  latitude: number;
  longitude: number;
}

export interface PartSearchResult {
  part: Part;
  selected: boolean;
}
