import type { RowDataPacket } from 'mysql2/promise';
import { getPool } from './pool.ts';

export interface RagSource {
  id: number;
  type: string;
  reference: string;
  systemId: string;
  name: string | null;
  remoteChecksum: string | null;
}

interface RagSourceRow extends RowDataPacket {
  id: number;
  type: string;
  reference: string;
  system_id: string;
  name: string | null;
  remote_checksum: string | null;
}

const toSource = (row: RagSourceRow): RagSource => ({
  id: row.id,
  type: row.type,
  reference: row.reference,
  systemId: row.system_id,
  name: row.name,
  remoteChecksum: row.remote_checksum,
});

export async function findActiveSources(systemId?: string): Promise<RagSource[]> {
  const [rows] = systemId
    ? await getPool().query<RagSourceRow[]>('SELECT * FROM rag_sources WHERE active = 1 AND system_id = ? ORDER BY id', [systemId])
    : await getPool().query<RagSourceRow[]>('SELECT * FROM rag_sources WHERE active = 1 ORDER BY system_id, id');
  return rows.map(toSource);
}

// Registra una fuente si no existe (idempotente).
export async function ensureSource(type: string, reference: string, systemId: string, name: string | null): Promise<void> {
  await getPool().query(
    'INSERT INTO rag_sources (type, reference, system_id, name) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE id = id',
    [type, reference, systemId, name],
  );
}

export async function updateRemoteChecksum(sourceId: number, checksum: string): Promise<void> {
  await getPool().query('UPDATE rag_sources SET remote_checksum = ? WHERE id = ?', [checksum, sourceId]);
}
