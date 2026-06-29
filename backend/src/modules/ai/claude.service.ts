import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/** An Anthropic tool definition (function-calling). */
export interface AnthropicTool {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
}

/** One entry in the agent's tool-call trace (for UI transparency). */
export interface ToolTraceEntry {
  tool: string;
  input: Record<string, unknown>;
  kind: 'read' | 'action';
  ok: boolean;
}

/** A confirm-gated action the agent proposes but does NOT execute. */
export interface ProposedAction {
  kind: string;
  label: string;
  method: 'POST' | 'PUT' | 'PATCH';
  path: string;
  body?: Record<string, unknown>;
  rationale: string;
}

/** Result of dispatching a single tool call. */
export type ToolDispatchResult =
  | { result: unknown }
  | { proposal: ProposedAction };

interface AnthropicContentBlock {
  type: string;
  text?: string;
  id?: string;
  name?: string;
  input?: Record<string, unknown>;
}

/**
 * Thin Claude (Anthropic Messages API) client using native fetch — matching the
 * codebase's external-API pattern (no SDK dependency). Structured-output helper
 * uses output_config.format with a JSON schema so the model returns schema-valid
 * JSON. API key is read from config (ANTHROPIC_API_KEY) and stays server-side.
 */
@Injectable()
export class ClaudeService {
  private readonly logger = new Logger(ClaudeService.name);
  private readonly ENDPOINT = 'https://api.anthropic.com/v1/messages';

  // Model tiers — default to the most capable for safety-critical reasoning.
  static readonly OPUS = 'claude-opus-4-8';
  static readonly SONNET = 'claude-sonnet-4-6';
  static readonly HAIKU = 'claude-haiku-4-5';

  constructor(private readonly config: ConfigService) {}

  private get apiKey(): string {
    return this.config.get<string>('anthropic.apiKey') || '';
  }

  hasKey(): boolean {
    return !!this.apiKey;
  }

  /**
   * Send a single message and parse the response into JSON validated against
   * `schema`. Returns null if no key is configured or the call/parse fails.
   */
  async messageJson<T>(opts: {
    system?: string;
    user: string;
    schema: Record<string, unknown>;
    model?: string;
    maxTokens?: number;
  }): Promise<T | null> {
    if (!this.apiKey) return null;
    try {
      const res = await fetch(this.ENDPOINT, {
        method: 'POST',
        headers: {
          'x-api-key': this.apiKey,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          model: opts.model || ClaudeService.OPUS,
          max_tokens: opts.maxTokens || 2048,
          system: opts.system,
          messages: [{ role: 'user', content: opts.user }],
          output_config: { format: { type: 'json_schema', schema: opts.schema } },
        }),
        // Generous timeout: structured-output schemas incur a one-time
        // server-side compilation cost on first use.
        signal: AbortSignal.timeout(90000),
      });
      if (!res.ok) {
        const body = await res.text();
        this.logger.warn(`Claude API ${res.status}: ${body.slice(0, 300)}`);
        return null;
      }
      const data = (await res.json()) as {
        stop_reason?: string;
        content?: Array<{ type: string; text?: string }>;
      };
      if (data.stop_reason === 'refusal') {
        this.logger.warn('Claude refused the request');
        return null;
      }
      const text = (data.content || [])
        .filter((b) => b.type === 'text' && b.text)
        .map((b) => b.text)
        .join('');
      if (!text) return null;
      return JSON.parse(text) as T;
    } catch (e) {
      this.logger.warn(`Claude call failed: ${(e as Error).message}`);
      return null;
    }
  }

  /**
   * Run a tool-use (function-calling) loop. The model requests tool calls; each is
   * dispatched via `onToolCall`. Read tools return `{ result }` (fed back as a
   * tool_result); action tools return `{ proposal }` (collected, NOT executed —
   * acknowledged so the model can finish its turn). Loops until the model stops
   * requesting tools or `maxIterations` is hit. Returns the final text plus a tool
   * trace and the list of proposed actions. Returns null if no key is configured.
   */
  async messageWithTools(opts: {
    system?: string;
    messages: Array<{ role: 'user' | 'assistant'; content: unknown }>;
    tools: AnthropicTool[];
    model?: string;
    maxTokens?: number;
    maxIterations?: number;
    onToolCall: (
      name: string,
      input: Record<string, unknown>,
    ) => Promise<ToolDispatchResult>;
  }): Promise<{
    text: string;
    toolTrace: ToolTraceEntry[];
    proposedActions: ProposedAction[];
  } | null> {
    if (!this.apiKey) return null;

    const messages = [...opts.messages];
    const toolTrace: ToolTraceEntry[] = [];
    const proposedActions: ProposedAction[] = [];
    const maxIterations = opts.maxIterations ?? 6;

    try {
      for (let i = 0; i < maxIterations; i++) {
        const res = await fetch(this.ENDPOINT, {
          method: 'POST',
          headers: {
            'x-api-key': this.apiKey,
            'anthropic-version': '2023-06-01',
            'content-type': 'application/json',
          },
          body: JSON.stringify({
            model: opts.model || ClaudeService.SONNET,
            max_tokens: opts.maxTokens || 2048,
            system: opts.system,
            messages,
            tools: opts.tools,
          }),
          signal: AbortSignal.timeout(90000),
        });
        if (!res.ok) {
          const body = await res.text();
          this.logger.warn(`Claude tools API ${res.status}: ${body.slice(0, 300)}`);
          return null;
        }
        const data = (await res.json()) as {
          stop_reason?: string;
          content?: AnthropicContentBlock[];
        };
        const content = data.content || [];

        // Collect the model's text for this turn.
        const turnText = content
          .filter((b) => b.type === 'text' && b.text)
          .map((b) => b.text)
          .join('');

        const toolUses = content.filter((b) => b.type === 'tool_use');
        if (data.stop_reason !== 'tool_use' || toolUses.length === 0) {
          return { text: turnText, toolTrace, proposedActions };
        }

        // Echo the assistant turn (text + tool_use blocks) back into the history.
        messages.push({ role: 'assistant', content });

        // Dispatch each requested tool and build the tool_result blocks.
        const toolResults: Array<{
          type: 'tool_result';
          tool_use_id: string;
          content: string;
          is_error?: boolean;
        }> = [];
        for (const tu of toolUses) {
          const name = tu.name || '';
          const input = tu.input || {};
          try {
            const out = await opts.onToolCall(name, input);
            if ('proposal' in out) {
              proposedActions.push(out.proposal);
              toolTrace.push({ tool: name, input, kind: 'action', ok: true });
              toolResults.push({
                type: 'tool_result',
                tool_use_id: tu.id!,
                content:
                  'Proposed action recorded; it is shown to the operator for confirmation. Do not assume it has executed.',
              });
            } else {
              toolTrace.push({ tool: name, input, kind: 'read', ok: true });
              toolResults.push({
                type: 'tool_result',
                tool_use_id: tu.id!,
                content: JSON.stringify(out.result ?? null),
              });
            }
          } catch (e) {
            toolTrace.push({ tool: name, input, kind: 'read', ok: false });
            toolResults.push({
              type: 'tool_result',
              tool_use_id: tu.id!,
              content: `Tool error: ${(e as Error).message}`,
              is_error: true,
            });
          }
        }

        messages.push({ role: 'user', content: toolResults });
      }

      // Hit the iteration cap without a final answer.
      this.logger.warn(`Claude tool loop hit maxIterations (${maxIterations})`);
      return {
        text: 'I gathered data but could not finalize an answer within the step limit. Please narrow the question.',
        toolTrace,
        proposedActions,
      };
    } catch (e) {
      this.logger.warn(`Claude tool loop failed: ${(e as Error).message}`);
      return null;
    }
  }
}
