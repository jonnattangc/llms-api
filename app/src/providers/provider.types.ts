export interface GenerateParams {
  model: string;
  system: string;
  prompt: string;
}

// Contrato común a todos los LLM: cada proveedor se implementa igual y es intercambiable.
export interface LlmProvider {
  name: string;
  models: string[];
  // Instrucción de sistema cuando assistantType es 'chat'.
  defaultInstruction: string;
  generate(params: GenerateParams): Promise<string>;
}

export class ProviderNotConfiguredError extends Error {
  constructor(provider: string, envVar: string) {
    super(`El proveedor "${provider}" no está configurado: falta ${envVar}.`);
    this.name = 'ProviderNotConfiguredError';
  }
}

export const FUN_INSTRUCTION = 'Eres un asistente de chat, respondes de forma divertida';
export const FORMAL_INSTRUCTION = 'Eres un asistente de chat, respondes de manera formal';

// Crea el cliente la primera vez que se usa, para que un proveedor sin API key no impida iniciar la API.
export function lazyClient<T>(provider: string, envVar: string, create: (apiKey: string) => T): () => T {
  let client: T | undefined;
  return () => {
    if (client) return client;
    const apiKey = process.env[envVar];
    if (!apiKey) throw new ProviderNotConfiguredError(provider, envVar);
    client = create(apiKey);
    return client;
  };
}
