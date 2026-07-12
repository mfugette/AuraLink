import { TestBed, ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { NotificationsComponent } from './notifications.component';
import { InboxService } from '../../services/inbox.service';
import { TierService } from '../../services/tier.service';
import { clearAppStorage } from '../../../testing/test-utils';

describe('NotificationsComponent', () => {
  let fixture: ComponentFixture<NotificationsComponent>;
  let component: NotificationsComponent;
  let inbox: InboxService;

  beforeEach(() => {
    clearAppStorage();
    TestBed.configureTestingModule({
      imports: [NotificationsComponent],
      providers: [provideRouter([])],
    });
    fixture = TestBed.createComponent(NotificationsComponent);
    component = fixture.componentInstance;
    inbox = TestBed.inject(InboxService);
    fixture.detectChanges();
  });

  afterEach(() => clearAppStorage());

  it('shows the unread badge count on the bell', () => {
    const badge = fixture.nativeElement.querySelector('.notif-badge');
    expect(badge?.textContent?.trim()).toBe(String(inbox.unreadCount()));
  });

  it('toggle opens and closes the pane', () => {
    component.toggle();
    expect(component.open()).toBeTrue();
    component.toggle();
    expect(component.open()).toBeFalse();
  });

  it('the unread tab filters to unread items only', () => {
    component.setTab('unread');
    expect(component.items().every(n => !n.read)).toBeTrue();
  });

  it('search filters by title/body text', () => {
    const target = inbox.notifications()[0];
    component.query.set(target.title.slice(0, 8));
    expect(component.items().some(n => n.id === target.id)).toBeTrue();
    component.query.set('zzz-no-match-zzz');
    expect(component.items().length).toBe(0);
  });

  it('markAllRead clears the unread state through the service', () => {
    component.markAllRead();
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
