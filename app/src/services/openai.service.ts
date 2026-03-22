import OpenAI from "openai";

// Carga la clave de API desde las variables de entorno
const oaiApiKey = process.env.OPENAI_API_KEY || '';

if (!oaiApiKey) {
  throw new Error('La clave de API de OPENAI no está definida en las variables de entorno.');
}
const openai = new OpenAI({ apiKey: oaiApiKey, });

// Función para generar contenido
export async function generateContent(prompt: string, modelg: string = 'gpt-5-nano') {
  try {
    console.log('Generando contenido con la API de OPENAI...');
    const response = openai.responses.create({
      model: modelg,
      input: prompt,
      store: true,
    });

    text = await response.output_text;
    return text;
  } catch (error) {
    console.error('Error al llamar a la API de Gemini:', error);
    throw new Error('No se pudo generar el contenido.');
  }
}