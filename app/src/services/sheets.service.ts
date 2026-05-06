import { google } from 'googleapis';

const auth = new google.auth.GoogleAuth({
  keyFile: 'credentials.json',
  scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
});

export async function buildSheetsPrompt(prompt: string): Promise<string> {
  const spreadsheetId = process.env.SHEETS_SPREADSHEET_ID;
  if (!spreadsheetId) {
    throw new Error('SHEETS_SPREADSHEET_ID no está definida en las variables de entorno.');
  }

  const sheets = google.sheets({ version: 'v4', auth });
  const metadata = await sheets.spreadsheets.get({ spreadsheetId });

  const sheetTitles = metadata.data.sheets?.map(s => s.properties?.title ?? '') ?? [];

  let context = '';
  for (const title of sheetTitles) {
    const res = await sheets.spreadsheets.values.get({ spreadsheetId, range: `${title}!A:Z` });
    if (res.data.values) {
      context += `\n--- HOJA: ${title} ---\n`;
      context += res.data.values.map(row => row.join(' | ')).join('\n');
    }
  }

  return `Eres un asistente contable para el curso 3° A y B. Aquí tienes los datos actuales de la tesorería:\n${context}\n\nPregunta del usuario: ${prompt}`;
}
