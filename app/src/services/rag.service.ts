const DEFAULT_TOP_K = 10;
const DEFAULT_TIMEOUT_MS = 10000;
const INDEX_TIMEOUT_MS = 60000;

export interface IndexResult {
  status: 'created' | 'unchanged' | 'reindexed' | 'duplicate';
  documentId: string;
}

interface RagContextResponse {
  mode: 'search' | 'full';
  context: string;
  truncated: boolean;
}

// API keys por sistema: RAG_API_KEYS='{"<system_id>":"<api_key>"}'. RAG_API_KEY aplica al sistema por defecto.
function resolveApiKey(systemId: string): string | undefined {
  const keys = process.env.RAG_API_KEYS;
  if (keys) {
    try {
      const map = JSON.parse(keys) as Record<string, string>;
      if (map[systemId]) return map[systemId];
    } catch {
      console.error('[RAG] RAG_API_KEYS no es un JSON válido.');
    }
  }
  return systemId === process.env.RAG_SYSTEM_ID ? process.env.RAG_API_KEY : undefined;
}

export function resolveSystemId(systemId?: string): string | undefined {
  return systemId || process.env.RAG_SYSTEM_ID;
}

function resolveConfig(systemId: string): { baseUrl: string; apiKey: string } | undefined {
  const baseUrl = process.env.RAG_API_URL;
  if (!baseUrl) {
    console.warn('[RAG] RAG_API_URL no está definida, se omite la RAG API.');
    return undefined;
  }

  const apiKey = resolveApiKey(systemId);
  if (!apiKey) {
    console.warn(`[RAG] No hay API key configurada para el sistema ${systemId}, se omite la RAG API.`);
    return undefined;
  }

  return { baseUrl, apiKey };
}

// Indexa (o re-indexa) un documento. La RAG API es idempotente: si el contenido no cambió responde "unchanged".
export async function indexDocument(
  systemId: string,
  filename: string,
  content: string,
  metadata?: Record<string, unknown>,
  contentType = 'text/markdown',
): Promise<IndexResult> {
  const config = resolveConfig(systemId);
  if (!config) throw new Error(`RAG API sin configurar para el sistema ${systemId}.`);
  const { baseUrl, apiKey } = config;

  const form = new FormData();
  form.append('file', new Blob([content], { type: contentType }), filename);
  if (metadata) form.append('metadata', JSON.stringify(metadata));

  const url = new URL(`/api/v1/systems/${encodeURIComponent(systemId)}/documents`, baseUrl);
  console.log(`[RAG] POST ${url} → vectorizando "${filename}" (${content.length} caracteres)`);
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'X-API-Key': apiKey },
    body: form,
    signal: AbortSignal.timeout(INDEX_TIMEOUT_MS),
  });
  console.log(`[RAG] POST ${url} ← HTTP ${response.status} para "${filename}"`);

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`RAG API respondió ${response.status} al indexar: ${body}`);
  }

  const data = (await response.json()) as { status: IndexResult['status']; document: { document_id: string } };
  return { status: data.status, documentId: data.document.document_id };
}

export async function deleteDocument(systemId: string, documentId: string): Promise<void> {
  const config = resolveConfig(systemId);
  if (!config) throw new Error(`RAG API sin configurar para el sistema ${systemId}.`);
  const { baseUrl, apiKey } = config;

  const url = new URL(`/api/v1/systems/${encodeURIComponent(systemId)}/documents/${encodeURIComponent(documentId)}`, baseUrl);
  console.log(`[RAG] DELETE ${url}`);
  const response = await fetch(url, {
    method: 'DELETE',
    headers: { 'X-API-Key': apiKey },
    signal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS),
  });
  console.log(`[RAG] DELETE ${url} ← HTTP ${response.status}`);

  // 404: el documento ya no existe en el RAG, el resultado es el mismo.
  if (!response.ok && response.status !== 404) {
    const body = await response.text();
    throw new Error(`RAG API respondió ${response.status} al eliminar: ${body}`);
  }
}

export async function fetchRagContext(query: string, systemId: string): Promise<string> {
  const config = resolveConfig(systemId);
  if (!config) return '';
  const { baseUrl, apiKey } = config;

  const topK = process.env.RAG_TOP_K ? parseInt(process.env.RAG_TOP_K) : DEFAULT_TOP_K;
  const url = new URL(`/api/v1/systems/${encodeURIComponent(systemId)}/context`, baseUrl);
  url.searchParams.set('query', query.slice(0, 2000));
  url.searchParams.set('top_k', String(topK));

  const response = await fetch(url, {
    headers: { 'X-API-Key': apiKey },
    signal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`RAG API respondió ${response.status}: ${body}`);
  }

  const data = (await response.json()) as RagContextResponse;
  return data.context ?? '';
}

// Enriquece el prompt con el contexto del sistema. Si no hay sistema, contexto o la RAG-API falla, devuelve el prompt original.
export async function buildRagPrompt(prompt: string, systemId?: string): Promise<string> {
  const system = resolveSystemId(systemId);
  if (!system) return prompt;

  try {
    const context = await fetchRagContext(prompt, system);
    console.log(`[RAG] sistema: ${system}, contexto: ${context.length} caracteres`);
    if (!context.trim()) return prompt;

    return `Responde usando la información del contexto. Si no está, di que no lo sabes.\n\n<contexto>\n${context}\n</contexto>\n\nPregunta: ${prompt}`;
  } catch (error) {
    console.error('[RAG] Error consultando la RAG API:', error);
    return prompt;
  }
}
