import { GoogleGenerativeAI } from '@google/generative-ai';
import { FORMAL_INSTRUCTION, lazyClient } from './provider.types.ts';
import type { LlmProvider } from './provider.types.ts';

const getClient = lazyClient('gemini', 'GEMINI_API_KEY', apiKey => new GoogleGenerativeAI(apiKey));

export const geminiProvider: LlmProvider = {
  name: 'gemini',
  models: ['gemini-2.0-flash', 'gemini-2.0-flash-lite', 'gemini-2.5-pro-preview-05-06', 'gemini-2.5-flash', 'gemini-2.5-pro'],
  defaultInstruction: FORMAL_INSTRUCTION,
  async generate({ model, system, prompt }) {
    const generativeModel = getClient().getGenerativeModel({ model, systemInstruction: system });
    const result = await generativeModel.generateContent(prompt);
    return result.response.text();
  },
};
