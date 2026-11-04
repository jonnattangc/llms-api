import type { Request, Response } from 'express';
import { reloadAll, ReloadBusyError } from '../services/rag-reload.service.ts';

// Recarga los archivos dinámicos en el RAG. Bloquea hasta terminar; si está ocupado responde 429 + Retry-After.
export async function reload(req: Request, res: Response) {
  const systemId = typeof req.query.systemId === 'string' && req.query.systemId ? req.query.systemId : undefined;

  try {
    res.json(await reloadAll(systemId));
  } catch (error) {
    if (error instanceof ReloadBusyError) {
      res.set('Retry-After', String(error.retryAfterSeconds)).status(429).json({ error: error.message });
      return;
    }
    console.error('Error recargando el RAG:', error);
    res.status(500).json({ error: 'Error al recargar los archivos en el RAG.' });
  }
}
