import { Injectable } from '@angular/core';
import { Observable, of, delay } from 'rxjs';
import { Part, PartStore } from '../models/part.model';
import { Vehicle } from '../models/vehicle.model';

// TODO: Replace with real auto-parts API (AutoZone, O'Reilly, NAPA, etc.)
@Injectable({ providedIn: 'root' })
export class PartsService {
  searchParts(partName: string, vehicle: Vehicle, zipCode: string): Observable<Part[]> {
    console.log('[PartsService] searchParts stub called', { partName, vehicle, zipCode });

    // --- STUB: Return mock data until real API is wired ---
    const mockStores: PartStore[] = [
      {
        id: 'az-001',
        name: 'AutoZone',
        address: `123 Main St, ${zipCode}`,
        phone: '(555) 123-4567',
        distance: 1.2,
        latitude: 0,
        longitude: 0,
      },
      {
        id: 'or-001',
        name: "O'Reilly Auto Parts",
        address: `456 Oak Ave, ${zipCode}`,
        phone: '(555) 987-6543',
        distance: 2.7,
        latitude: 0,
        longitude: 0,
      },
      {
        id: 'np-001',
        name: 'NAPA Auto Parts',
        address: `789 Elm Blvd, ${zipCode}`,
        phone: '(555) 456-7890',
        distance: 3.4,
        latitude: 0,
        longitude: 0,
      },
    ];

    const mockParts: Part[] = mockStores.map((store, i) => ({
      id: `${store.id}-${i}`,
      name: partName,
      partNumber: `MOCK-${Math.floor(Math.random() * 90000 + 10000)}`,
      price: parseFloat((Math.random() * 80 + 15).toFixed(2)),
      inStock: Math.random() > 0.2,
      store,
    }));

    return of(mockParts).pipe(delay(600));
  }

  getNearbyStores(zipCode: string): Observable<PartStore[]> {
    console.log('[PartsService] getNearbyStores stub called', { zipCode });
    // TODO: Replace with real store locator API
    return of([]).pipe(delay(300));
  }
}
