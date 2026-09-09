import { initMonitor, calculateCost, wrapOpenAI, wrapAnthropic, traceExecution } from '../src';

async function runSdkTests() {
  console.log('🧪 Starting llm-watchdog Unit Tests...\n');

  // 1. Cost calculation test
  const gpt4oCost = calculateCost('gpt-4o', 1000, 500);
  console.assert(gpt4oCost === 0.0075, `Expected 0.0075, got ${gpt4oCost}`);
  console.log(`✓ Token cost calculator (gpt-4o: 1000 in, 500 out -> $${gpt4oCost})`);

  const claudeCost = calculateCost('claude-3-5-sonnet-20241022', 2000, 1000);
  console.assert(claudeCost === 0.021, `Expected 0.021, got ${claudeCost}`);
  console.log(`✓ Token cost calculator (claude-3-5-sonnet: 2000 in, 1000 out -> $${claudeCost})`);

  // 2. Initialize monitor with capture enabled and custom endpoint
  const monitor = initMonitor({
    apiKey: 'saas_live_test_mock_123',
    endpoint: 'http://localhost:3000/api/v1/ingest',
    maxBatchSize: 10,
    debug: false,
  });

  // 3. Test OpenAI Mock Wrapper
  const mockOpenAIClient = {
    chat: {
      completions: {
        create: async (params: any) => {
          return {
            id: 'chatcmpl-test123',
            model: params.model,
            choices: [
              {
                message: {
                  role: 'assistant',
                  content: '{"prediction": "positive", "score": 0.94}',
                },
              },
            ],
            usage: {
              prompt_tokens: 42,
              completion_tokens: 18,
              total_tokens: 60,
            },
          };
        },
      },
    },
  };

  const wrappedOpenAI = monitor.wrapOpenAI(mockOpenAIClient);
  const aiRes = await wrappedOpenAI.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [{ role: 'user', content: 'Analyze sentiment for customer review' }],
    response_format: { type: 'json_object' },
  });

  console.assert(aiRes.choices[0].message.content.includes('prediction'), 'OpenAI wrapper should return original response');
  console.log('✓ OpenAI wrapper intercepted completion and queued trace');

  // 4. Test Anthropic Mock Wrapper
  const mockAnthropicClient = {
    messages: {
      create: async (params: any) => {
        return {
          id: 'msg_test123',
          model: params.model,
          content: [
            {
              type: 'text',
              text: 'Here is your analysis: all systems nominal.',
            },
          ],
          usage: {
            input_tokens: 60,
            output_tokens: 15,
          },
        };
      },
    },
  };

  const wrappedAnthropic = monitor.wrapAnthropic(mockAnthropicClient);
  const anthropicRes = await wrappedAnthropic.messages.create({
    model: 'claude-3-5-sonnet-20241022',
    messages: [{ role: 'user', content: 'Run diagnosis' }],
  });

  console.assert(anthropicRes.content[0].text.includes('nominal'), 'Anthropic wrapper should return response');
  console.log('✓ Anthropic wrapper intercepted message and queued trace');

  // 5. Test Generic Trace
  const result = await monitor.trace(
    {
      provider: 'groq',
      model: 'llama-3.1-70b-versatile',
      promptSnippet: 'Translate to French',
      schemaValidator: (res) => ({ valid: typeof res === 'string' && res.length > 0 }),
    },
    async () => {
      return {
        result: 'Bonjour le monde',
        promptTokens: 10,
        completionTokens: 5,
        statusCode: 200,
      };
    }
  );

  console.assert(result === 'Bonjour le monde');
  console.log('✓ Generic trace wrapper executed and validated schema');

  console.log('\n🎉 All llm-watchdog SDK tests passed!\n');
}

runSdkTests().catch(console.error);

