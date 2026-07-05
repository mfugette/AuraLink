import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { ServiceCategory, ServiceSearchResponse } from '../models/service-place.model';

// Talks to our Express /api/places proxy (which holds the Google key). The
// client passes either browser-geolocation coordinates or a typed zip/address.
@Injectable({ providedIn: 'root' })
export class ServicesService {
  private readonly http = inject(HttpClient);
  private readonly base = environment.apiUrl;

  searchByCoords(category: ServiceCategory, lat: number, lng: number): Observable<ServiceSearchResponse> {
    const params = new HttpParams()
      .set('category', category)
      .set('lat', String(lat))
      .set('lng', String(lng));
    return this.http.get<ServiceSearchResponse>(`${this.base}/api/places/search`, { params });
  }

  searchByZip(category: ServiceCategory, zip: string): Observable<ServiceSearchResponse> {
    const params = new HttpParams().set('category', category).set('zip', zip);
    return this.http.get<ServiceSearchResponse>(`${this.base}/api/places/search`, { params });
  }

  /** Browser geolocation as a promise (rejects if denied/unavailable). */
  getCurrentPosition(): Promise<{ lat: number; lng: number }> {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Geolocation is not supported on this device.'));
        return;
      }
      navigator.geolocation.getCurrentPosition(
        pos => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        err => reject(err),
        { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 },
      );
    });
  }
}
