import { TestBed, ComponentFixture } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { AssistantPageComponent } from './assistant-page.component';
import { AssistantService } from '../../services/assistant.service';
import { AccountService } from '../../services/account.service';
import { provideMockAuth, clearAppStorage } from '../../../testing/test-utils';

describe('AssistantPageComponent', () => {
  let fixture: ComponentFixture<AssistantPageComponent>;
  let component: AssistantPageComponent;
  let assistant: AssistantService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    clearAppStorage();
    TestBed.configureTestingModule({
      imports: [AssistantPageComponent],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideMockAuth()],
    });
    assistant = TestBed.inject(AssistantService);
    httpMock = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(AssistantPageComponent);
    component = fixture.componentInstance;
  });

  afterEach(() => {
    httpMock.match(() => true);
    clearAppStorage();
  });

  it('renders the terminal shell with boot banner before any messages', () => {
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('.term-figlet')).toBeTruthy();
    expect(el.querySelector('.term-input')).toBeTruthy();
  });

  it('builds the shell prompt from the account display name', () => {
    TestBed.inject(AccountService).account.set({ id: 'u1', email: 'x@y.z', displayName: 'Max Fugette', createdAt: '' });
    expect(component.promptPath()).toBe('max@auralink.vin:~/aura');
  });

  it('send() delegates to the assistant service and clears the input', () => {
    const send = spyOn(assistant, 'send').and.resolveTo();
    component.input.set('what is P0420');
    component.send();
    expect(send).toHaveBeenCalledWith('what is P0420');
    expect(component.input()).toBe('');
  });

  it('send() ignores empty input', () => {
    const send = spyOn(assistant, 'send');
    component.input.set('   ');
    component.send();
    expect(send).not.toHaveBeenCalled();
  });

  it('newChat() resets the session', () => {
    const reset = spyOn(assistant, 'reset');
    component.newChat();
    expect(reset).toHaveBeenCalled();
  });

  it('a queued top-bar query is consumed and sent on init', () => {
    const send = spyOn(assistant, 'send').and.resolveTo();
    assistant.queue('why is my car shaking');
    fixture.detectChanges(); // ngOnInit/effect consumes the pending query
    expect(send).toHaveBeenCalledWith('why is my car shaking');
  });

  it('escapes model HTML in the transcript (XSS)', () => {
    assistant.messages.set([
      { role: 'user', text: 'hi' },
      { role: 'assistant', text: '<img src=x onerror="window.__pwned=1"> **safe**' },
    ]);
    fixture.detectChanges();
    const out: HTMLElement = fixture.nativeElement.querySelector('.term-out');
    expect(out.querySelector('img')).toBeNull();
    expect(out.textContent).toContain('<img');
    expect(out.querySelector('strong.term-strong')?.textContent).toBe('safe');
    expect((window as unknown as Record<string, unknown>)['__pwned']).toBeUndefined();
  });
});
