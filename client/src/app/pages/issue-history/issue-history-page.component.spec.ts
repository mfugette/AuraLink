import { TestBed, ComponentFixture } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { IssueHistoryPageComponent } from './issue-history-page.component';
import { ISSUE_HISTORY } from '../../data/issue-history';

describe('IssueHistoryPageComponent', () => {
  let fixture: ComponentFixture<IssueHistoryPageComponent>;
  let component: IssueHistoryPageComponent;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [IssueHistoryPageComponent],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    fixture = TestBed.createComponent(IssueHistoryPageComponent);
    component = fixture.componentInstance;
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.match(() => true));

  it('lists all seeded issues newest first by default', () => {
    const rows = component.filtered();
    expect(rows.length).toBe(ISSUE_HISTORY.length);
    for (let i = 1; i < rows.length; i++) {
      expect(rows[i - 1].date >= rows[i].date).toBeTrue();
    }
  });

  it('search matches code, title, and notes', () => {
    const target = ISSUE_HISTORY[0];
    component.query.set(target.code.toLowerCase());
    expect(component.filtered().some(i => i.id === target.id)).toBeTrue();
    component.query.set('zz-no-match');
    expect(component.filtered().length).toBe(0);
  });

  it('resolved/open counts follow the filter', () => {
    expect(component.resolvedCount() + component.openCount()).toBe(component.filtered().length);
  });

  it('sorting by severity orders by rank', () => {
    component.sortBy('severity');
    const rank: Record<string, number> = { low: 0, moderate: 1, high: 2, critical: 3 };
    const vals = component.filtered().map(i => rank[i.severity]);
    expect([...vals].sort((a, b) => a - b)).toEqual(vals);
  });

  it('status helpers map to chip classes and labels', () => {
    expect(component.statusChip('resolved')).toBe('ok');
    expect(component.statusChip('open')).toBe('warn');
    expect(component.statusChip('in-progress')).toBe('progress');
    expect(component.statusLabel('in-progress')).toBe('In Progress');
  });

  it('detail dialog opens and closes', () => {
    component.openDetail(ISSUE_HISTORY[0]);
    expect(component.detail()).toBe(ISSUE_HISTORY[0]);
    component.closeDetail();
    expect(component.detail()).toBeNull();
  });
});
