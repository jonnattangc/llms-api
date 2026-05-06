import OpenAI from 'openai';
import { buildSheetsPrompt } from './sheets.service.ts';

const apiKey = process.env.KIMI_API_KEY || '';
if (!apiKey) {
  throw new Error('KIMI_API_KEY no está definida en las variables de entorno.');
}

const kimi = new OpenAI({
  apiKey,
  baseURL: 'https://api.moonshot.cn/v1',
});

const DEFAULT_MODEL = 'moonshot-v1-8k';
const DEFAULT_INSTRUCTION = 'Eres un asistente de chat, respondes de forma divertida';

export async function generateContent(prompt: string, modelId: string = DEFAULT_MODEL, assistantType: string = 'chat'): Promise<string> {
  const systemContent = assistantType !== 'chat' ? assistantType : DEFAULT_INSTRUCTION;
  const userContent = assistantType !== 'chat' ? await buildSheetsPrompt(prompt) : prompt;

  console.log('[GEMINI] assistantType: ', assistantType);
  
  const response = await kimi.chat.completions.create({
    model: modelId,
    messages: [
      { role: 'system', content: systemContent },
      { role: 'user', content: userContent },
    ],
  });

  return response.choices[0]?.message?.content ?? '';
}
