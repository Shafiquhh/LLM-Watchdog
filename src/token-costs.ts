// Pricing per 1,000 tokens (USD)
export const MODEL_PRICING: Record<string, { prompt: number; completion: number }> = {
  // OpenAI
  'gpt-4o': { prompt: 0.0025, completion: 0.01 },
  'gpt-4o-2024-08-06': { prompt: 0.0025, completion: 0.01 },
  'gpt-4o-mini': { prompt: 0.00015, completion: 0.0006 },
  'gpt-4-turbo': { prompt: 0.01, completion: 0.03 },
  'gpt-3.5-turbo': { prompt: 0.0005, completion: 0.0015 },
  // Anthropic
  'claude-3-5-sonnet-20241022': { prompt: 0.003, completion: 0.015 },
  'claude-3-5-sonnet-20240620': { prompt: 0.003, completion: 0.015 },
  'claude-3-5-haiku-20241022': { prompt: 0.001, completion: 0.005 },
  'claude-3-opus-20240229': { prompt: 0.015, completion: 0.075 },
  // Google Gemini
  'gemini-1.5-pro': { prompt: 0.00125, completion: 0.005 },
  'gemini-1.5-flash': { prompt: 0.000075, completion: 0.0003 },
  // Groq / Meta Llama
  'llama-3.1-70b-versatile': { prompt: 0.00059, completion: 0.00079 },
  'llama-3.1-8b-instant': { prompt: 0.00005, completion: 0.00008 },
};

export function calculateCost(
  model: string,
  promptTokens: number = 0,
  completionTokens: number = 0
): number {
  const normalizedModel = Object.keys(MODEL_PRICING).find((m) =>
    model.toLowerCase().includes(m.toLowerCase())
  );

  const rates = normalizedModel ? MODEL_PRICING[normalizedModel] : { prompt: 0.001, completion: 0.002 };

  const promptCost = (promptTokens / 1000) * rates.prompt;
  const completionCost = (completionTokens / 1000) * rates.completion;

  return Number((promptCost + completionCost).toFixed(6));
}
