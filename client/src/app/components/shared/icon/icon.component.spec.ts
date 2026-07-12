import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { IconComponent } from './icon.component';
import { ICON_PATHS, resolveIcon } from './icon-registry';

@Component({
  standalone: true,
  imports: [IconComponent],
  template: `<app-icon [name]="name" [size]="size" />`,
})
class HostComponent {
  name = 'directions_car';
  size: number | null = null;
}

describe('IconComponent', () => {
  function render(name: string, size: number | null = null) {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.componentInstance.name = name;
    fixture.componentInstance.size = size;
    fixture.detectChanges();
    return fixture;
  }

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [HostComponent] });
  });

  it('renders the registered glyph as an inline SVG path', () => {
    const fixture = render('directions_car');
    const path = fixture.nativeElement.querySelector('svg path');
    expect(path).toBeTruthy();
    expect(path.getAttribute('d')).toBe(ICON_PATHS['directions_car']);
  });

  it('renders nothing (and warns) for an unknown name', () => {
    const warn = spyOn(console, 'warn');
    const fixture = render('definitely_not_an_icon');
    expect(fixture.nativeElement.querySelector('svg')).toBeNull();
    expect(warn).toHaveBeenCalledWith(jasmine.stringContaining('definitely_not_an_icon'));
  });

  it('applies an explicit pixel size via font-size', () => {
    const fixture = render('check', 32);
    const host: HTMLElement = fixture.nativeElement.querySelector('app-icon');
    expect(host.style.fontSize).toBe('32px');
  });

  it('inherits CSS sizing (1em SVG) when no size is given', () => {
    const fixture = render('check');
    const svg: SVGElement = fixture.nativeElement.querySelector('svg');
    expect(svg.getAttribute('viewBox')).toBe('0 0 24 24');
    expect(fixture.nativeElement.querySelector('app-icon').style.fontSize).toBe('');
  });

  it('is aria-hidden decoration', () => {
    const fixture = render('warning');
    expect(fixture.nativeElement.querySelector('svg').getAttribute('aria-hidden')).toBe('true');
  });
});

describe('icon registry', () => {
  it('resolveIcon returns null for unknown names', () => {
    expect(resolveIcon('nope_nope')).toBeNull();
  });

  it('every registered path is non-empty pixel data', () => {
    for (const [name, d] of Object.entries(ICON_PATHS)) {
      expect(d.length).withContext(name).toBeGreaterThan(10);
      expect(d.startsWith('M')).withContext(name).toBeTrue();
    }
  });

  // Guards the icon set against regressions: every icon name the app's
  // templates/TS reference must exist here. Keep in sync when adding icons —
  // this list is exactly the names used via <app-icon> across the app.
  it('covers every icon name the app uses', () => {
    const used = [
      // navigation / shell
      'dashboard', 'auto_awesome', 'directions_car', 'bar_chart_4_bars', 'search', 'near_me',
      'history', 'notifications', 'menu', 'bluetooth_drive', 'help_outline', 'dark_mode', 'light_mode',
      'chevron_left', 'chevron_right', 'lock',
      // actions
      'add', 'edit', 'close', 'cancel', 'clear_all', 'refresh', 'restart_alt', 'replay', 'autorenew',
      'send', 'download', 'tune', 'keyboard', 'bluetooth', 'expand_more', 'expand_less',
      'arrow_back', 'arrow_forward', 'arrow_upward', 'arrow_downward', 'arrow_outward', 'open_in_new',
      'content_copy', 'library_add', 'visibility', 'photo_camera', 'camera_off', 'qr_code_scanner',
      'filter_alt_off', 'delete_forever', 'delete_outline', 'delete_sweep', 'undo', 'upgrade',
      // telemetry / vehicle
      'speed', 'settings', 'battery_charging_full', 'battery_full', 'thermostat', 'thermostat_auto',
      'device_thermostat', 'donut_large', 'linear_scale', 'air', 'local_gas_station', 'ev_station',
      'route', 'show_chart', 'monitoring', 'build', 'construction', 'usb', 'my_location', 'map',
      'water_drop', 'oil_barrel', 'ac_unit', 'disc_full', 'memory',
      // status
      'check', 'check_circle', 'done_all', 'warning', 'report_problem', 'error', 'error_outline',
      'info', 'verified', 'verified_user', 'shield', 'star', 'star_outline', 'favorite',
      'search_off', 'cloud_off', 'progress_activity', 'schedule', 'remove_circle',
      // account / commerce / comms
      'person', 'manage_accounts', 'badge', 'login', 'logout', 'email', 'alternate_email',
      'call', 'phone', 'sms', 'credit_card', 'shopping_cart', 'shopping_cart_off', 'store',
      'local_offer', 'sell', 'local_shipping', 'inventory_2', 'receipt_long', 'article',
      'workspace_premium', 'rocket_launch', 'event_busy', 'image_not_supported', 'trip_origin',
      'home', 'checklist', 'fact_check', 'handshake', 'touch_app', 'lock_reset', 'vpn_key',
      'more_horiz', 'subscriptions',
    ];
    const missing = used.filter(n => resolveIcon(n) === null);
    expect(missing).withContext('icons referenced by the app but absent from the registry').toEqual([]);
  });
});
