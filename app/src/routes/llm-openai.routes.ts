import express from 'express';
import type { Request, Response } from 'express';
import { generateContent } from '../services/openai.service.ts';

const router = express.Router();

router.get('/', (_req: Request, res: Response) => {
  res.json({ provider: 'openai', models: ['gpt-4o', 'gpt-4o-mini', 'o4-mini'] });
});

router.post('/:model', async (req: Request, res: Response) => {
  const { type, data } = req.body;
  const { model } = req.params;

  if (!data || !data.prompt) {
    res.status(400).json({ error: 'El campo "prompt" es requerido.' });
    return;
  }

  const prompt: string = data.prompt;
  const assistantType: string = data.assistantType || 'chat';

  if (type === 'encripted') {
    // TODO: agregar lógica de desencriptado
  }

  try {
    const text = await generateContent(prompt, model, assistantType);
    res.json({ result: text });
  } catch (error) {
    console.error('Error OpenAI:', error);
    res.status(500).json({ error: 'Error al generar el contenido.' });
  }
});

export default router;
