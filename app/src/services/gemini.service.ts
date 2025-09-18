import { GoogleGenerativeAI } from '@google/generative-ai';

// Carga la clave de API desde las variables de entorno
const apiKey = process.env.GEMINI_API_KEY || '';

if (!apiKey) {
  throw new Error('La clave de API de Gemini no está definida en las variables de entorno.');
}

const genAI = new GoogleGenerativeAI(apiKey);

// Función para generar contenido
export async function generateContent(prompt: string, modelg: string = 'gemini-2.5-flash-lite') {
  try {
    const model = genAI.getGenerativeModel({ model: modelg });
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    return text;
  } catch (error) {
    console.error('Error al llamar a la API de Gemini:', error);
    throw new Error('No se pudo generar el contenido.');
  }
}