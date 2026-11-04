import { createHash } from 'node:crypto';
import { deleteFile, findFilesBySource, insertFile, updateFileContent } from '../db/rag-files.repository.ts';
import type { RagFileInput } from '../db/rag-files.repository.ts';
import { ensureSource, findActiveSources, updateRemoteChecksum } from '../db/rag-sources.repository.ts';
import type { RagSource } from '../db/rag-sources.repository.ts';
import { deleteDocument, indexDocument } from './rag.service.ts';
import { getSourceHandler } from './sources/index.ts';

export type FileAction = 'created' | 'updated' | 'unchanged' | 'deleted' | 'error';

export interface FileSyncResult {
  filename: string;
  action: FileAction;
  error?: string;
}

export interface SystemSyncResult {
  systemId: string;
  files: FileSyncResult[];
}

const ACTION_LOG: Record<FileAction, string> = {
  created: 'nuevo, vectorizado en el RAG',
  updated: 'md5 distinto, re-vectorizado en el RAG',
  unchanged: 'md5 igual, no se envía al RAG',
  deleted: 'ya no existe en el origen, eliminado del RAG',
  error: 'error',
};

const md5 = (content: string) => createHash('md5').update(content).digest('hex');

// Sincroniza una fuente: indexa solo los archivos nuevos o con md5 distinto y elimina los que ya no existen.
async function syncSource(source: RagSource): Promise<FileSyncResult[]> {
  const handler = getSourceHandler(source.type);
  if (!handler) {
    console.warn(`[SYNC] Tipo de fuente desconocido "${source.type}" (fuente ${source.id}), se omite.`);
    return [];
  }

  // Antes de procesar nada: md5 de la fuente completa. Si es igual al de la última sincronización,
  // no se descarga ni se procesa nada. Si no se puede calcular, se descarga y el md5 de cada archivo decide.
  let checksum: string | undefined;
  try {
    checksum = await handler.getChecksum(source);
  } catch (error) {
    console.warn(`[SYNC] Fuente ${source.id}: no se pudo calcular el md5 de la fuente, se descarga y compara por archivo. Causa: ${(error as Error).message.split('.')[0]}`);
  }
  if (checksum && source.remoteChecksum === checksum) {
    console.log(`[SYNC] Fuente ${source.id} (${source.name ?? source.reference}) sin cambios (md5 ${checksum}), no se descarga.`);
    return (await findFilesBySource(source.id)).map(file => ({ filename: file.filename, action: 'unchanged' }));
  }

  const reason = checksum ? `md5 ${source.remoteChecksum ?? 'sin registro'} → ${checksum}` : 'sin md5 de la fuente';
  console.log(`[SYNC] Fuente ${source.id} (${source.name ?? source.reference}): ${reason}, revisando archivos...`);
  const files = await handler.listFiles(source);
  const registered = new Map((await findFilesBySource(source.id)).map(file => [file.filename, file]));
  const results: FileSyncResult[] = [];

  for (const [i, file] of files.entries()) {
    const step = `[${i + 1}/${files.length}]`;
    const record = registered.get(file.filename);
    registered.delete(file.filename);

    const input: RagFileInput = {
      filename: file.filename,
      md5sum: md5(file.content),
      sizeBytes: Buffer.byteLength(file.content),
      origin: source.type,
      systemId: source.systemId,
      sourceId: source.id,
      ragDocumentId: null,
      metadata: file.metadata,
    };

    try {
      let action: FileAction;
      if (record && record.md5sum === input.md5sum) {
        action = 'unchanged';
      } else {
        const { documentId } = await indexDocument(source.systemId, file.filename, file.content, file.metadata);
        input.ragDocumentId = documentId;
        if (record) {
          await updateFileContent(record.id, input);
          action = 'updated';
        } else {
          await insertFile(input);
          action = 'created';
        }
      }
      console.log(`[SYNC] ${step} "${file.filename}" (md5 ${input.md5sum}, ${input.sizeBytes} bytes): ${ACTION_LOG[action]}`);
      results.push({ filename: file.filename, action });
    } catch (error) {
      console.error(`[SYNC] ${step} "${file.filename}": error al sincronizar:`, error);
      results.push({ filename: file.filename, action: 'error', error: String(error) });
    }
  }

  // Lo que queda en el registro ya no existe en el origen (pestaña borrada o renombrada).
  for (const record of registered.values()) {
    try {
      if (record.ragDocumentId) await deleteDocument(source.systemId, record.ragDocumentId);
      await deleteFile(record.id);
      console.log(`[SYNC] "${record.filename}": ${ACTION_LOG.deleted}`);
      results.push({ filename: record.filename, action: 'deleted' });
    } catch (error) {
      console.error(`[SYNC] "${record.filename}": error al eliminar:`, error);
      results.push({ filename: record.filename, action: 'error', error: String(error) });
    }
  }

  // Solo se guarda si todo quedó en el RAG; si hubo errores, la próxima revisión vuelve a intentar.
  if (checksum && !results.some(result => result.action === 'error')) {
    await updateRemoteChecksum(source.id, checksum);
  }
  return results;
}

// Sincroniza todas las fuentes de un sistema (o de todos). Los errores se registran y no detienen la sincronización.
export async function syncSystems(systemId?: string): Promise<SystemSyncResult[]> {
  const sources = await findActiveSources(systemId);
  const bySystem = new Map<string, FileSyncResult[]>();

  for (const source of sources) {
    let files: FileSyncResult[];
    try {
      files = await syncSource(source);
    } catch (error) {
      console.error(`[SYNC] Error sincronizando la fuente ${source.id} (${source.name ?? source.reference}):`, error);
      files = [{ filename: source.name ?? source.reference, action: 'error', error: String(error) }];
    }
    bySystem.set(source.systemId, [...(bySystem.get(source.systemId) ?? []), ...files]);
  }

  return [...bySystem].map(([id, files]) => ({ systemId: id, files }));
}

const inFlight = new Map<string, Promise<void>>();

// Antes de consultar el RAG: indexa lo que cambió. Nunca lanza error: si falla, se sigue con lo ya indexado.
// Las peticiones concurrentes del mismo sistema comparten la misma revisión.
export function ensureFresh(systemId: string): Promise<void> {
  const running = inFlight.get(systemId);
  if (running) return running;

  const check = syncSystems(systemId)
    .then(() => undefined)
    .catch(error => {
      console.error(`[SYNC] No se pudo revisar el sistema ${systemId}, se usa lo ya indexado en el RAG:`, error);
    })
    .finally(() => inFlight.delete(systemId));

  inFlight.set(systemId, check);
  return check;
}

// Compatibilidad: la planilla configurada en SHEETS_SPREADSHEET_ID queda registrada como fuente de RAG_SYSTEM_ID.
export async function registerEnvSources(): Promise<void> {
  const spreadsheetId = process.env.SHEETS_SPREADSHEET_ID;
  const systemId = process.env.RAG_SYSTEM_ID;
  if (!spreadsheetId || !systemId) return;

  try {
    await ensureSource('google-sheet', spreadsheetId, systemId, null);
    console.log(`[SYNC] Fuente google-sheet ${spreadsheetId} registrada para el sistema ${systemId}.`);
  } catch (error) {
    console.error('[SYNC] No se pudo registrar SHEETS_SPREADSHEET_ID como fuente (¿MySQL disponible?):', error);
  }
}
