import { MonitorClient } from '../index';
import { calculateCost } from '../token-costs';

/**
 * Wraps either GoogleGenerativeAI client or a GenerativeModel instance
 * to capture telemetry, token usage, latency, and cost automatically.
 */
export function wrapGemini<T extends Record<string, any>>(target: T, monitor: MonitorClient): T {
  if (!target) return target;

  // Case 1: Wrapping GoogleGenerativeAI directly (intercepts getGenerativeModel)
  if (typeof target.getGenerativeModel === 'function') {
    const originalGetModel = target.getGenerativeModel.bind(target);
    return new Proxy(target, {
      get(t, prop, receiver) {
        if (prop === 'getGenerativeModel') {
          return (modelParams: any, requestOptions?: any) => {
            const modelInstance = originalGetModel(modelParams, requestOptions);
            const modelName = typeof modelParams === 'string' ? modelParams : modelParams?.model || 'gemini-1.5-flash';
            return wrapGenerativeModel(modelInstance, monitor, modelName);
          };
        }
        return Reflect.get(t, prop, receiver);
      },
    });
  }

  // Case 2: Wrapping a GenerativeModel instance directly
  if (typeof target.generateContent === 'function') {
    const modelName = target.model || 'gemini-1.5-flash';
    return wrapGenerativeModel(target, monitor, modelName);
  }

  return target;
}

function wrapGenerativeModel<M extends Record<string, any>>(
  modelInstance: M,
  monitor: MonitorClient,
  fallbackModelName: string
): M {
  const originalGenerateContent = modelInstance.generateContent?.bind(modelInstance);
  if (!originalGenerateContent) return modelInstance;

  const wrappedGenerateContent = async (params: any, ...rest: any[]) => {
    const startTime = performance.now();
    const modelName = modelInstance.model || fallbackModelName;

    // Extract human-readable prompt
    let promptSnippet: string | null = null;
    if (typeof params === 'string') {
      promptSnippet = monitor.truncateSnippet(params);
    } else if (Array.isArray(params)) {
      promptSnippet = monitor.truncateSnippet(
        params.map((p) => (typeof p === 'string' ? p : p?.text || JSON.stringify(p))).join(' ')
      );
    } else if (params?.contents) {
      promptSnippet = monitor.extractPromptSnippet(params.contents);
    }

    try {
      const response = await originalGenerateContent(params, ...rest);
      const latencyMs = Math.round(performance.now() - startTime);

      // Extract usage metadata from Gemini response
      const usage = response?.response?.usageMetadata;
      const promptTokens = usage?.promptTokenCount ?? 0;
      const completionTokens = usage?.candidatesTokenCount ?? 0;
      const totalTokens = usage?.totalTokenCount ?? (promptTokens + completionTokens);
      const costUsd = calculateCost(modelName, promptTokens, completionTokens);

      let textOutput: string | null = null;
      try {
        if (typeof response?.response?.text === 'function') {
          textOutput = response.response.text();
        }
      } catch {
        // Handle blocked/empty response safely
      }

      monitor.record({
        provider: 'gemini',
        model: modelName,
        statusCode: 200,
        latencyMs,
        promptTokens,
        completionTokens,
        totalTokens,
        costUsd,
        promptSnippet,
        responseSnippet: monitor.truncateSnippet(textOutput),
      });

      return response;
    } catch (error: any) {
      const latencyMs = Math.round(performance.now() - startTime);
      const statusCode = error?.status || error?.statusCode || 500;
      const errorMessage = error?.message || 'Gemini Request Failed';

      monitor.record({
        provider: 'gemini',
        model: modelName,
        statusCode,
        latencyMs,
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
        costUsd: 0,
        promptSnippet,
        errorMessage,
      });

      throw error;
    }
  };

  return new Proxy(modelInstance, {
    get(target, prop, receiver) {
      if (prop === 'generateContent') {
        return wrappedGenerateContent;
      }
      return Reflect.get(target, prop, receiver);
    },
  });
}
