import { TestBed, ComponentFixture } from '@angular/core/testing';
import { DashboardPageComponent } from './dashboard-page.component';
import { TelemetryService } from '../../services/telemetry.service';

describe('DashboardPageComponent', () => {
  let fixture: ComponentFixture<DashboardPageComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [DashboardPageComponent] });
    fixture = TestBed.createComponent(DashboardPageComponent);
  });

  afterEach(() => TestBed.inject(TelemetryService).stop());

  it('creates and renders a cell per telemetry metric', () => {
    fixture.detectChanges();
    const telemetry = TestBed.inject(TelemetryService);
    const el: HTMLElement = fixture.nativeElement;
    // Every metric should surface somewhere in the console grid.
    for (const def of telemetry.metrics) {
      expect(el.textContent).withContext(def.label).toContain(def.label);
    }
  });
});
