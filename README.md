# llm-watchdog

[![npm version](https://img.shields.io/npm/v/llm-watchdog.svg?color=indigo)](https://www.npmjs.com/package/llm-watchdog)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

Lightweight, non-blocking telemetry SDK for LLM applications. Automatically monitors latency, token consumption, and errors for **Google Gemini**, **OpenAI**, and **Anthropic Claude**.

- ⚡ **Zero Added Latency:** Telemetry is buffered in memory and sent asynchronously in background batches.
- 💰 **Auto-Cost Calculation:** Built-in pricing for Gemini 3.x/2.5, GPT-4o, o3-mini, Claude 3.7, DeepSeek, and Llama.
- 📦 **Zero Dependencies:** Ultra-lightweight (< 65 KB).

🌐 **Platform Website:** [https://llm-watchdog-web.vercel.app](https://llm-watchdog-web.vercel.app)  
🐙 **GitHub Repository:** [https://github.com/Shafiquhh/LLM-Watchdog](https://github.com/Shafiquhh/LLM-Watchdog)

---

## 📦 Installation

```bash
npm install llm-watchdog
```
*(Or using `pnpm add llm-watchdog` / `yarn add llm-watchdog` / `bun add llm-watchdog`)*

---

## 🚀 Quickstart

### 1. Google Gemini
```typescript
import { GoogleGenerativeAI } from '@google/generative-ai';
import { initMonitor } from 'llm-watchdog';

// 1. Initialize Watchdog
const monitor = initMonitor({
  apiKey: 'saas_live_YOUR_API_KEY',
  endpoint: 'https://llm-watchdog-web.vercel.app/api/v1/ingest',
});

// 2. Wrap Gemini client (1 line of code!)
const genAI = monitor.wrapGemini(new GoogleGenerativeAI(process.env.GEMINI_API_KEY!));

// 3. Normal AI calls — token counts, costs, and latency are captured automatically!
const model = genAI.getGenerativeModel({ model: 'gemini-3.6-flash' });
const result = await model.generateContent('Why is the sky blue?');
console.log(result.response.text());
```

---

### 2. OpenAI
```typescript
import OpenAI from 'openai';
import { initMonitor } from 'llm-watchdog';

const monitor = initMonitor({
  apiKey: 'saas_live_YOUR_API_KEY',
  endpoint: 'https://llm-watchdog-web.vercel.app/api/v1/ingest',
});

// Wrap OpenAI client
const openai = monitor.wrapOpenAI(new OpenAI());

// Calls are automatically tracked on your dashboard
const response = await openai.chat.completions.create({
  model: 'gpt-4o',
  messages: [{ role: 'user', content: 'Generate structured JSON' }],
});
```

---

### 3. Anthropic Claude
```typescript
import Anthropic from '@anthropic-ai/sdk';
import { initMonitor } from 'llm-watchdog';

const monitor = initMonitor({
  apiKey: 'saas_live_YOUR_API_KEY',
  endpoint: 'https://llm-watchdog-web.vercel.app/api/v1/ingest',
});

const anthropic = monitor.wrapAnthropic(new Anthropic());

const message = await anthropic.messages.create({
  model: 'claude-3-7-sonnet',
  max_tokens: 1024,
  messages: [{ role: 'user', content: 'Summarize ticket' }],
});
```

---

## ⚙️ Configuration Options

```typescript
const monitor = initMonitor({
  apiKey: 'saas_live_...',                       // Required: your Watchdog API key
  endpoint: 'https://llm-watchdog-web.vercel.app/api/v1/ingest', // Telemetry endpoint
  maxBatchSize: 25,                              // Number of traces to buffer before sending
  flushIntervalMs: 1500,                         // Time in ms before auto-flushing buffer
  capturePayloads: true,                         // Set false for strict privacy (no prompt text saved)
  maxSnippetLength: 500,                         // Maximum characters saved per prompt
  debug: false,                                  // Set true to log telemetry status in console
});
```

---

## 📄 License
MIT © LLM Watchdog
