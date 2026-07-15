import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { InboxService } from './inbox.service';
import { AppNotification, SmsPrefs } from '../models/notification.model';
import { environment } from '../../environments/environment';

const API = environment.apiUrl;

const NOTIFS: AppNotification[] = [
  { id: 'n1', category: 'maintenance', title: 'Oil change due', body: '', createdAt: '2026-07-05T09:30:00', read: false },
  { id: 'n2', category: 'health', title: 'Coolant ran hot', body: '', createdAt: '2026-07-05T06:26:00', read: true },
];
const PREFS: SmsPrefs = { health: true, maintenance: true, billing: false, aura: false };

// Flush the two GETs load() fires so the service is in a loaded state.
function flushLoad(httpMock: HttpTestingController): void {
  httpMock.expectOne(`${API}/api/account/notifications`).flush({ notifications: NOTIFS });
  httpMock.expectOne(`${API}/api/account/notifications/sms-prefs`).flush({ smsPrefs: PREFS });
}

describe('InboxService', () => {
  let service: InboxService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(InboxService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('starts empty before load()', () => {
    expect(service.notifications()).toEqual([]);
    expect(service.unreadCount()).toBe(0);
  });

  it('load() fetches notifications + sms prefs and counts unread', () => {
    service.load();
    flushLoad(httpMock);
    expect(service.notifications().length).toBe(2);
    expect(service.unreadCount()).toBe(1);
    expect(service.smsPrefs()).toEqual(PREFS);
  });

  it('markRead optimistically flips read and POSTs', () => {
    service.load();
    flushLoad(httpMock);

    service.markRead('n1');
    expect(service.unreadCount()).toBe(0); // optimistic

    const req = httpMock.expectOne(`${API}/api/account/notifications/n1/read`);
    expect(req.request.method).toBe('POST');
    req.flush(null);
  });

  it('markAllRead POSTs to read-all', () => {
    service.load();
    flushLoad(httpMock);

    service.markAllRead();
    expect(service.unreadCount()).toBe(0);

    const req = httpMock.expectOne(`${API}/api/account/notifications/read-all`);
    expect(req.request.method).toBe('POST');
    req.flush(null);
  });

  it('setSmsPref optimistically updates then PATCHes', () => {
    service.load();
    flushLoad(httpMock);

    service.setSmsPref('billing', true);
    expect(service.smsPrefs().billing).toBe(true); // optimistic

    const req = httpMock.expectOne(`${API}/api/account/notifications/sms-prefs`);
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual({ category: 'billing', on: true });
    req.flush({ smsPrefs: { ...PREFS, billing: true } });
    expect(service.smsPrefs().billing).toBe(true);
  });

  it('setSmsPref rolls back the optimistic change when the request fails', () => {
    service.load();
    flushLoad(httpMock);

    service.setSmsPref('aura', true);
    const req = httpMock.expectOne(`${API}/api/account/notifications/sms-prefs`);
    req.flush({ error: 'nope' }, { status: 500, statusText: 'Server Error' });
    expect(service.smsPrefs().aura).toBe(false); // rolled back
  });

  it('clear() resets notifications and prefs to defaults', () => {
    service.load();
    flushLoad(httpMock);

    service.clear();
    expect(service.notifications()).toEqual([]);
    expect(service.smsPrefs()).toEqual({ health: true, maintenance: true, billing: false, aura: false });
  });
});
