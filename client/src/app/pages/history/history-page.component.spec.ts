import { TestBed, ComponentFixture } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { HistoryPageComponent } from './history-page.component';
import { clearAppStorage } from '../../../testing/test-utils';

describe('HistoryPageComponent', () => {
  let fixture: ComponentFixture<HistoryPageComponent>;
  let component: HistoryPageComponent;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    clearAppStorage();
    TestBed.configureTestingModule({
      imports: [HistoryPageComponent],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    fixture = TestBed.createComponent(HistoryPageComponent);
    component = fixture.componentInstance;
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.match(() => true);
    clearAppStorage();
  });

  it('defaults to the Drives tab', () => {
    fixture.detectChanges();
    expect(component.active()).toBe('drives');
    expect(fixture.nativeElement.querySelector('app-session-history')).toBeTruthy();
  });

  it('switching tabs swaps the embedded panel', () => {
    fixture.detectChanges();
    component.setTab('repairs');
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('app-repair-log')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('app-session-history')).toBeNull();
  });

  it('soon tabs render a coming-soon panel with copy', () => {
    fixture.detectChanges();
    component.setTab('chats');
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.hist-soon')).toBeTruthy();
    expect(component.soonMessage('chats').title).toContain('Aura chat');
    expect(component.soonMessage('vehicle').title).toContain('Vehicle report');
  });

  it('declares exactly the five history tabs', () => {
    expect(component.tabs.map(t => t.key)).toEqual(['drives', 'issues', 'repairs', 'chats', 'vehicle']);
  });
});
