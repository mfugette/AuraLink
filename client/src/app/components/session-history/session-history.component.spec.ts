import { TestBed, ComponentFixture } from '@angular/core/testing';
import { SessionHistoryComponent } from './session-history.component';
import { SessionService } from '../../services/session.service';

describe('SessionHistoryComponent', () => {
  let fixture: ComponentFixture<SessionHistoryComponent>;
  let component: SessionHistoryComponent;
  let sessions: SessionService;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [SessionHistoryComponent] });
    fixture = TestBed.createComponent(SessionHistoryComponent);
    component = fixture.componentInstance;
    sessions = TestBed.inject(SessionService);
  });

  it('shows all sessions by default, newest first', () => {
    const visible = component.visible();
    expect(visible.length).toBe(sessions.sessions().length);
    for (let i = 1; i < visible.length; i++) {
      expect(new Date(visible[i - 1].startedAt).getTime())
        .toBeGreaterThanOrEqual(new Date(visible[i].startedAt).getTime());
    }
  });

  it('warnings-only filter keeps only flagged drives', () => {
    component.toggleWarn();
    expect(component.visible().every(s => !!s.warnLabel)).toBeTrue();
  });

  it('vehicle filter narrows to one vehicle', () => {
    const target = sessions.sessions()[0].vehicleId;
    component.vehicleFilter.set(target);
    expect(component.visible().every(s => s.vehicleId === target)).toBeTrue();
  });

  it('search matches on the vehicle label', () => {
    const label = sessions.sessions()[0].vehicleLabel;
    component.query.set(label.toLowerCase());
    expect(component.visible().length).toBeGreaterThan(0);
    expect(component.visible().every(s => s.vehicleLabel === label)).toBeTrue();
  });

  it('sortBy toggles direction on repeat, resets on new key', () => {
    component.sortBy('distance');
    expect(component.sortKey()).toBe('distance');
    expect(component.sortDir()).toBe(1);
    const asc = component.visible().map(s => s.distanceMi);
    expect([...asc].sort((a, b) => a - b)).toEqual(asc);

    component.sortBy('distance');
    const desc = component.visible().map(s => s.distanceMi);
    expect([...desc].sort((a, b) => b - a)).toEqual(desc);
  });

  it('arrow() reports the active sort indicator only', () => {
    component.sortBy('rpm');
    expect(component.arrow('rpm')).toBe('arrow_upward');
    expect(component.arrow('date')).toBe('');
  });

  it('drill-in builds one chart per vitals metric with data', () => {
    const s = sessions.sessions()[0];
    component.open(s);
    const charts = component.drillCharts();
    expect(charts.length).toBeGreaterThan(0);
    for (const c of charts) {
      expect(c.linePath.startsWith('M')).toBeTrue();
      expect(c.areaPath.endsWith('Z')).toBeTrue();
    }
    component.close();
    expect(component.openSession()).toBeNull();
  });

  it('summary tiles flag warning metrics', () => {
    const warnSession = sessions.sessions().find(s => s.summary.coolant?.warn);
    if (!warnSession) { pending('no warn session in mock'); return; }
    component.open(warnSession);
    const coolantTile = component.tiles().find(t => t.label === 'Peak coolant');
    expect(coolantTile?.warn).toBeTrue();
  });
});
