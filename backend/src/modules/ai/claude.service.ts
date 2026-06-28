import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

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
}
