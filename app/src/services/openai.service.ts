import OpenAI from 'openai';
import { buildSheetsPrompt } from './sheets.service.ts';

const apiKey = process.env.OPENAI_API_KEY || '';
if (!apiKey) {
  throw new Error('OPENAI_API_KEY no está definida en las variables de entorno.');
}

const openai = new OpenAI({ apiKey });

const DEFAULT_MODEL = 'gpt-4o-mini';
const DEFAULT_INSTRUCTION = 'Eres un asistente de chat, respondes de forma divertida';

export async function generateContent(prompt: string, modelId: string = DEFAULT_MODEL, assistantType: string = 'chat'): Promise<string> {
  const instructions = assistantType !== 'chat' ? assistantType : DEFAULT_INSTRUCTION;
  const input = assistantType !== 'chat' ? await buildSheetsPrompt(prompt) : prompt;

  console.log('[GEMINI] assistantType: ', assistantType);
  
  const response = await openai.responses.create({
    model: modelId,
    instructions,
    input,
    store: true,
  });

  return response.output_text;
}
