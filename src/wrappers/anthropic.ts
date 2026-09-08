import { MonitorClient } from '../index';
import { calculateCost } from '../token-costs';

export function wrapAnthropic<T extends Record<string, any>>(anthropicClient: T, monitor: MonitorClient): T {
  const originalCreate = anthropicClient?.messages?.create?.bind(anthropicClient.messages);

  if (!originalCreate) {
    return anthropicClient;
  }

  const wrappedCreate = async (params: any, options?: any) => {
    const startTime = performance.now();
    const promptSnippet = monitor.extractPromptSnippet(params?.messages);

    try {
      const response = await originalCreate(params, options);
      const latencyMs = Math.round(performance.now() - startTime);

      const model = response?.model || params?.model || 'unknown';
      const promptTokens = response?.usage?.input_tokens ?? 0;
      const completionTokens = response?.usage?.output_tokens ?? 0;
      const totalTokens = promptTokens + completionTokens;
      const costUsd = calculateCost(model, promptTokens, completionTokens);

      // Extract text from content blocks
      let textContent = '';
      if (Array.isArray(response?.content)) {
        textContent = response.content
          .filter((block: any) => block?.type === 'text')
          .map((block: any) => block?.text)
          .join('\n');
      }

      let schemaValid = true;
      let schemaErrors: string | null = null;

      // Check schema if tool_use or json output is prompted
      if (params?.system?.toLowerCase()?.includes('json') || params?.messages?.some((m: any) => typeof m.content === 'string' && m.content.toLowerCase().includes('json schema'))) {
        try {
          // Attempt to locate and parse JSON substring
          const jsonMatch = textContent.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
          if (jsonMatch) {
            JSON.parse(jsonMatch[0]);
          }
        } catch (jsonErr: any) {
          schemaValid = false;
          schemaErrors = JSON.stringify({
            error: 'Failed to parse expected JSON output from Anthropic message',
            details: jsonErr?.message || String(jsonErr),
          });
        }
      }

      monitor.record({
        provider: 'anthropic',
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
        responseSnippet: monitor.truncateSnippet(textContent),
      });

      return response;
    } catch (error: any) {
      const latencyMs = Math.round(performance.now() - startTime);
      const statusCode = error?.status || error?.statusCode || 500;
      const errorMessage = error?.message || 'Anthropic Request Failed';

      monitor.record({
        provider: 'anthropic',
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

  return new Proxy(anthropicClient, {
    get(target, prop, receiver) {
      if (prop === 'messages') {
        const messages = Reflect.get(target, prop, receiver);
        return new Proxy(messages, {
          get(msgTarget, msgProp, msgReceiver) {
            if (msgProp === 'create') {
              return wrappedCreate;
            }
            return Reflect.get(msgTarget, msgProp, msgReceiver);
          },
        });
      }
      return Reflect.get(target, prop, receiver);
    },
  });
}
