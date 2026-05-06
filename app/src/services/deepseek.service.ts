import OpenAI from 'openai';
import { buildSheetsPrompt } from './sheets.service.ts';

const apiKey = process.env.DEEPSEEK_API_KEY || '';
if (!apiKey) {
  throw new Error('DEEPSEEK_API_KEY no está definida en las variables de entorno.');
}

const deepseek = new OpenAI({
  apiKey,
  baseURL: 'https://api.deepseek.com',
});

const DEFAULT_MODEL = 'deepseek-chat';
const DEFAULT_INSTRUCTION = 'Eres un asistente de chat, respondes de forma divertida';

export async function generateContent(prompt: string, modelId: string = DEFAULT_MODEL, assistantType: string = 'chat'): Promise<string> {
  const systemContent = assistantType !== 'chat' ? assistantType : DEFAULT_INSTRUCTION;
  const userContent = assistantType !== 'chat' ? await buildSheetsPrompt(prompt) : prompt;

  console.log('[DEEPSEEK] assistantType: ', assistantType);

  const response = await deepseek.chat.completions.create({
    model: modelId,
    messages: [
      { role: 'system', content: systemContent },
      { role: 'user', content: userContent },
    ],
  });

  return response.choices[0]?.message?.content ?? '';
}
