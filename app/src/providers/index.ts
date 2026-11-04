import { anthropicProvider } from './anthropic.provider.ts';
import { geminiProvider } from './gemini.provider.ts';
import { createOpenAICompatibleProvider } from './openai-compatible.ts';
import { openaiProvider } from './openai.provider.ts';
import type { LlmProvider } from './provider.types.ts';

// Registro de proveedores LLM. Para agregar uno nuevo basta con una entrada aquí.
const providers: LlmProvider[] = [
  geminiProvider,
  openaiProvider,
  createOpenAICompatibleProvider({
    name: 'kimi',
    baseURL: 'https://api.moonshot.cn/v1',
    apiKeyEnv: 'KIMI_API_KEY',
    models: ['moonshot-v1-8k', 'moonshot-v1-32k', 'moonshot-v1-128k'],
  }),
  createOpenAICompatibleProvider({
    name: 'deepseek',
    baseURL: 'https://api.deepseek.com',
    apiKeyEnv: 'DEEPSEEK_API_KEY',
    models: ['deepseek-chat', 'deepseek-reasoner'],
  }),
  anthropicProvider,
  createOpenAICompatibleProvider({
    name: 'grok',
    baseURL: 'https://api.x.ai/v1',
    apiKeyEnv: 'XAI_API_KEY',
    models: ['grok-4', 'grok-3-mini'],
  }),
  createOpenAICompatibleProvider({
    name: 'mistral',
    baseURL: 'https://api.mistral.ai/v1',
    apiKeyEnv: 'MISTRAL_API_KEY',
    models: ['mistral-large-latest', 'mistral-medium-latest', 'mistral-small-latest', 'codestral-latest'],
  }),
  createOpenAICompatibleProvider({
    name: 'qwen',
    baseURL: 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1',
    apiKeyEnv: 'QWEN_API_KEY',
    models: ['qwen-max', 'qwen-plus', 'qwen-turbo'],
  }),
  createOpenAICompatibleProvider({
    name: 'groq',
    baseURL: 'https://api.groq.com/openai/v1',
    apiKeyEnv: 'GROQ_API_KEY',
    models: ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant'],
  }),
  createOpenAICompatibleProvider({
    name: 'ollama',
    baseURL: () => process.env.OLLAMA_BASE_URL || 'http://localhost:11434/v1',
    models: ['llama3.2', 'qwen2.5', 'mistral'],
  }),
];

export function getProvider(name: string): LlmProvider | undefined {
  return providers.find(provider => provider.name === name);
}

export function listProviders(): string[] {
  return providers.map(provider => provider.name);
}
