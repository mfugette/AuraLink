import { TestBed } from '@angular/core/testing';
import { ToastHostComponent } from './toast-host.component';
import { ToastService } from '../../services/toast.service';

describe('ToastHostComponent', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [ToastHostComponent] });
  });

  it('renders active toasts from the service', () => {
    const fixture = TestBed.createComponent(ToastHostComponent);
    const toast = TestBed.inject(ToastService);
    toast.show('saved!', 'success', 0);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('saved!');
  });

  it('tracks online/offline events on the window', () => {
    const fixture = TestBed.createComponent(ToastHostComponent);
    const toast = TestBed.inject(ToastService);
    fixture.detectChanges();

    window.dispatchEvent(new Event('offline'));
    expect(toast.offline()).toBeTrue();
    window.dispatchEvent(new Event('online'));
    expect(toast.offline()).toBeFalse();
  });

  it('maps toast kinds to status icons', () => {
    const fixture = TestBed.createComponent(ToastHostComponent);
    const c = fixture.componentInstance;
    expect(c.iconFor('success')).toBe('check_circle');
    expect(c.iconFor('error')).toBe('error');
    expect(c.iconFor('info')).toBe('info');
  });
});
