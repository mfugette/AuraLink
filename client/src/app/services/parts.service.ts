import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { Part } from '../models/part.model';
import { Vehicle } from '../models/vehicle.model';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class PartsService {
  private readonly base = environment.apiUrl;

  constructor(private http: HttpClient) {}

  searchParts(partName: string, vehicle: Vehicle): Observable<Part[]> {
    const params = new HttpParams()
      .set('part', partName)
      .set('year', vehicle.year ? String(vehicle.year) : '')
      .set('make', vehicle.make ?? '')
      .set('model', vehicle.model ?? '');

    return this.http
      .get<{ results: Part[] }>(`${this.base}/api/parts/search`, { params })
      .pipe(map(r => r.results ?? []));
  }
}
