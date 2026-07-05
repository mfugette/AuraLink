export interface Account {
  id: string;
  email: string;
  displayName: string;
  createdAt: string;
}

export interface SavedVehicle {
  id: string;
  accountId: string;
  nickname: string | null;
  year: number | null;
  make: string | null;
  model: string | null;
  subModel: string | null;
  engine: string | null;
  driveType: string | null;
  transmission: string | null;
  fuelType: string | null;
  bodyStyle: string | null;
  mileage: number | null;
  vin: string | null;
  isPrimary: boolean;
  createdAt: string;
}

export interface AccountSettings {
  accountId: string;
  notifyEmail: boolean;
  notifySms: boolean;
  preferredUnits: 'imperial' | 'metric';
  theme: 'dark' | 'light';
}

export type NewSavedVehicle = Omit<SavedVehicle, 'id' | 'accountId' | 'createdAt'>;
