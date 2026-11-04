import OpenAI from 'openai';
import { FUN_INSTRUCTION, lazyClient } from './provider.types.ts';
import type { LlmProvider } from './provider.types.ts';

const getClient = lazyClient('openai', 'OPENAI_API_KEY', apiKey => new OpenAI({ apiKey }));

// OpenAI usa la Responses API. Los modelos codex se consumen por la misma API.
export const openaiProvider: LlmProvider = {
  name: 'openai',
  models: ['gpt-4o', 'gpt-4o-mini', 'o4-mini', 'gpt-5-codex'],
  defaultInstruction: FUN_INSTRUCTION,
  async generate({ model, system, prompt }) {
    const response = await getClient().responses.create({
      model,
      instructions: system,
      input: prompt,
      store: true,
    });
    return response.output_text;
  },
};
