import Anthropic from '@anthropic-ai/sdk';
import { FUN_INSTRUCTION, lazyClient } from './provider.types.ts';
import type { LlmProvider } from './provider.types.ts';

const getClient = lazyClient('claude', 'ANTHROPIC_API_KEY', apiKey => new Anthropic({ apiKey }));

const MAX_TOKENS = 16000;
// Modelos que aceptan el fallback del servidor: si los clasificadores rechazan, otro modelo responde en la misma llamada.
const FALLBACK_MODELS = ['claude-opus-5-5', 'claude-sonnet-5-5'];

export const anthropicProvider: LlmProvider = {
  name: 'claude',
  models: ['claude-opus-5-5', 'claude-sonnet-5-5', 'claude-haiku-5-5'],
  defaultInstruction: FUN_INSTRUCTION,
  async generate({ model, system, prompt }) {
    const params = { model, max_tokens: MAX_TOKENS, system, messages: [{ role: 'user' as const, content: prompt }] };
    const response = FALLBACK_MODELS.includes(model)
      ? await getClient().beta.messages.create({ ...params, betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' })
      : await getClient().messages.create(params);

    if (response.stop_reason === 'refusal') {
      throw new Error(`Claude rechazó la solicitud (${response.stop_details?.category ?? 'sin categoría'}).`);
    }

    return response.content
      .flatMap(block => (block.type === 'text' ? [block.text] : []))
      .join('');
  },
};
