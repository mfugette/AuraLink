import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { ToastService } from './toast.service';

describe('ToastService', () => {
  let service: ToastService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(ToastService);
  });

  it('shows a toast and returns its id', () => {
    const id = service.show('hello');
    expect(service.toasts().length).toBe(1);
    expect(service.toasts()[0]).toEqual(jasmine.objectContaining({ id, text: 'hello', kind: 'info' }));
  });

  it('maps convenience methods to the right kind', () => {
    service.success('ok');
    service.error('bad');
    service.info('fyi');
    expect(service.toasts().map(t => t.kind)).toEqual(['success', 'error', 'info']);
  });

  it('auto-dismisses after the duration', fakeAsync(() => {
    service.show('short-lived', 'info', 1000);
    expect(service.toasts().length).toBe(1);
    tick(999);
    expect(service.toasts().length).toBe(1);
    tick(1);
    expect(service.toasts().length).toBe(0);
  }));

  it('never auto-dismisses when duration is 0', fakeAsync(() => {
    service.show('sticky', 'info', 0);
    tick(60_000);
    expect(service.toasts().length).toBe(1);
  }));

  it('dismiss removes only the target toast', () => {
    const a = service.show('a', 'info', 0);
    service.show('b', 'info', 0);
    service.dismiss(a);
    expect(service.toasts().map(t => t.text)).toEqual(['b']);
  });

  it('clear empties the list', () => {
    service.show('a', 'info', 0);
    service.show('b', 'info', 0);
    service.clear();
    expect(service.toasts()).toEqual([]);
  });
});
