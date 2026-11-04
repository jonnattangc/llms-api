import { getProvider } from '../providers/index.ts';
import { buildRagPrompt, resolveSystemId } from './rag.service.ts';
import { ensureFresh } from './rag-sync.service.ts';

export interface ChatRequest {
  provider: string;
  model: string;
  prompt: string;
  assistantType: string;
  isRAG?: boolean;
  systemId?: string;
}

export class UnknownProviderError extends Error {
  constructor(provider: string) {
    super(`Proveedor desconocido: "${provider}".`);
    this.name = 'UnknownProviderError';
  }
}

// Sin isRAG explícito se mantiene el comportamiento anterior: se usa el RAG cuando hay un sistema definido.
export function shouldUseRag(isRAG: boolean | undefined, systemId: string | undefined): boolean {
  return isRAG ?? Boolean(resolveSystemId(systemId));
}

// Orquesta una petición a cualquier LLM: [RAG: revisar cambios → contexto] → proveedor.
export async function generate(request: ChatRequest): Promise<string> {
  const provider = getProvider(request.provider);
  if (!provider) throw new UnknownProviderError(request.provider);

  const system = request.assistantType !== 'chat' ? request.assistantType : provider.defaultInstruction;
  let prompt = request.prompt;

  const systemId = resolveSystemId(request.systemId);
  if (shouldUseRag(request.isRAG, request.systemId) && systemId) {
    await ensureFresh(systemId);
    prompt = await buildRagPrompt(request.prompt, systemId);
  }

  console.log(`[${provider.name.toUpperCase()}] modelo: ${request.model}, assistantType: ${request.assistantType}, RAG: ${prompt !== request.prompt}`);
  return provider.generate({ model: request.model, system, prompt });
}
