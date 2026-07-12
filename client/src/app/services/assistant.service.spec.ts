import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { AssistantService } from './assistant.service';
import { TierService } from './tier.service';
import { provideMockAuth, clearAppStorage } from '../../testing/test-utils';

function streamOf(...chunks: string[]): ReadableStream<Uint8Array> {
  const enc = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      for (const c of chunks) controller.enqueue(enc.encode(c));
      controller.close();
    },
  });
}

describe('AssistantService', () => {
  let service: AssistantService;
  let tier: TierService;

  beforeEach(() => {
    clearAppStorage();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), provideMockAuth()],
    });
    service = TestBed.inject(AssistantService);
    tier = TestBed.inject(TierService);
  });

  afterEach(() => clearAppStorage());

  it('queue/takePending hands a query over exactly once', () => {
    service.queue('  check engine light  ');
    expect(service.takePending()).toBe('check engine light');
    expect(service.takePending()).toBeNull();
  });

  it('queueing a blank query stores nothing', () => {
    service.queue('   ');
    expect(service.takePending()).toBeNull();
  });

  it('reset clears the conversation', () => {
    service.messages.set([{ role: 'user', text: 'hi' }]);
    service.thinking.set(true);
    service.reset();
    expect(service.messages()).toEqual([]);
    expect(service.thinking()).toBeFalse();
  });

  it('ignores empty input and re-entrant sends', async () => {
    const fetchSpy = spyOn(window, 'fetch');
    await service.send('   ');
    service.thinking.set(true);
    await service.send('real question');
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('refuses to send once the daily quota is exhausted', async () => {
    spyOn(tier, 'aiMessagesRemaining').and.returnValue(0);
    const fetchSpy = spyOn(window, 'fetch');
    await service.send('hello');
    expect(fetchSpy).not.toHaveBeenCalled();
    const msgs = service.messages();
    expect(msgs.length).toBe(2);
    expect(msgs[1].role).toBe('assistant');
    expect(msgs[1].text).toContain('daily Aura message limit');
  });

  it('streams the assistant reply into the last message', async () => {
    spyOn(window, 'fetch').and.resolveTo({
      ok: true,
      body: streamOf('Hello ', 'world'),
    } as unknown as Response);

    await service.send('hi aura');

    const msgs = service.messages();
    expect(msgs.map(m => m.role)).toEqual(['user', 'assistant']);
    expect(msgs[1].text).toBe('Hello world');
    expect(service.thinking()).toBeFalse();
  });

  it('sends the bearer token and full history to the chat endpoint', async () => {
    const fetchSpy = spyOn(window, 'fetch').and.resolveTo({
      ok: true, body: streamOf('ok'),
    } as unknown as Response);

    await service.send('question');

    const [url, init] = fetchSpy.calls.mostRecent().args as [string, RequestInit];
    expect(url).toContain('/api/assistant/chat');
    expect((init.headers as Record<string, string>)['Authorization']).toBe('Bearer test-jwt');
    const body = JSON.parse(init.body as string);
    expect(body.messages).toEqual([{ role: 'user', text: 'question' }]);
  });

  it('surfaces a server-provided error message on a non-OK response', async () => {
    spyOn(window, 'fetch').and.resolveTo({
      ok: false,
      json: () => Promise.resolve({ error: 'Aura is unavailable right now.' }),
    } as unknown as Response);

    await service.send('hi');
    expect(service.messages()[1].text).toBe('Aura is unavailable right now.');
    expect(service.thinking()).toBeFalse();
  });

  it('falls back to a generic message when fetch throws', async () => {
    spyOn(window, 'fetch').and.rejectWith(new Error('network down'));
    spyOn(console, 'error'); // keep the log quiet
    await service.send('hi');
    expect(service.messages()[1].text).toContain('ran into a problem');
    expect(service.thinking()).toBeFalse();
  });

  it('truncates input to maxInputChars', async () => {
    const fetchSpy = spyOn(window, 'fetch').and.resolveTo({
      ok: true, body: streamOf('ok'),
    } as unknown as Response);

    await service.send('x'.repeat(service.maxInputChars + 500));
    const body = JSON.parse((fetchSpy.calls.mostRecent().args[1] as RequestInit).body as string);
    expect(body.messages[0].text.length).toBe(service.maxInputChars);
  });
});
