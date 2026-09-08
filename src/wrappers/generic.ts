import { MonitorClient } from '../index';
import { calculateCost } from '../token-costs';
import { LLMProvider } from '../types';

export interface TraceOptions {
  provider: LLMProvider | string;
  model: string;
  promptSnippet?: string;
  metadata?: Record<string, any>;
  schemaValidator?: (output: any) => { valid: boolean; errors?: string | string[] };
}

export async function traceExecution<T>(
  monitor: MonitorClient,
  options: TraceOptions,
  fn: () => Promise<{
    result: T;
    promptTokens?: number;
    completionTokens?: number;
    statusCode?: number;
    rawOutput?: string;
  } | T>
): Promise<T> {
  const startTime = performance.now();

  try {
    const rawResult = await fn();
    const latencyMs = Math.round(performance.now() - startTime);

    let actualResult: T;
    let promptTokens = 0;
    let completionTokens = 0;
    let statusCode = 200;
    let rawOutput: string | null = null;

    // Check if function returned rich result wrapper or pure value
    if (rawResult && typeof rawResult === 'object' && 'result' in rawResult) {
      const wrapped = rawResult as any;
      actualResult = wrapped.result;
      promptTokens = wrapped.promptTokens ?? 0;
      completionTokens = wrapped.completionTokens ?? 0;
      statusCode = wrapped.statusCode ?? 200;
      rawOutput = wrapped.rawOutput ?? (typeof actualResult === 'string' ? actualResult : JSON.stringify(actualResult));
    } else {
      actualResult = rawResult as T;
      rawOutput = typeof actualResult === 'string' ? actualResult : JSON.stringify(actualResult);
    }

    let schemaValid = true;
    let schemaErrors: string | null = null;

    if (options.schemaValidator) {
      try {
        const val = options.schemaValidator(actualResult);
        schemaValid = val.valid;
        if (!val.valid) {
          schemaErrors = typeof val.errors === 'string' ? val.errors : JSON.stringify(val.errors);
        }
      } catch (valErr: any) {
        schemaValid = false;
        schemaErrors = String(valErr?.message || valErr);
      }
    }

    const totalTokens = promptTokens + completionTokens;
    const costUsd = calculateCost(options.model, promptTokens, completionTokens);

    monitor.record({
      provider: options.provider,
      model: options.model,
      statusCode,
      latencyMs,
      promptTokens,
      completionTokens,
      totalTokens,
      costUsd,
      schemaValid,
      schemaErrors,
      promptSnippet: options.promptSnippet ? monitor.truncateSnippet(options.promptSnippet) : undefined,
      responseSnippet: rawOutput ? monitor.truncateSnippet(rawOutput) : undefined,
      metadata: options.metadata,
    });

    return actualResult;
  } catch (error: any) {
    const latencyMs = Math.round(performance.now() - startTime);
    const statusCode = error?.status || error?.statusCode || 500;
    const errorMessage = error?.message || String(error);

    monitor.record({
      provider: options.provider,
      model: options.model,
      statusCode,
      latencyMs,
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
      costUsd: 0,
      schemaValid: false,
      errorMessage,
      promptSnippet: options.promptSnippet ? monitor.truncateSnippet(options.promptSnippet) : undefined,
      metadata: options.metadata,
    });

    throw error;
  }
}
