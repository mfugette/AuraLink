import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { NotificationService } from './notification.service';
import { PartSearchResult } from '../models/part.model';
import { environment } from '../../environments/environment';

function result(name: string, price: number, selected: boolean): PartSearchResult {
  return {
    part: {
      name, partNumber: `PN-${name}`, price,
      store: { name: 'AutoZone', address: '1 Main St' },
    },
    selected,
  } as unknown as PartSearchResult;
}

describe('NotificationService', () => {
  let service: NotificationService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(NotificationService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('send POSTs the payload to /api/notify', () => {
    const payload = { recipient: '5551234', type: 'sms' as const, items: [] };
    service.send(payload).subscribe();
    const req = httpMock.expectOne(`${environment.apiUrl}/api/notify`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(payload);
    req.flush({ success: true, message: 'sent' });
  });

  it('buildShoppingList includes only selected items and totals them', () => {
    const text = service.buildShoppingList([
      result('Oxygen Sensor', 45.5, true),
      result('Spark Plug', 12.25, false),
      result('Catalytic Converter', 200, true),
    ]);
    expect(text).toContain('Oxygen Sensor');
    expect(text).not.toContain('Spark Plug');
    expect(text).toContain('Estimated Total: $245.50');
  });

  it('buildShoppingList returns empty for no selection', () => {
    expect(service.buildShoppingList([result('X', 1, false)])).toBe('');
  });
});
