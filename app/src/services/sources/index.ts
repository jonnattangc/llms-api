import { googleSheetSource } from './google-sheet.source.ts';
import type { DynamicSource } from './source.types.ts';

// Registro de tipos de fuente dinámica. El campo rag_sources.type indica cuál usar.
const sources: Record<string, DynamicSource> = {
  'google-sheet': googleSheetSource,
};

export function getSourceHandler(type: string): DynamicSource | undefined {
  return sources[type];
}
