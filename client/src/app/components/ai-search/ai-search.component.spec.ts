import { TestBed, ComponentFixture } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { AiSearchComponent } from './ai-search.component';
import { AssistantService } from '../../services/assistant.service';
import { provideMockAuth, clearAppStorage } from '../../../testing/test-utils';

describe('AiSearchComponent', () => {
  let fixture: ComponentFixture<AiSearchComponent>;
  let component: AiSearchComponent;
  let router: Router;
  let assistant: AssistantService;

  beforeEach(() => {
    clearAppStorage();
    TestBed.configureTestingModule({
      imports: [AiSearchComponent],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting(), provideMockAuth()],
    });
    fixture = TestBed.createComponent(AiSearchComponent);
    component = fixture.componentInstance;
    router = TestBed.inject(Router);
    assistant = TestBed.inject(AssistantService);
    spyOn(router, 'navigate').and.resolveTo(true);
    fixture.detectChanges();
  });

  afterEach(() => {
    clearAppStorage();
    document.documentElement.style.overflow = '';
  });

  it('renders the terminal-style trigger with the aura$ prompt', () => {
    const trigger = fixture.nativeElement.querySelector('.ai-trigger');
    expect(trigger.textContent).toContain('aura');
    expect(trigger.querySelector('.ai-trigger-caret').textContent).toBe('$');
  });

  it('activate() opens the overlay on desktop widths', () => {
    if (window.innerWidth <= 520) {
      pending('viewport too narrow for the overlay path');
      return;
    }
    component.activate();
    expect(component.active()).toBeTrue();
    expect(document.documentElement.style.overflow).toBe('hidden');
  });

  it('close() releases the page scroll lock', () => {
    component.active.set(true);
    document.documentElement.style.overflow = 'hidden';
    component.close();
    expect(component.active()).toBeFalse();
    expect(document.documentElement.style.overflow).toBe('');
  });

  it('send() queues the query and hands off to /assistant', () => {
    const queue = spyOn(assistant, 'queue');
    component.active.set(true);
    component.input = 'why is my check engine light on';
    component.send();
    expect(queue).toHaveBeenCalledWith('why is my check engine light on');
    expect(router.navigate).toHaveBeenCalledWith(['/assistant']);
    expect(component.active()).toBeFalse();
    expect(component.input).toBe('');
  });

  it('ignores empty submissions', () => {
    const queue = spyOn(assistant, 'queue');
    component.input = '   ';
    component.send();
    expect(queue).not.toHaveBeenCalled();
    expect(router.navigate).not.toHaveBeenCalled();
  });

  it('suggestion chips submit their text', () => {
    const queue = spyOn(assistant, 'queue');
    component.useSuggestion('My car won’t start');
    expect(queue).toHaveBeenCalledWith('My car won’t start');
    expect(router.navigate).toHaveBeenCalledWith(['/assistant']);
  });
});
