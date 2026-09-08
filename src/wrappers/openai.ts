import { MonitorClient } from '../index';
import { calculateCost } from '../token-costs';

export function wrapOpenAI<T extends Record<string, any>>(openaiClient: T, monitor: MonitorClient): T {
  const originalCreate = openaiClient?.chat?.completions?.create?.bind(openaiClient.chat.completions);

  if (!originalCreate) {
    return openaiClient;
  }

  const wrappedCreate = async (params: any, options?: any) => {
    const startTime = performance.now();
    const promptSnippet = monitor.extractPromptSnippet(params?.messages);

    try {
      const response = await originalCreate(params, options);
      const latencyMs = Math.round(performance.now() - startTime);

      const model = response?.model || params?.model || 'unknown';
      const promptTokens = response?.usage?.prompt_tokens ?? 0;
      const completionTokens = response?.usage?.completion_tokens ?? 0;
      const totalTokens = response?.usage?.total_tokens ?? (promptTokens + completionTokens);
      const costUsd = calculateCost(model, promptTokens, completionTokens);

      const content = response?.choices?.[0]?.message?.content ?? null;
      let schemaValid = true;
      let schemaErrors: string | null = null;

      // Check schema conformance if JSON output expected
      if (params?.response_format?.type === 'json_object' || params?.response_format?.type === 'json_schema') {
        if (!content) {
          schemaValid = false;
          schemaErrors = JSON.stringify({ error: 'Expected JSON output but received empty response' });
        } else {
          try {
            JSON.parse(content);
          } catch (jsonErr: any) {
            schemaValid = false;
            schemaErrors = JSON.stringify({
              error: 'Invalid JSON syntax from model',
              details: jsonErr?.message || String(jsonErr),
            });
          }
        }
      }

      monitor.record({
        provider: 'openai',
        model,
        statusCode: 200,
        latencyMs,
        promptTokens,
        completionTokens,
        totalTokens,
        costUsd,
        schemaValid,
        schemaErrors,
        promptSnippet,
        responseSnippet: monitor.truncateSnippet(content),
      });

      return response;
    } catch (error: any) {
      const latencyMs = Math.round(performance.now() - startTime);
      const statusCode = error?.status || error?.statusCode || 500;
      const errorMessage = error?.message || 'OpenAI Request Failed';

      monitor.record({
        provider: 'openai',
        model: params?.model || 'unknown',
        statusCode,
        latencyMs,
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
        costUsd: 0,
        schemaValid: false,
        errorMessage,
        promptSnippet,
        responseSnippet: monitor.truncateSnippet(error?.error?.message || errorMessage),
      });

      throw error;
    }
  };

  // Return proxy preserving methods
  return new Proxy(openaiClient, {
    get(target, prop, receiver) {
      if (prop === 'chat') {
        const chat = Reflect.get(target, prop, receiver);
        return new Proxy(chat, {
          get(chatTarget, chatProp, chatReceiver) {
            if (chatProp === 'completions') {
              const completions = Reflect.get(chatTarget, chatProp, chatReceiver);
              return new Proxy(completions, {
                get(compTarget, compProp, compReceiver) {
                  if (compProp === 'create') {
                    return wrappedCreate;
                  }
                  return Reflect.get(compTarget, compProp, compReceiver);
                },
              });
            }
            return Reflect.get(chatTarget, chatProp, chatReceiver);
          },
        });
      }
      return Reflect.get(target, prop, receiver);
    },
  });
}
