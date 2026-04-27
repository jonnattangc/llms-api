import { GoogleGenerativeAI } from '@google/generative-ai';
import { google } from 'googleapis';

// Carga la clave de API desde las variables de entorno
const apiKey = process.env.GEMINI_API_KEY || '';

if (!apiKey) {
  throw new Error('La clave de API de Gemini no está definida en las variables de entorno.');
}

const genAI = new GoogleGenerativeAI(apiKey);

const auth = new google.auth.GoogleAuth({
  keyFile: 'credentials.json',
  scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
});

// Función para generar contenido
export async function generateContent(prompt: string, modelg: string = 'gemini-3-flash-preview', asistantType: string) {
  try {
    console.log('Generando contenido con la API de Gemini...');
    
    let instructions = 'Eres un asistente de chat, respondes de forma divertida';
    let promptFinal = prompt;

    if (asistantType != 'chat') {
      instructions = asistantType;
      promptFinal = await question_to_excel(prompt);  
    } else {
      console.log('Generando contenido con: ', instructions);
    }

    const model = genAI.getGenerativeModel({
        model: modelg,
        systemInstruction: instructions,
      });

    const result = await model.generateContent(promptFinal);

    const response = await result.response;
    const text = response.text();
    return text;
  } catch (error) {
    console.error('Error al llamar a la API de Gemini:', error);
    throw new Error('No se pudo generar el contenido.');
  }
}

async function question_to_excel(prompt: string) {
  // 1. Conectar a la API de Google Sheets
  console.log('############## Conectando a la API de Google Sheets...');
  const sheets = google.sheets({ version: 'v4', auth });
  console.log('############## Conectado a la API de Google Sheets.');

  const spreadsheetId = '1Pwp_UFpoi0bjV2KGCEEAMDhjunO-b5jLEX9sAw0oYJQ'; // Lo sacas de la URL del navegador
  console.log(`############## Leyendo los datos de la hoja ${spreadsheetId}`);

  try {

    const metadata = await sheets.spreadsheets.get({ spreadsheetId, });
    
    const tiles_names = metadata.data.sheets.map(s => s.properties.title);

    let allContext = "";

    for (const tile_name of tiles_names) {
      const res = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: `${tile_name}!A:Z`,
      });

      if (res.data.values) {
        allContext += `\n--- HOJA: ${tile_name} ---\n`;
        allContext += res.data.values.map(fila => fila.join(" | ")).join("\n");
      }
    }
    
    return `Eres un asistente contable para el curso 3° A y B. Aquí tienes los datos actuales de la tesorería:
      ${allContext} y la pregunta del usuario es: ${prompt}`;

  } catch (error) {
    console.error("Error detallado:", error);
  }
}