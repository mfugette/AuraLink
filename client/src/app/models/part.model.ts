export type PartCondition = 'New' | 'Refurbished' | 'Used';

export interface Part {
  id: string;
  name: string;
  partNumber: string;
  price: number;
  inStock: boolean;
  store: PartStore;
  url?: string;
  images?: string[];
  source?: 'ebay' | 'amazon' | 'mock';
  listingTitle?: string;
  condition?: PartCondition;
  sellerRating?: number | null;
  freeShipping?: boolean;
  bestOffer?: boolean;
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
  imageIndex?: number;
}
