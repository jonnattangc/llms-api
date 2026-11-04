import { syncSystems } from './rag-sync.service.ts';
import type { SystemSyncResult } from './rag-sync.service.ts';

const DEFAULT_COOLDOWN_SECONDS = 10;

export class ReloadBusyError extends Error {
  readonly retryAfterSeconds: number;

  constructor(retryAfterSeconds: number) {
    super(`La recarga del RAG no está disponible, reintentar en ${retryAfterSeconds} s.`);
    this.name = 'ReloadBusyError';
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

export interface ReloadResult {
  systems: SystemSyncResult[];
  durationMs: number;
}

let running = false;
let availableAt = 0;

const cooldownMs = () => Number(process.env.RAG_RELOAD_COOLDOWN_SECONDS ?? DEFAULT_COOLDOWN_SECONDS) * 1000;

// Recarga en el RAG los archivos dinámicos que cambiaron (las fuentes con el mismo md5 no se descargan).
// Una sola a la vez, y tras terminar queda en espera RAG_RELOAD_COOLDOWN_SECONDS antes de aceptar otra.
export async function reloadAll(systemId?: string): Promise<ReloadResult> {
  const waitMs = running ? cooldownMs() : availableAt - Date.now();
  if (running || waitMs > 0) throw new ReloadBusyError(Math.max(1, Math.ceil(waitMs / 1000)));

  running = true;
  const startedAt = Date.now();
  console.log(`[RELOAD] Inicio de recarga del RAG (${systemId ? `sistema ${systemId}` : 'todos los sistemas'})`);
  try {
    const systems = await syncSystems(systemId);
    const durationMs = Date.now() - startedAt;
    console.log(`[RELOAD] Fin de recarga en ${durationMs} ms`);
    return { systems, durationMs };
  } finally {
    running = false;
    availableAt = Date.now() + cooldownMs();
  }
}
