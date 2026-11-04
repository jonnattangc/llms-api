import type { RowDataPacket } from 'mysql2/promise';
import { getPool } from './pool.ts';

export interface RagFile {
  id: number;
  filename: string;
  md5sum: string;
  sizeBytes: number;
  origin: string;
  systemId: string;
  sourceId: number;
  ragDocumentId: string | null;
  createdAt: Date;
  lastIndexedAt: Date | null;
  updateCount: number;
  metadata: Record<string, unknown> | null;
}

export interface RagFileInput {
  filename: string;
  md5sum: string;
  sizeBytes: number;
  origin: string;
  systemId: string;
  sourceId: number;
  ragDocumentId: string | null;
  metadata: Record<string, unknown>;
}

interface RagFileRow extends RowDataPacket {
  id: number;
  filename: string;
  md5sum: string;
  size_bytes: number;
  origin: string;
  system_id: string;
  source_id: number;
  rag_document_id: string | null;
  created_at: Date;
  last_indexed_at: Date | null;
  update_count: number;
  metadata: Record<string, unknown> | null;
}

const toFile = (row: RagFileRow): RagFile => ({
  id: row.id,
  filename: row.filename,
  md5sum: row.md5sum,
  sizeBytes: row.size_bytes,
  origin: row.origin,
  systemId: row.system_id,
  sourceId: row.source_id,
  ragDocumentId: row.rag_document_id,
  createdAt: row.created_at,
  lastIndexedAt: row.last_indexed_at,
  updateCount: row.update_count,
  metadata: row.metadata,
});

export async function findFilesBySource(sourceId: number): Promise<RagFile[]> {
  const [rows] = await getPool().query<RagFileRow[]>('SELECT * FROM rag_files WHERE source_id = ? ORDER BY id', [sourceId]);
  return rows.map(toFile);
}

export async function insertFile(file: RagFileInput): Promise<void> {
  await getPool().query(
    `INSERT INTO rag_files (filename, md5sum, size_bytes, origin, system_id, source_id, rag_document_id, last_indexed_at, metadata)
     VALUES (?, ?, ?, ?, ?, ?, ?, UTC_TIMESTAMP(), ?)`,
    [file.filename, file.md5sum, file.sizeBytes, file.origin, file.systemId, file.sourceId, file.ragDocumentId, JSON.stringify(file.metadata)],
  );
}

// El contenido cambió: se actualiza el md5 y se suma una actualización.
export async function updateFileContent(id: number, file: RagFileInput): Promise<void> {
  await getPool().query(
    `UPDATE rag_files
     SET md5sum = ?, size_bytes = ?, rag_document_id = COALESCE(?, rag_document_id), metadata = ?,
         last_indexed_at = UTC_TIMESTAMP(), update_count = update_count + 1
     WHERE id = ?`,
    [file.md5sum, file.sizeBytes, file.ragDocumentId, JSON.stringify(file.metadata), id],
  );
}

export async function deleteFile(id: number): Promise<void> {
  await getPool().query('DELETE FROM rag_files WHERE id = ?', [id]);
}
