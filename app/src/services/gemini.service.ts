import { GoogleGenerativeAI } from '@google/generative-ai';
import { buildSheetsPrompt } from './sheets.service.ts';

const apiKey = process.env.GEMINI_API_KEY || '';
if (!apiKey) {
  throw new Error('GEMINI_API_KEY no está definida en las variables de entorno.');
}

const genAI = new GoogleGenerativeAI(apiKey);

const DEFAULT_MODEL = 'gemini-2.0-flash';
const DEFAULT_INSTRUCTION = 'Eres un asistente de chat, respondes de forma divertida';

export async function generateContent(prompt: string, modelId: string = DEFAULT_MODEL, assistantType: string = 'chat'): Promise<string> {
  let systemInstruction = DEFAULT_INSTRUCTION;
  let finalPrompt = prompt;

  console.log('[GEMINI] assistantType: ', assistantType);

  if (assistantType !== 'chat') {
    systemInstruction = assistantType;
    finalPrompt = await buildSheetsPrompt(prompt);
  }

  const model = genAI.getGenerativeModel({ model: modelId, systemInstruction });
  const result = await model.generateContent(finalPrompt);
  return result.response.text();
}
