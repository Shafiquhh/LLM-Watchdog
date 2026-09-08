export type LLMProvider = 'openai' | 'anthropic' | 'gemini' | 'groq' | 'mistral' | 'custom';

export interface TelemetryTraceInput {
  provider: LLMProvider | string;
  model: string;
  statusCode: number;
  latencyMs: number;
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
  costUsd?: number;
  schemaValid?: boolean;
  schemaErrors?: string | null;
  promptSnippet?: string | null;
  responseSnippet?: string | null;
  errorMessage?: string | null;
  metadata?: Record<string, any>;
  timestamp?: string;
}

export interface IngestBatchPayload {
  traces: TelemetryTraceInput[];
}

export interface MonitorClientConfig {
  apiKey: string;
  endpoint?: string;
  maxBatchSize?: number;
  flushIntervalMs?: number;
  disabled?: boolean;
  capturePayloads?: boolean;
  maxSnippetLength?: number;
  debug?: boolean;
}
