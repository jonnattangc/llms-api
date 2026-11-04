import OpenAI from 'openai';
import { FUN_INSTRUCTION, lazyClient } from './provider.types.ts';
import type { LlmProvider } from './provider.types.ts';

interface OpenAICompatibleConfig {
  name: string;
  // Función cuando la URL viene de una variable de entorno (se lee al primer uso).
  baseURL: string | (() => string);
  // Variable de entorno con la API key. Sin ella, el proveedor no requiere key (ej: Ollama local).
  apiKeyEnv?: string;
  models: string[];
  defaultInstruction?: string;
}

// Proveedores que exponen la API chat.completions de OpenAI (DeepSeek, Kimi, Grok, Mistral, Qwen, Groq, Ollama).
export function createOpenAICompatibleProvider(config: OpenAICompatibleConfig): LlmProvider {
  const baseURL = () => (typeof config.baseURL === 'function' ? config.baseURL() : config.baseURL);

  let keylessClient: OpenAI | undefined;
  const getClient = config.apiKeyEnv
    ? lazyClient(config.name, config.apiKeyEnv, apiKey => new OpenAI({ apiKey, baseURL: baseURL() }))
    : () => (keylessClient ??= new OpenAI({ apiKey: 'no-key', baseURL: baseURL() }));

  return {
    name: config.name,
    models: config.models,
    defaultInstruction: config.defaultInstruction ?? FUN_INSTRUCTION,
    async generate({ model, system, prompt }) {
      const response = await getClient().chat.completions.create({
        model,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: prompt },
        ],
      });
      return response.choices[0]?.message?.content ?? '';
    },
  };
}
