import type { RagSource } from '../../db/rag-sources.repository.ts';

// Archivo ya preprocesado, listo para enviar al RAG.
export interface SourceFile {
  filename: string;
  content: string;
  metadata: Record<string, unknown>;
}

// Cada tipo de fuente dinámica (Google Sheets, Drive, etc.) se implementa igual.
export interface DynamicSource {
  // md5 del contenido de la fuente, obtenido con una sola consulta liviana. Si es igual al de la
  // última sincronización, la fuente no se descarga ni se procesa.
  getChecksum(source: RagSource): Promise<string>;
  // Descarga y preprocesa la fuente en los archivos que se suben al RAG.
  listFiles(source: RagSource): Promise<SourceFile[]>;
}
