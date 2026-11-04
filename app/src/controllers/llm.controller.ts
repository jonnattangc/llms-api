import type { Request, Response } from 'express';
import { getProvider } from '../providers/index.ts';
import { ProviderNotConfiguredError } from '../providers/provider.types.ts';
import { generate, UnknownProviderError } from '../services/chat.service.ts';
import { resolveSystemId } from '../services/rag.service.ts';

// Controlador agnóstico del proveedor: solo valida, delega en chat.service y responde.
export function listModels(req: Request, res: Response) {
  const name = String(req.params.provider);
  const provider = getProvider(name);
  if (!provider) {
    res.status(404).json({ error: `Proveedor desconocido: "${name}".` });
    return;
  }
  res.json({ provider: provider.name, models: provider.models });
}

const parseBoolean = (value: unknown): boolean | undefined =>
  value === undefined || value === null ? undefined : value === true || value === 'true';

export async function generateContent(req: Request, res: Response) {
  const { type, data } = req.body ?? {};
  const provider = String(req.params.provider);
  const model = String(req.params.model);

  if (!data || !data.prompt) {
    res.status(400).json({ error: 'El campo "prompt" es requerido.' });
    return;
  }

  const isRAG = parseBoolean(data.isRAG);
  const systemId: string | undefined = data.systemId || undefined;
  if (isRAG === true && !resolveSystemId(systemId)) {
    res.status(400).json({ error: 'El campo "systemId" es requerido cuando isRAG es true.' });
    return;
  }

  if (type === 'encripted') {
    // TODO: agregar lógica de desencriptado
  }

  try {
    const text = await generate({
      provider,
      model,
      prompt: data.prompt,
      assistantType: data.assistantType || 'chat',
      ...(isRAG !== undefined && { isRAG }),
      ...(systemId && { systemId }),
    });
    res.json({ result: text });
  } catch (error) {
    if (error instanceof UnknownProviderError) {
      res.status(404).json({ error: error.message });
      return;
    }
    if (error instanceof ProviderNotConfiguredError) {
      res.status(503).json({ error: error.message });
      return;
    }
    console.error(`Error ${provider}:`, error);
    res.status(500).json({ error: 'Error al generar el contenido.' });
  }
}
