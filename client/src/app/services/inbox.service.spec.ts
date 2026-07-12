import { TestBed } from '@angular/core/testing';
import { InboxService } from './inbox.service';
import { clearAppStorage } from '../../testing/test-utils';

describe('InboxService', () => {
  let service: InboxService;

  beforeEach(() => {
    clearAppStorage();
    TestBed.configureTestingModule({});
    service = TestBed.inject(InboxService);
  });

  afterEach(() => clearAppStorage());

  it('seeds notifications and counts unread ones', () => {
    const all = service.notifications();
    expect(all.length).toBeGreaterThan(0);
    expect(service.unreadCount()).toBe(all.filter(n => !n.read).length);
  });

  it('markRead marks only the target notification', () => {
    const firstUnread = service.notifications().find(n => !n.read)!;
    const before = service.unreadCount();
    service.markRead(firstUnread.id);
    expect(service.unreadCount()).toBe(before - 1);
    expect(service.notifications().find(n => n.id === firstUnread.id)!.read).toBeTrue();
  });

  it('markAllRead zeroes the unread count', () => {
    service.markAllRead();
    expect(service.unreadCount()).toBe(0);
  });

  it('persists SMS prefs and merges with defaults on load', () => {
    service.setSmsPref('billing', true);
    expect(JSON.parse(localStorage.getItem('auralink-sms-prefs')!)).toEqual(
      jasmine.objectContaining({ billing: true }),
    );
  });

  it('falls back to default prefs when localStorage is corrupted', () => {
    localStorage.setItem('auralink-sms-prefs', '{broken');
    const fresh = new InboxService();
    expect(fresh.smsPrefs()).toEqual({ health: true, maintenance: true, billing: false, aura: false });
  });
});
