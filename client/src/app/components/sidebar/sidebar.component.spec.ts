import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { SidebarComponent } from './sidebar.component';
import { TierService } from '../../services/tier.service';
import { clearAppStorage } from '../../../testing/test-utils';

describe('SidebarComponent', () => {
  beforeEach(() => {
    clearAppStorage();
    TestBed.configureTestingModule({
      imports: [SidebarComponent],
      providers: [provideRouter([])],
    });
  });

  afterEach(() => clearAppStorage());

  function render(collapsed = false) {
    const fixture = TestBed.createComponent(SidebarComponent);
    fixture.componentInstance.collapsed = collapsed;
    fixture.detectChanges();
    return fixture;
  }

  it('renders every nav item with an icon and label', () => {
    const fixture = render();
    const items = fixture.nativeElement.querySelectorAll('.nav-item');
    expect(items.length).toBe(fixture.componentInstance.items.length);
    for (const item of items) {
      const icon = item.querySelector('mat-icon');
      expect(icon).withContext('nav item must have an icon').toBeTruthy();
      expect(icon.textContent.trim()).withContext('icon must name a glyph').toBeTruthy();
    }
  });

  it('shows a lock hint on tier-gated items the tier lacks', () => {
    TestBed.inject(TierService).set('free');
    const fixture = render();
    const gated = fixture.componentInstance.items.filter(i => fixture.componentInstance['locked'](i));
    const locks = fixture.nativeElement.querySelectorAll('.nav-lock');
    expect(locks.length).toBe(gated.length);
  });

  it('pro tier unlocks all nav items (no locks shown)', () => {
    TestBed.inject(TierService).set('pro');
    const fixture = render();
    expect(fixture.nativeElement.querySelectorAll('.nav-lock').length).toBe(0);
  });

  it('emits navigate when a nav item is clicked', () => {
    const fixture = render();
    let navigated = false;
    fixture.componentInstance.navigate.subscribe(() => (navigated = true));
    fixture.nativeElement.querySelector('.nav-item').click();
    expect(navigated).toBeTrue();
  });

  it('emits toggle from the collapse control', () => {
    const fixture = render();
    let toggled = false;
    fixture.componentInstance.toggle.subscribe(() => (toggled = true));
    fixture.nativeElement.querySelector('.sidebar-toggle').click();
    expect(toggled).toBeTrue();
  });

  it('hides labels when collapsed', () => {
    const fixture = render(true);
    expect(fixture.nativeElement.querySelector('nav').classList).toContain('collapsed');
  });
});
