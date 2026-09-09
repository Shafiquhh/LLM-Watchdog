// Pricing per 1,000 tokens (USD)
export const MODEL_PRICING: Record<string, { prompt: number; completion: number }> = {
  // OpenAI Frontier & Flagship
  'o3-mini': { prompt: 0.0011, completion: 0.0044 },
  'o1-mini': { prompt: 0.003, completion: 0.012 },
  'o1': { prompt: 0.015, completion: 0.06 },
  'gpt-4.5': { prompt: 0.075, completion: 0.15 },
  'gpt-4o': { prompt: 0.0025, completion: 0.01 },
  'gpt-4o-2024-08-06': { prompt: 0.0025, completion: 0.01 },
  'gpt-4o-mini': { prompt: 0.00015, completion: 0.0006 },
  'gpt-4-turbo': { prompt: 0.01, completion: 0.03 },
  'gpt-4': { prompt: 0.03, completion: 0.06 },
  'gpt-3.5-turbo': { prompt: 0.0005, completion: 0.0015 },

  // Anthropic Claude
  'claude-3-7-sonnet': { prompt: 0.003, completion: 0.015 },
  'claude-3-5-sonnet': { prompt: 0.003, completion: 0.015 },
  'claude-3-5-haiku': { prompt: 0.0008, completion: 0.004 },
  'claude-3-opus': { prompt: 0.015, completion: 0.075 },

  // Google Gemini
  'gemini-3.8-flash': { prompt: 0.000075, completion: 0.0003 },
  'gemini-3.7-flash': { prompt: 0.000075, completion: 0.0003 },
  'gemini-3.6-flash': { prompt: 0.000075, completion: 0.0003 },
  'gemini-3.5-flash': { prompt: 0.000075, completion: 0.0003 },
  'gemini-2.5-flash': { prompt: 0.000075, completion: 0.0003 },
  'gemini-2.5-pro': { prompt: 0.00125, completion: 0.005 },
  'gemini-2.0-flash': { prompt: 0.0001, completion: 0.0004 },
  'gemini-flash-latest': { prompt: 0.000075, completion: 0.0003 },
  'gemini-pro-latest': { prompt: 0.00125, completion: 0.005 },
  'gemini-1.5-pro': { prompt: 0.00125, completion: 0.005 },
  'gemini-1.5-flash': { prompt: 0.000075, completion: 0.0003 },

  // DeepSeek
  'deepseek-chat': { prompt: 0.00014, completion: 0.00028 },
  'deepseek-v3': { prompt: 0.00014, completion: 0.00028 },
  'deepseek-reasoner': { prompt: 0.00055, completion: 0.00219 },
  'deepseek-r1': { prompt: 0.00055, completion: 0.00219 },

  // Meta Llama (Groq / Together / Fireworks)
  'llama-3.3-70b': { prompt: 0.00059, completion: 0.00079 },
  'llama-3.1-405b': { prompt: 0.002, completion: 0.002 },
  'llama-3.1-70b': { prompt: 0.00059, completion: 0.00079 },
  'llama-3.1-8b': { prompt: 0.00005, completion: 0.00008 },
  'llama-3.2-3b': { prompt: 0.00003, completion: 0.00005 },
  'llama-3.2-1b': { prompt: 0.00002, completion: 0.00003 },

  // Mistral AI
  'mistral-large': { prompt: 0.002, completion: 0.006 },
  'mistral-small': { prompt: 0.0002, completion: 0.0006 },
  'codestral': { prompt: 0.0003, completion: 0.0009 },
};

/**
 * Register or update model pricing dynamically.
 */
export function registerModelPricing(
  model: string,
  pricing: { prompt: number; completion: number }
): void {
  MODEL_PRICING[model.toLowerCase()] = pricing;
}

/**
 * Calculate estimated token cost for a model invocation in USD.
 */
export function calculateCost(
  model: string,
  promptTokens: number = 0,
  completionTokens: number = 0,
  customRates?: { prompt: number; completion: number }
): number {
  if (customRates) {
    const promptCost = (promptTokens / 1000) * customRates.prompt;
    const completionCost = (completionTokens / 1000) * customRates.completion;
    return Number((promptCost + completionCost).toFixed(6));
  }

  const modelLower = model.toLowerCase();
  const normalizedKey = Object.keys(MODEL_PRICING).find((m) =>
    modelLower.includes(m.toLowerCase())
  );

  const rates = normalizedKey
    ? MODEL_PRICING[normalizedKey]
    : { prompt: 0.0005, completion: 0.0015 }; // Sensible generic default

  const promptCost = (promptTokens / 1000) * rates.prompt;
  const completionCost = (completionTokens / 1000) * rates.completion;

  return Number((promptCost + completionCost).toFixed(6));
}
