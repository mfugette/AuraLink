import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map, of, catchError } from 'rxjs';
import { Vehicle } from '../models/vehicle.model';
import { environment } from '../../environments/environment';

interface NhtsaMakesResponse {
  Results: Array<{ MakeId: number; MakeName: string }>;
}

interface NhtsaModelsResponse {
  Results: Array<{ Model_ID: number; Model_Name: string }>;
}

interface NhtsaVinResponse {
  Results: Array<{ Variable: string; Value: string }>;
}

export interface VehicleTrim {
  subModel: string;
  engine: string | null;
  label: string;
}

@Injectable({ providedIn: 'root' })
export class VehicleService {
  private readonly nhtsaBase = 'https://vpic.nhtsa.dot.gov/api/vehicles';
  private readonly apiBase = environment.apiUrl;

  constructor(private http: HttpClient) {}

  // CarAPI-backed trim/engine lookup (currently covers all makes, 2015+).
  // Returns an empty array for uncovered vehicles or on any failure —
  // callers should fall back to free-text entry when this comes back empty.
  getTrims(year: number, make: string, model: string): Observable<VehicleTrim[]> {
    const params = new HttpParams()
      .set('year', String(year))
      .set('make', make)
      .set('model', model);

    return this.http
      .get<{ trims: VehicleTrim[] }>(`${this.apiBase}/api/vehicle/trims`, { params })
      .pipe(
        map(r => r.trims ?? []),
        catchError(() => of([]))
      );
  }

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
        // NHTSA returns duplicate Model_Name entries under different Model_IDs
        // (the API doesn't expose what distinguishes them) — dedupe by name.
        map(r => [...new Set(r.Results.map(m => m.Model_Name))].sort()),
        catchError(() => of([]))
      );
  }

  decodeVin(vin: string): Observable<Partial<Vehicle>> {
    return this.http
      .get<NhtsaVinResponse>(`${this.nhtsaBase}/DecodeVin/${encodeURIComponent(vin)}?format=json`)
      .pipe(
        map(r => {
          const find = (label: string) =>
            r.Results.find(x => x.Variable === label)?.Value?.trim() || null;

          const yearStr = find('Model Year');

          // Build engine string: e.g. "3.5L V6"
          const disp = find('Displacement (L)');
          const cyl  = find('Engine Number of Cylinders');
          const conf = find('Engine Configuration'); // "V", "Inline", "Opposed"
          const engineParts: string[] = [];
          if (disp) engineParts.push(`${parseFloat(disp).toFixed(1)}L`);
          if (conf && cyl) {
            const abbr = conf.toLowerCase().startsWith('inline') ? 'I' : conf.charAt(0).toUpperCase();
            engineParts.push(`${abbr}${cyl}`);
          }

          return {
            year:         yearStr ? parseInt(yearStr, 10) : null,
            make:         find('Make'),
            model:        find('Model'),
            subModel:     find('Trim'),
            engine:       engineParts.length ? engineParts.join(' ') : null,
            driveType:    this.normalizeDriveType(find('Drive Type')),
            transmission: this.normalizeTransmission(find('Transmission Style')),
            fuelType:     this.normalizeFuelType(find('Fuel Type - Primary')),
            bodyStyle:    this.normalizeBodyStyle(find('Body Class')),
            vin:          vin.toUpperCase(),
          } as Partial<Vehicle>;
        }),
        catchError(() => of({}))
      );
  }

  private normalizeDriveType(raw: string | null): string | null {
    if (!raw) return null;
    const r = raw.toUpperCase();
    if (r.includes('AWD') || r.includes('ALL WHEEL')) return 'AWD';
    if (r.includes('4WD') || r.includes('4X4') || r.includes('FOUR WHEEL')) return '4WD';
    if (r.includes('FWD') || r.includes('FRONT WHEEL')) return 'FWD';
    if (r.includes('RWD') || r.includes('REAR WHEEL')) return 'RWD';
    return null;
  }

  private normalizeTransmission(raw: string | null): string | null {
    if (!raw) return null;
    const r = raw.toUpperCase();
    if (r.includes('CVT') || r.includes('CONTINUOUSLY VARIABLE')) return 'CVT';
    if (r.includes('DUAL') || r.includes('DCT') || r.includes('DSG')) return 'DCT';
    if (r.includes('MANUAL') || r.includes('STANDARD')) return 'Manual';
    if (r.includes('AUTOMATIC')) return 'Automatic';
    return null;
  }

  private normalizeFuelType(raw: string | null): string | null {
    if (!raw) return null;
    const r = raw.toUpperCase();
    if (r.includes('PLUG') || r.includes('PHEV')) return 'Plug-in Hybrid';
    if (r.includes('HYBRID')) return 'Hybrid';
    if (r.includes('ELECTRIC')) return 'Electric';
    if (r.includes('DIESEL')) return 'Diesel';
    if (r.includes('FLEX') || r.includes('FFV') || r.includes('E85')) return 'Flex Fuel';
    if (r.includes('GAS') || r.includes('PETROL')) return 'Gasoline';
    return null;
  }

  private normalizeBodyStyle(raw: string | null): string | null {
    if (!raw) return null;
    const r = raw.toUpperCase();
    if (r.includes('CONVERTIBLE') || r.includes('CABRIOLET')) return 'Convertible';
    if (r.includes('COUPE')) return 'Coupe';
    if (r.includes('HATCHBACK')) return 'Hatchback';
    if (r.includes('WAGON') || r.includes('ESTATE')) return 'Wagon';
    if (r.includes('VAN') || r.includes('MINIVAN')) return 'Van/Minivan';
    if (r.includes('PICKUP') || r.includes('TRUCK')) return 'Truck';
    if (r.includes('SPORT UTILITY') || r.includes('SUV') || r.includes('MULTI-PURPOSE')) return 'SUV/Crossover';
    if (r.includes('SEDAN') || r.includes('SALOON')) return 'Sedan';
    return null;
  }
}
