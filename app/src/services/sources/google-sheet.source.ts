import { createHash } from 'node:crypto';
import { google } from 'googleapis';
import type { RagSource } from '../../db/rag-sources.repository.ts';
import type { DynamicSource, SourceFile } from './source.types.ts';

const auth = new google.auth.GoogleAuth({
  keyFile: 'credentials.json',
  // drive.readonly es necesario para el endpoint de exportación a CSV.
  scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly', 'https://www.googleapis.com/auth/drive.readonly'],
});

const EXPORT_MAX_RETRIES = 5;

interface SheetTab {
  spreadsheetId: string;
  spreadsheetTitle: string;
  title: string;
  gid: number;
  merges: CellRange[];
}

// Parsea CSV (RFC 4180) a filas.
export function parseCsv(csv: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;

  for (let i = 0; i < csv.length; i++) {
    const char = csv[i];
    if (quoted) {
      if (char === '"' && csv[i + 1] === '"') {
        field += '"';
        i++;
      } else if (char === '"') {
        quoted = false;
      } else {
        field += char;
      }
    } else if (char === '"') {
      quoted = true;
    } else if (char === ',') {
      row.push(field);
      field = '';
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && csv[i + 1] === '\n') i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else {
      field += char;
    }
  }
  if (field !== '' || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

// Rango de celdas con fin exclusivo (mismo formato que GridRange de la API de Sheets).
export interface CellRange {
  startRow: number;
  endRow: number;
  startCol: number;
  endCol: number;
}

// Montos, números, porcentajes y casillas de verificación: valores, nunca etiquetas de encabezado.
const VALUE_PATTERN = /^([-+]?\$?\s?-?[\d.,]+\s?%?|TRUE|FALSE)$/i;
const isValue = (text: string) => VALUE_PATTERN.test(text);

const range = (start: number, end: number) => Array.from({ length: Math.max(0, end - start) }, (_, i) => start + i);
const inline = (text: string) => text.replace(/\s*\r?\n\s*/g, ' ');

// Grilla de la pestaña. Una celda combinada cuenta como ocupada en todo su rango, pero su valor
// solo está en la celda superior izquierda (no se repite en cada fila del rango).
function createGrid(csv: string, merges: CellRange[]) {
  const rows = parseCsv(csv);
  const height = rows.length;
  const width = Math.max(0, ...rows.map(row => row.length));
  const value = (r: number, c: number) => (rows[r]?.[c] ?? '').trim();

  const occupied = rows.map((_, r) => range(0, width).map(c => value(r, c) !== ''));
  for (const merge of merges) {
    if (value(merge.startRow, merge.startCol) === '') continue;
    for (const r of range(merge.startRow, Math.min(merge.endRow, height))) {
      for (const c of range(merge.startCol, Math.min(merge.endCol, width))) {
        const row = occupied[r];
        if (row) row[c] = true;
      }
    }
  }

  return {
    area: { startRow: 0, endRow: height, startCol: 0, endCol: width },
    value,
    isOccupied: (r: number, c: number) => occupied[r]?.[c] === true,
    // Celda combinada en horizontal (título o subtítulo que abarca varias columnas).
    spansColumns: (r: number, c: number) => merges.some(m => m.startRow === r && m.startCol === c && m.endCol - m.startCol > 1),
    mergesInRow: (r: number) => merges.filter(m => m.startRow === r),
    // Valor de una celda combinada en vertical que cubre (r, c) desde una fila anterior.
    valueFromAbove: (r: number, c: number) => {
      const merge = merges.find(m => m.startRow < r && r < m.endRow && m.startCol <= c && c < m.endCol);
      return merge ? value(merge.startRow, merge.startCol) : '';
    },
  };
}

type Grid = ReturnType<typeof createGrid>;

// Tramos consecutivos de índices ocupados: los índices vacíos separan bloques.
function segments(indexes: number[], filled: (i: number) => boolean): [number, number][] {
  const result: [number, number][] = [];
  for (const i of indexes) {
    const last = result[result.length - 1];
    if (!filled(i)) continue;
    if (last && last[1] === i) last[1] = i + 1;
    else result.push([i, i + 1]);
  }
  return result;
}

// Corte recursivo X-Y: separa por columnas vacías (tablas lado a lado) y luego por filas vacías
// (tablas una debajo de otra). Orden: de izquierda a derecha y, en cada columna, de arriba abajo.
function splitBlocks(grid: Grid, area: CellRange): CellRange[] {
  const rows = range(area.startRow, area.endRow);
  const cols = range(area.startCol, area.endCol);

  const colSegments = segments(cols, c => rows.some(r => grid.isOccupied(r, c)));
  if (colSegments.length > 1) {
    return colSegments.flatMap(([startCol, endCol]) => splitBlocks(grid, { ...area, startCol, endCol }));
  }
  const [colSegment] = colSegments;
  if (!colSegment) return [];

  const [startCol, endCol] = colSegment;
  const rowSegments = segments(rows, r => range(startCol, endCol).some(c => grid.isOccupied(r, c)));
  if (rowSegments.length > 1) {
    return rowSegments.flatMap(([startRow, endRow]) => splitBlocks(grid, { startRow, endRow, startCol, endCol }));
  }
  const [rowSegment] = rowSegments;
  return rowSegment ? [{ startRow: rowSegment[0], endRow: rowSegment[1], startCol, endCol }] : [];
}

// Un bloque que empieza directo con datos (ni título ni encabezado) y está justo debajo de otro,
// desde su misma primera columna y dentro de sus columnas, es la continuación de ese bloque tras una
// fila vacía: se unen para que conserve el título y las etiquetas (ej. "Entradas de dinero" en
// Kermesse, "TOTAL FINAL" en Pre-supuesto).
function joinContinuations(grid: Grid, blocks: CellRange[]): CellRange[] {
  const joined: CellRange[] = [];
  for (const block of blocks) {
    const previous = joined[joined.length - 1];
    const firstRow = range(block.startRow, block.endRow).find(r => range(block.startCol, block.endCol).some(c => grid.value(r, c) !== ''));
    const cells = firstRow === undefined ? [] : range(block.startCol, block.endCol).map(c => grid.value(firstRow, c)).filter(Boolean);
    const startsWithData = cells.length >= 2 && cells.some(isValue);
    const below = previous && block.startRow >= previous.endRow && block.startCol === previous.startCol && block.endCol <= previous.endCol;

    if (previous && below && startsWithData) previous.endRow = block.endRow;
    else joined.push({ ...block });
  }
  return joined;
}

// Etiquetas de un encabezado. Un encabezado combinado sobre varias columnas con una fila de
// subencabezados debajo (encabezado de 2 niveles) se une como "Superior - Inferior".
function headerLabels(grid: Grid, cols: number[], header: number, next: number | undefined): { labels: string[]; usesNext: boolean } {
  const labels = cols.map(c => inline(grid.value(header, c)));
  const spans = grid.mergesInRow(header).filter(m => m.endCol - m.startCol > 1 && cols.includes(m.startCol));
  for (const merge of spans) {
    const top = labels[cols.indexOf(merge.startCol)] ?? '';
    for (const c of range(merge.startCol + 1, merge.endCol)) {
      if (cols.includes(c)) labels[cols.indexOf(c)] = top;
    }
  }

  const sub = next === undefined ? [] : cols.map(c => inline(grid.value(next, c)));
  const usesNext = spans.length > 0 && sub.some(text => text !== '') && !sub.some(isValue);
  return {
    labels: labels.map((label, i) => {
      const parts = [label, usesNext ? sub[i] ?? '' : ''].filter((part, j, all) => part !== '' && all.indexOf(part) === j);
      return parts.join(' - ') || `Columna ${i + 1}`;
    }),
    usesNext,
  };
}

// Convierte un bloque en Markdown de registros: cada fila es una lista "- **Etiqueta:** valor"
// con solo las celdas con valor, y los registros se separan por una línea en blanco.
function blockToMarkdown(grid: Grid, area: CellRange, nextTableTitle: () => string): string {
  const cols = range(area.startCol, area.endCol);
  const filled = (r: number) => cols.filter(c => grid.value(r, c) !== '');
  const rows = range(area.startRow, area.endRow).filter(r => filled(r).length > 0);
  const valueCols = cols.filter(c => rows.some(r => grid.value(r, c) !== ''));
  const isSubtitle = (r: number) => filled(r).length === 1 && grid.spansColumns(r, filled(r)[0] ?? -1);
  const chunks: string[] = [];

  const [onlyCol] = valueCols;
  if (valueCols.length === 1 && onlyCol !== undefined) {
    // Una sola columna: si alterna etiqueta/valor se arman pares; si no, una línea por celda.
    // Si no son pares, una primera celda combinada en horizontal es el título del bloque.
    let values = rows.map(r => grid.value(r, onlyCol));
    const paired = values.length % 2 === 0 && values.every((text, i) => isValue(text) === (i % 2 === 1));
    const [titleRow] = rows;
    const hasTitle = !paired && values.length > 1 && titleRow !== undefined && grid.spansColumns(titleRow, onlyCol);
    const title = hasTitle ? inline(values[0] ?? '') : nextTableTitle();
    if (hasTitle) values = values.slice(1);
    chunks.push(paired
      ? range(0, values.length / 2).map(i => `- **${inline(values[2 * i] ?? '')}:** ${inline(values[2 * i + 1] ?? '')}`).join('\n')
      : values.flatMap(text => text.split(/\r?\n/)).map(line => line.trim()).filter(Boolean).map(line => `- ${line}`).join('\n'));
    return [`## ${title}`, ...chunks].join('\n\n');
  }

  // La primera fila con una sola celda es el título del bloque.
  const [first] = rows;
  const hasTitle = first !== undefined && filled(first).length === 1;
  const title = hasTitle ? inline(grid.value(first, filled(first)[0] ?? 0)) : nextTableTitle();
  const body = hasTitle ? rows.slice(1) : rows;

  const [header, next] = body;
  const isHeader = header !== undefined && filled(header).length >= 2 && !filled(header).some(c => isValue(grid.value(header, c)));

  if (isHeader) {
    const { labels, usesNext } = headerLabels(grid, cols, header, next);
    for (const r of body.slice(usesNext ? 2 : 1)) {
      if (isSubtitle(r)) {
        chunks.push(`### ${inline(grid.value(r, filled(r)[0] ?? 0))}`);
        continue;
      }
      chunks.push(filled(r).map(c => `- **${labels[cols.indexOf(c)]}:** ${inline(grid.value(r, c))}`).join('\n'));
    }
  } else {
    // Bloque etiqueta/valor: la primera celda de cada fila es la etiqueta y el resto sus valores.
    let items: string[] = [];
    const flush = () => {
      if (items.length > 0) chunks.push(items.join('\n'));
      items = [];
    };
    for (const r of body) {
      // Si la etiqueta está combinada en vertical (ej. "Ventas" en varias filas), se usa en cada fila.
      const above = grid.value(r, area.startCol) === '' ? grid.valueFromAbove(r, area.startCol) : '';
      const [label = '', ...values] = [above, ...filled(r).map(c => grid.value(r, c))].filter(text => text !== '');
      if (isSubtitle(r)) {
        flush();
        chunks.push(`### ${inline(label)}`);
      } else if (values.length === 0) {
        items.push(...label.split(/\r?\n/).map(line => line.trim()).filter(Boolean).map(line => `- ${line}`));
      } else {
        items.push(`- **${inline(label)}:** ${values.map(inline).join(' · ')}`);
      }
    }
    flush();
  }

  return [`## ${title}`, ...chunks].join('\n\n');
}

// Convierte la pestaña (CSV + celdas combinadas) en Markdown de registros, sin tablas. Las tablas
// que están lado a lado en la pestaña quedan como secciones, una debajo de otra.
export function sheetToMarkdown(csv: string, merges: CellRange[], title: string): string {
  const grid = createGrid(csv, merges);
  const blocks = joinContinuations(grid, splitBlocks(grid, grid.area));
  if (blocks.length === 0) return '';

  let tables = 0;
  const nextTableTitle = () => `Tabla ${++tables}`;
  return [`# ${title}`, ...blocks.map(block => blockToMarkdown(grid, block, nextTableTitle)), ''].join('\n\n');
}

// Nombre del archivo que representa a la pestaña: "Nombre Excel"_"Nombre Pestaña", sin espacios.
function tabFilename(spreadsheetTitle: string, title: string): string {
  return `${spreadsheetTitle}_${title}`.trim().replace(/\s+/g, '_') + '.md';
}

// Lista las pestañas de la planilla con su gid (id de la hoja), necesario para exportarlas como CSV,
// y sus celdas combinadas (en el CSV solo la primera celda del rango trae el valor).
async function listTabs(spreadsheetId: string): Promise<SheetTab[]> {
  const sheets = google.sheets({ version: 'v4', auth });
  const metadata = await sheets.spreadsheets.get({ spreadsheetId, fields: 'properties.title,sheets(properties(sheetId,title),merges)' });

  const spreadsheetTitle = metadata.data.properties?.title || spreadsheetId;
  return (metadata.data.sheets ?? [])
    .map(s => ({
      spreadsheetId,
      spreadsheetTitle,
      title: s.properties?.title ?? '',
      gid: s.properties?.sheetId ?? 0,
      merges: (s.merges ?? []).map(m => ({
        startRow: m.startRowIndex ?? 0,
        endRow: m.endRowIndex ?? 0,
        startCol: m.startColumnIndex ?? 0,
        endCol: m.endColumnIndex ?? 0,
      })),
    }))
    .filter(tab => tab.title !== '');
}

// Descarga una pestaña como CSV usando el endpoint de exportación de Google Sheets.
async function downloadTabCsv(tab: SheetTab): Promise<string> {
  const url = `https://docs.google.com/spreadsheets/d/${tab.spreadsheetId}/export?format=csv&gid=${tab.gid}`;
  let response = await fetch(url, { headers: await auth.getRequestHeaders() });

  // El endpoint de exportación limita la tasa de descargas (429): se reintenta con espera exponencial.
  for (let attempt = 0; response.status === 429 && attempt < EXPORT_MAX_RETRIES; attempt++) {
    const retryAfter = Number(response.headers.get('retry-after'));
    const delayMs = retryAfter > 0 ? retryAfter * 1000 : 2 ** attempt * 1000;
    console.warn(`[SHEETS] Límite de Google al exportar "${tab.title}", reintentando en ${delayMs} ms...`);
    await new Promise(resolve => setTimeout(resolve, delayMs));
    response = await fetch(url, { headers: await auth.getRequestHeaders() });
  }

  if (!response.ok) {
    throw new Error(`Google Sheets respondió ${response.status} al exportar "${tab.title}" como CSV.`);
  }
  return response.text();
}

// Cada pestaña de la planilla es un archivo aparte (CSV → registros Markdown); la planilla completa nunca se sube.
export const googleSheetSource: DynamicSource = {
  // Una sola llamada a la API de Sheets trae los nombres de las pestañas, sus celdas combinadas y los
  // valores tal como se ven (lo mismo que define el Markdown). No sirve el md5 de la exportación
  // xlsx/ods: Google incluye la fecha de exportación y cambia en cada descarga.
  async getChecksum(source: RagSource) {
    const sheets = google.sheets({ version: 'v4', auth });
    const content = await sheets.spreadsheets.get({
      spreadsheetId: source.reference,
      includeGridData: true,
      fields: 'properties.title,sheets(properties(sheetId,title),merges,data.rowData.values.formattedValue)',
    });
    return createHash('md5').update(JSON.stringify(content.data)).digest('hex');
  },

  async listFiles(source: RagSource) {
    const tabs = await listTabs(source.reference);
    console.log(`[SHEETS] Planilla ${source.reference}: ${tabs.length} pestañas (${tabs.map(t => `"${t.title}"`).join(', ')})`);

    const files: SourceFile[] = [];
    for (const tab of tabs) {
      const csv = await downloadTabCsv(tab);
      const content = sheetToMarkdown(csv, tab.merges, `${tab.spreadsheetTitle} - ${tab.title}`);
      if (!content) {
        console.log(`[SHEETS] Pestaña "${tab.title}" vacía, no se envía al RAG.`);
        continue;
      }
      files.push({
        filename: tabFilename(tab.spreadsheetTitle, tab.title),
        content,
        metadata: { origen: 'google-sheets', spreadsheetId: tab.spreadsheetId, planilla: tab.spreadsheetTitle, pestana: tab.title },
      });
    }
    return files;
  },
};
