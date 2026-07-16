import { TestBed, ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { NotificationsComponent } from './notifications.component';
import { InboxService } from '../../services/inbox.service';
import { TierService } from '../../services/tier.service';
import { AppNotification, SmsPrefs } from '../../models/notification.model';
import { environment } from '../../../environments/environment';
import { clearAppStorage } from '../../../testing/test-utils';

const API = environment.apiUrl;

const NOTIFS: AppNotification[] = [
  { id: 'n1', category: 'health', title: 'Coolant temperature high', body: 'Engine ran hot on your last drive.', createdAt: '2026-07-14T10:00:00Z', read: false },
  { id: 'n2', category: 'billing', title: 'Receipt for Plus plan', body: 'Your monthly charge went through.', createdAt: '2026-07-10T10:00:00Z', read: true },
];

const PREFS: SmsPrefs = { health: true, maintenance: true, billing: false, aura: false };

describe('NotificationsComponent', () => {
  let fixture: ComponentFixture<NotificationsComponent>;
  let component: NotificationsComponent;
  let inbox: InboxService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    clearAppStorage();
    TestBed.configureTestingModule({
      imports: [NotificationsComponent],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    });
    fixture = TestBed.createComponent(NotificationsComponent);
    component = fixture.componentInstance;
    inbox = TestBed.inject(InboxService);
    httpMock = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
  });

  afterEach(() => {
    httpMock.verify();
    clearAppStorage();
  });

  // Drive DB-backed notifications + prefs into the service the way sign-in does.
  function loadInbox(): void {
    inbox.load();
    httpMock.expectOne(`${API}/api/account/notifications`).flush({ notifications: NOTIFS });
    httpMock.expectOne(`${API}/api/account/notifications/sms-prefs`).flush({ smsPrefs: PREFS });
    fixture.detectChanges();
  }

  it('shows no unread count when the inbox is empty', () => {
    // Before load() there are no notifications, so the count pill is absent.
    const count = fixture.nativeElement.querySelector('.notif-rail-count');
    expect(count).toBeNull();
    expect(inbox.unreadCount()).toBe(0);
  });

  it('shows the unread count on the right-edge tab', () => {
    loadInbox();
    const count = fixture.nativeElement.querySelector('.notif-rail-count');
    expect(inbox.unreadCount()).toBe(1);
    expect(count?.textContent?.trim()).toBe(String(inbox.unreadCount()));
  });

  it('toggle opens and closes the pane', () => {
    component.toggle();
    expect(component.open()).toBeTrue();
    component.toggle();
    expect(component.open()).toBeFalse();
  });

  it('the unread tab filters to unread items only', () => {
    loadInbox();
    component.setTab('unread');
    expect(component.items().every(n => !n.read)).toBeTrue();
    expect(component.items().length).toBe(1);
  });

  it('search filters by title/body text', () => {
    loadInbox();
    const target = inbox.notifications()[0];
    component.query.set(target.title.slice(0, 8));
    expect(component.items().some(n => n.id === target.id)).toBeTrue();
    component.query.set('zzz-no-match-zzz');
    expect(component.items().length).toBe(0);
  });

  it('markAllRead clears the unread state through the service', () => {
    loadInbox();
    component.markAllRead();
    // Optimistic local update; the POST is fired and flushed.
    httpMock.expectOne(`${API}/api/account/notifications/read-all`).flush(null);
    expect(inbox.unreadCount()).toBe(0);
  });

  it('isPro reflects the tier for SMS preferences', () => {
    const tier = TestBed.inject(TierService);
    tier.set('free');
    expect(component.isPro()).toBeFalse();
    tier.set('pro');
    expect(component.isPro()).toBeTrue();
  });

  it('Escape closes an open pane', () => {
    component.open.set(true);
    component.onEsc();
    expect(component.open()).toBeFalse();
  });
});
