export * from './types';
export * from './token-costs';
export * from './wrappers/openai';
export * from './wrappers/anthropic';
export * from './wrappers/gemini';
export * from './wrappers/generic';

import { MonitorClientConfig, TelemetryTraceInput } from './types';
import { TelemetryQueue } from './queue';
import { wrapOpenAI } from './wrappers/openai';
import { wrapAnthropic } from './wrappers/anthropic';
import { wrapGemini } from './wrappers/gemini';
import { traceExecution, TraceOptions } from './wrappers/generic';

export class MonitorClient {
  public readonly config: Required<MonitorClientConfig>;
  private queue: TelemetryQueue;

  constructor(config: MonitorClientConfig) {
    this.config = {
      apiKey: config.apiKey,
      endpoint: config.endpoint
        ? (config.endpoint.endsWith('/api/v1/ingest') ? config.endpoint : `${config.endpoint.replace(/\/$/, '')}/api/v1/ingest`)
        : 'http://localhost:3000/api/v1/ingest',
      maxBatchSize: config.maxBatchSize ?? 25,
      flushIntervalMs: config.flushIntervalMs ?? 1500,
      disabled: config.disabled ?? false,
      capturePayloads: config.capturePayloads ?? true,
      maxSnippetLength: config.maxSnippetLength ?? 500,
      debug: config.debug ?? false,
    };

    this.queue = new TelemetryQueue(this.config);
  }

  /**
   * Enqueue a single telemetry trace record into the background non-blocking dispatch buffer.
   */
  public record(trace: TelemetryTraceInput): void {
    if (this.config.disabled) return;
    this.queue.enqueue(trace);
  }

  /**
   * Immediately flush all enqueued telemetry traces to the ingest API.
   */
  public async flush(): Promise<void> {
    await this.queue.flush();
  }

  /**
   * Wrap an OpenAI client instance with transparent latency, token, and schema monitoring.
   */
  public wrapOpenAI<T extends Record<string, any>>(client: T): T {
    return wrapOpenAI(client, this);
  }

  /**
   * Wrap an Anthropic client instance with transparent latency, token, and error monitoring.
   */
  public wrapAnthropic<T extends Record<string, any>>(client: T): T {
    return wrapAnthropic(client, this);
  }

  /**
   * Wrap a Google Gemini client (or GenerativeModel) with transparent latency, token, and error monitoring.
   */
  public wrapGemini<T extends Record<string, any>>(clientOrModel: T): T {
    return wrapGemini(clientOrModel, this);
  }

  /**
   * Trace any arbitrary LLM invocation (Gemini, Groq, custom pipeline).
   */
  public async trace<T>(
    options: TraceOptions,
    fn: () => Promise<{
      result: T;
      promptTokens?: number;
      completionTokens?: number;
      statusCode?: number;
      rawOutput?: string;
    } | T>
  ): Promise<T> {
    return traceExecution<T>(this, options, fn);
  }

  /**
   * Helper to truncate string snippets according to privacy and buffer configuration.
   */
  public truncateSnippet(str: string | null | undefined): string | null {
    if (!this.config.capturePayloads || !str) return null;
    if (str.length <= this.config.maxSnippetLength) return str;
    return str.substring(0, this.config.maxSnippetLength) + '... [truncated]';
  }

  /**
   * Helper to extract human-readable prompt snippet from varied message shapes.
   */
  public extractPromptSnippet(messages: any): string | null {
    if (!this.config.capturePayloads || !messages) return null;

    if (Array.isArray(messages)) {
      const lastUser = [...messages].reverse().find((m) => m?.role === 'user');
      const target = lastUser || messages[messages.length - 1];
      if (typeof target?.content === 'string') {
        return this.truncateSnippet(target.content);
      }
      if (Array.isArray(target?.content)) {
        const text = target.content
          .map((c: any) => (typeof c === 'string' ? c : c?.text || ''))
          .join(' ');
        return this.truncateSnippet(text);
      }
    }

    if (typeof messages === 'string') {
      return this.truncateSnippet(messages);
    }

    return null;
  }
}

/**
 * Initialize a global or local MonitorClient instance.
 */
export function initMonitor(config: MonitorClientConfig): MonitorClient {
  return new MonitorClient(config);
}
