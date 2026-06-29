import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map, of, catchError } from 'rxjs';
import { Vehicle } from '../models/vehicle.model';

interface NhtsaMakesResponse {
  Results: Array<{ MakeId: number; MakeName: string }>;
}

interface NhtsaModelsResponse {
  Results: Array<{ Model_ID: number; Model_Name: string }>;
}

interface NhtsaVinResponse {
  Results: Array<{ Variable: string; Value: string }>;
}

@Injectable({ providedIn: 'root' })
export class VehicleService {
  private readonly nhtsaBase = 'https://vpic.nhtsa.dot.gov/api/vehicles';

  constructor(private http: HttpClient) {}

  getYears(): number[] {
    const currentYear = new Date().getFullYear() + 1;
    return Array.from({ length: currentYear - 1980 }, (_, i) => currentYear - i);
  }

  getMakes(year: number): Observable<string[]> {
    return this.http
      .get<NhtsaMakesResponse>(`${this.nhtsaBase}/GetMakesForVehicleType/car?year=${year}&format=json`)
      .pipe(
        map(r => r.Results.map(m => m.MakeName).sort()),
        catchError(() => of([]))
      );
  }

  getModels(year: number, make: string): Observable<string[]> {
    return this.http
      .get<NhtsaModelsResponse>(
        `${this.nhtsaBase}/GetModelsForMakeYear/make/${encodeURIComponent(make)}/modelyear/${year}?format=json`
      )
      .pipe(
        map(r => r.Results.map(m => m.Model_Name).sort()),
        catchError(() => of([]))
      );
  }

  decodeVin(vin: string): Observable<Partial<Vehicle>> {
    return this.http
      .get<NhtsaVinResponse>(`${this.nhtsaBase}/DecodeVin/${encodeURIComponent(vin)}?format=json`)
      .pipe(
        map(r => {
          const find = (label: string) =>
            r.Results.find(x => x.Variable === label)?.Value ?? null;
          const yearStr = find('Model Year');
          return {
            year: yearStr ? parseInt(yearStr, 10) : null,
            make: find('Make'),
            model: find('Model'),
            subModel: find('Trim'),
            vin: vin.toUpperCase(),
          } as Partial<Vehicle>;
        }),
        catchError(() => of({}))
      );
  }
}
