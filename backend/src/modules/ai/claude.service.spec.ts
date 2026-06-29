import { ConfigService } from '@nestjs/config';
import { ClaudeService, type ProposedAction } from './claude.service';

function makeService(key = 'test-key'): ClaudeService {
  const config = {
    get: (k: string) => (k === 'anthropic.apiKey' ? key : undefined),
  } as unknown as ConfigService;
  return new ClaudeService(config);
}

/** Build a fetch mock that returns the given JSON bodies in sequence. */
function mockFetchSequence(bodies: unknown[]) {
  let i = 0;
  return jest.fn(async () => {
    const body = bodies[Math.min(i, bodies.length - 1)];
    i++;
    return {
      ok: true,
      status: 200,
      json: async () => body,
      text: async () => JSON.stringify(body),
    } as unknown as Response;
  });
}

describe('ClaudeService.messageWithTools', () => {
  const realFetch = global.fetch;
  afterEach(() => {
    global.fetch = realFetch;
    jest.restoreAllMocks();
  });

  it('returns null when no API key is configured', async () => {
    const svc = makeService('');
    const out = await svc.messageWithTools({
      messages: [{ role: 'user', content: 'hi' }],
      tools: [],
      onToolCall: async () => ({ result: null }),
    });
    expect(out).toBeNull();
  });

  it('dispatches a read tool, feeds the result back, and returns final text', async () => {
    const svc = makeService();
    global.fetch = mockFetchSequence([
      // turn 1: model asks for a tool
      {
        stop_reason: 'tool_use',
        content: [
          { type: 'text', text: 'Let me check.' },
          { type: 'tool_use', id: 'tu_1', name: 'list_flights', input: { status: 'active' } },
        ],
      },
      // turn 2: model produces the final answer
      {
        stop_reason: 'end_turn',
        content: [{ type: 'text', text: 'There are 2 active flights.' }],
      },
    ]) as unknown as typeof fetch;

    const calls: Array<{ name: string; input: unknown }> = [];
    const out = await svc.messageWithTools({
      messages: [{ role: 'user', content: 'how many active flights?' }],
      tools: [{ name: 'list_flights', description: 'd', input_schema: { type: 'object' } }],
      onToolCall: async (name, input) => {
        calls.push({ name, input });
        return { result: [{ id: 'a' }, { id: 'b' }] };
      },
    });

    expect(out).not.toBeNull();
    expect(out!.text).toBe('There are 2 active flights.');
    expect(calls).toEqual([{ name: 'list_flights', input: { status: 'active' } }]);
    expect(out!.toolTrace).toEqual([
      { tool: 'list_flights', input: { status: 'active' }, kind: 'read', ok: true },
    ]);
    expect(out!.proposedActions).toHaveLength(0);
  });

  it('collects an action proposal without executing it', async () => {
    const svc = makeService();
    global.fetch = mockFetchSequence([
      {
        stop_reason: 'tool_use',
        content: [
          { type: 'tool_use', id: 'tu_1', name: 'propose_authorize_flight', input: { flightId: 'f1' } },
        ],
      },
      { stop_reason: 'end_turn', content: [{ type: 'text', text: 'Proposed authorization for f1.' }] },
    ]) as unknown as typeof fetch;

    const proposal: ProposedAction = {
      kind: 'authorize_flight',
      label: 'Authorize flight f1',
      method: 'POST',
      path: '/flights/f1/authorize',
      rationale: 'weather GO, no conflicts',
    };

    const out = await svc.messageWithTools({
      messages: [{ role: 'user', content: 'authorize f1' }],
      tools: [{ name: 'propose_authorize_flight', description: 'd', input_schema: { type: 'object' } }],
      onToolCall: async () => ({ proposal }),
    });

    expect(out!.proposedActions).toEqual([proposal]);
    expect(out!.toolTrace[0]).toMatchObject({ tool: 'propose_authorize_flight', kind: 'action', ok: true });
    expect(out!.text).toContain('Proposed authorization');
  });

  it('stops at maxIterations if the model never stops calling tools', async () => {
    const svc = makeService();
    // Always return a tool_use → forces the loop to hit the cap.
    global.fetch = mockFetchSequence([
      {
        stop_reason: 'tool_use',
        content: [{ type: 'tool_use', id: 'tu_x', name: 'list_flights', input: {} }],
      },
    ]) as unknown as typeof fetch;

    let dispatches = 0;
    const out = await svc.messageWithTools({
      messages: [{ role: 'user', content: 'loop' }],
      tools: [{ name: 'list_flights', description: 'd', input_schema: { type: 'object' } }],
      maxIterations: 3,
      onToolCall: async () => {
        dispatches++;
        return { result: [] };
      },
    });

    expect(dispatches).toBe(3);
    expect(out!.toolTrace).toHaveLength(3);
    expect(out!.text).toContain('step limit');
  });
});
