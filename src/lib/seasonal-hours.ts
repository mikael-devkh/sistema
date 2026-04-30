import type { SchedulingIssue, SeasonalStoreHours } from '../types/scheduling';

export interface SeasonalHoursParseResult {
  entries: SeasonalStoreHours[];
  skipped: number;
}

type FieldKey = 'loja' | 'date' | 'opensAt' | 'closesAt' | 'hours' | 'closed' | 'note';

const FIELD_ALIASES: Record<FieldKey, string[]> = {
  loja: ['loja', 'codigo', 'codigo loja', 'codigo da loja', 'cod', 'cod loja', 'codloja', 'store', 'filial'],
  date: ['data', 'dia', 'dt', 'data funcionamento', 'data sazonal'],
  opensAt: ['abertura', 'abre', 'hora abertura', 'horario abertura', 'inicio', 'hora inicio'],
  closesAt: ['fechamento', 'fecha', 'hora fechamento', 'horario fechamento', 'fim', 'hora fim'],
  hours: ['horario', 'horario funcionamento', 'funcionamento', 'expediente', 'periodo'],
  closed: ['fechado', 'loja fechada', 'status', 'situacao', 'abre nesta data'],
  note: ['observacao', 'obs', 'nota', 'comentario', 'motivo'],
};

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const BR_DATE_RE = /^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/;
const BR_MONTH_NAME_DATE_RE = /^(\d{1,2})\s*[/-]\s*([a-zç]{3,})$/i;
const TIME_RE = /(\d{1,2})(?::|h)?(\d{2})?/gi;

const MONTH_BY_NAME: Record<string, string> = {
  jan: '01',
  janeiro: '01',
  fev: '02',
  fevereiro: '02',
  mar: '03',
  marco: '03',
  abr: '04',
  abril: '04',
  mai: '05',
  maio: '05',
  jun: '06',
  junho: '06',
  jul: '07',
  julho: '07',
  ago: '08',
  agosto: '08',
  set: '09',
  setembro: '09',
  out: '10',
  outubro: '10',
  nov: '11',
  novembro: '11',
  dez: '12',
  dezembro: '12',
};

export function normalizeStoreCode(value: unknown): string {
  const raw = String(value ?? '').trim();
  if (!raw) return '';
  const digits = raw.match(/\d+/g)?.join('') ?? '';
  return digits.replace(/^0+(?=\d)/, '') || raw;
}

function normalizeText(value: unknown): string {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function parseExcelDate(value: number): string | null {
  if (!Number.isFinite(value)) return null;
  const excelEpoch = Date.UTC(1899, 11, 30);
  const date = new Date(excelEpoch + Math.round(value) * 86_400_000);
  if (Number.isNaN(date.getTime())) return null;
  return [
    String(date.getUTCFullYear()).padStart(4, '0'),
    String(date.getUTCMonth() + 1).padStart(2, '0'),
    String(date.getUTCDate()).padStart(2, '0'),
  ].join('-');
}

function fallbackYear(fallbackDate?: string): string {
  const match = fallbackDate?.match(DATE_RE);
  return match?.[1] ?? String(new Date().getFullYear());
}

function parseSeasonalDateOnly(value: unknown, fallbackDate?: string): string | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    const y = value.getFullYear();
    const m = String(value.getMonth() + 1).padStart(2, '0');
    const d = String(value.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    return parseExcelDate(value);
  }

  const raw = String(value ?? '').trim();
  if (!raw) return null;

  const iso = raw.match(DATE_RE);
  if (iso) return raw.slice(0, 10);

  const br = raw.match(BR_DATE_RE);
  if (br) {
    const [, dd, mm, yyyyRaw] = br;
    const yyyy = yyyyRaw.length === 2 ? `20${yyyyRaw}` : yyyyRaw;
    return `${yyyy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`;
  }

  const monthName = raw.match(BR_MONTH_NAME_DATE_RE);
  if (monthName) {
    const [, dd, monthRaw] = monthName;
    const month = MONTH_BY_NAME[normalizeText(monthRaw)];
    if (month) return `${fallbackYear(fallbackDate)}-${month}-${dd.padStart(2, '0')}`;
  }

  const parsed = new Date(raw);
  if (!Number.isNaN(parsed.getTime())) {
    const y = parsed.getFullYear();
    const m = String(parsed.getMonth() + 1).padStart(2, '0');
    const d = String(parsed.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  return null;
}

export function normalizeSeasonalDate(value: unknown, fallbackDate?: string): string {
  return parseSeasonalDateOnly(value, fallbackDate) ?? fallbackDate ?? '';
}

function normalizeTime(value: unknown): string {
  if (typeof value === 'number' && Number.isFinite(value)) {
    if (value > 0 && value < 1) {
      const minutes = Math.round(value * 24 * 60);
      const h = Math.floor(minutes / 60);
      const m = minutes % 60;
      return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    }
    if (value >= 0 && value <= 23) return `${String(Math.floor(value)).padStart(2, '0')}:00`;
  }

  const raw = String(value ?? '').trim();
  if (!raw) return '';
  const match = [...raw.matchAll(TIME_RE)][0];
  if (!match) return '';
  const hour = Math.min(Number(match[1]), 23);
  const minute = Math.min(Number(match[2] ?? '00'), 59);
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

function extractTimes(value: unknown): [string, string] {
  const raw = String(value ?? '');
  const matches = [...raw.matchAll(TIME_RE)].slice(0, 2);
  const first = matches[0] ? normalizeTime(matches[0][0]) : '';
  const second = matches[1] ? normalizeTime(matches[1][0]) : '';
  return [first, second];
}

function parseClosed(value: unknown, hoursValue?: unknown): boolean {
  const text = `${normalizeText(value)} ${normalizeText(hoursValue)}`.trim();
  if (!text) return false;
  if (/\baberto\b|\babre\b|\bnormal\b/.test(text) && !/\bnao abre\b/.test(text)) return false;
  return /\bfechad[oa]\b|\bfecha\b|\bclosed\b|\bnao abre\b|\bsem funcionamento\b|\bsim\b|\byes\b|\btrue\b|\b1\b/.test(text);
}

function findColumn(headers: string[], key: FieldKey): string | undefined {
  const aliases = FIELD_ALIASES[key].map(normalizeText);
  return headers.find(header => {
    const normalized = normalizeText(header);
    return aliases.some(alias => normalized === alias || normalized.includes(alias));
  });
}

export function parseSeasonalHoursRows(
  rows: Record<string, unknown>[],
  fallbackDate?: string,
): SeasonalHoursParseResult {
  const headers = Object.keys(rows[0] ?? {});
  const columns = Object.fromEntries(
    (Object.keys(FIELD_ALIASES) as FieldKey[]).map(key => [key, findColumn(headers, key)]),
  ) as Record<FieldKey, string | undefined>;

  const entries: SeasonalStoreHours[] = [];
  let skipped = 0;
  const dateHeaderColumns = headers
    .map(header => ({ header, date: parseSeasonalDateOnly(header, fallbackDate) }))
    .filter((col): col is { header: string; date: string } => Boolean(col.date));

  if (columns.loja && dateHeaderColumns.length > 0 && !columns.date) {
    rows.forEach((row, index) => {
      const loja = normalizeStoreCode(row[columns.loja!]);
      if (!loja) {
        skipped += 1;
        return;
      }

      let rowEntries = 0;
      for (const col of dateHeaderColumns) {
        const value = row[col.header];
        const closed = parseClosed(value);
        const [opensAt, closesAt] = extractTimes(value);
        if (!closed && !opensAt && !closesAt) continue;
        entries.push({
          id: `${col.date}_${loja}`,
          loja,
          date: col.date,
          opensAt: closed ? '' : opensAt,
          closesAt: closed ? '' : closesAt,
          closed,
          note: '',
          sourceRow: index + 2,
        });
        rowEntries += 1;
      }

      if (rowEntries === 0) skipped += 1;
    });

    return { entries, skipped };
  }

  rows.forEach((row, index) => {
    const loja = normalizeStoreCode(columns.loja ? row[columns.loja] : '');
    const date = normalizeSeasonalDate(columns.date ? row[columns.date] : '', fallbackDate);
    const hoursRaw = columns.hours ? row[columns.hours] : '';
    const closed = parseClosed(columns.closed ? row[columns.closed] : '', hoursRaw);
    const [hourStart, hourEnd] = extractTimes(hoursRaw);
    const opensAt = normalizeTime(columns.opensAt ? row[columns.opensAt] : '') || hourStart;
    const closesAt = normalizeTime(columns.closesAt ? row[columns.closesAt] : '') || hourEnd;
    const note = columns.note ? String(row[columns.note] ?? '').trim() : '';

    if (!loja || !date || (!closed && !opensAt && !closesAt)) {
      skipped += 1;
      return;
    }

    entries.push({
      id: `${date}_${loja}`,
      loja,
      date,
      opensAt: closed ? '' : opensAt,
      closesAt: closed ? '' : closesAt,
      closed,
      note,
      sourceRow: index + 2,
    });
  });

  return { entries, skipped };
}

function isStoreHeader(value: unknown): boolean {
  const normalized = normalizeText(value);
  const aliases = FIELD_ALIASES.loja.map(normalizeText);
  return aliases.some(alias => normalized === alias || normalized.includes(alias));
}

export function parseSeasonalHoursMatrix(
  matrix: unknown[][],
  fallbackDate?: string,
): SeasonalHoursParseResult {
  const headerIndex = matrix.findIndex(row => row.some(isStoreHeader));
  if (headerIndex < 0) return { entries: [], skipped: 0 };

  const headers = matrix[headerIndex] ?? [];
  const lojaCol = headers.findIndex(isStoreHeader);
  const dateCols = headers
    .map((header, index) => ({ index, date: parseSeasonalDateOnly(header, fallbackDate) }))
    .filter((col): col is { index: number; date: string } => Boolean(col.date));

  if (lojaCol < 0 || dateCols.length === 0) return { entries: [], skipped: 0 };

  const entries: SeasonalStoreHours[] = [];
  let skipped = 0;

  matrix.slice(headerIndex + 1).forEach((row, offset) => {
    const sourceRow = headerIndex + offset + 2;
    const loja = normalizeStoreCode(row[lojaCol]);
    if (!loja) {
      skipped += 1;
      return;
    }

    let rowEntries = 0;
    for (const col of dateCols) {
      const value = row[col.index];
      const closed = parseClosed(value);
      const [opensAt, closesAt] = extractTimes(value);
      if (!closed && !opensAt && !closesAt) continue;

      entries.push({
        id: `${col.date}_${loja}`,
        loja,
        date: col.date,
        opensAt: closed ? '' : opensAt,
        closesAt: closed ? '' : closesAt,
        closed,
        note: '',
        sourceRow,
      });
      rowEntries += 1;
    }

    if (rowEntries === 0) skipped += 1;
  });

  return { entries, skipped };
}

function mergeParseResults(results: SeasonalHoursParseResult[]): SeasonalHoursParseResult {
  const byId = new Map<string, SeasonalStoreHours>();
  let skipped = 0;

  for (const result of results) {
    skipped += result.skipped;
    for (const entry of result.entries) {
      byId.set(entry.id, entry);
    }
  }

  return { entries: [...byId.values()], skipped };
}

export async function parseSeasonalHoursFile(file: File, fallbackDate?: string): Promise<SeasonalHoursParseResult> {
  const XLSX = await import('xlsx');
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array', cellDates: true });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) return { entries: [], skipped: 0 };
  const sheet = workbook.Sheets[sheetName];
  const matrixRaw = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: '' });
  const matrixFormatted = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: '', raw: false });
  const matrixResult = mergeParseResults([
    parseSeasonalHoursMatrix(matrixRaw, fallbackDate),
    parseSeasonalHoursMatrix(matrixFormatted, fallbackDate),
  ]);
  if (matrixResult.entries.length > 0) return matrixResult;

  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' });
  return parseSeasonalHoursRows(rows, fallbackDate);
}

export function seasonalHoursLabel(item: SeasonalStoreHours): string {
  const date = formatSeasonalDate(item.date);
  if (item.closed) return `${date}: fechado`;
  if (item.opensAt && item.closesAt) return `${date}: ${item.opensAt}-${item.closesAt}`;
  return `${date}: horario especial`;
}

export function formatSeasonalDate(date: string): string {
  const [, , mm, dd] = date.match(DATE_RE) ?? [];
  return mm && dd ? `${dd}/${mm}` : date;
}

export function getIssueScheduleDate(issue: SchedulingIssue): string {
  return issue.dataAgenda ? normalizeSeasonalDate(issue.dataAgenda) : '';
}

export function getSeasonalHoursForIssue(
  issue: SchedulingIssue,
  seasonalHours: SeasonalStoreHours[] = [],
): SeasonalStoreHours[] {
  const agendaDate = getIssueScheduleDate(issue);
  if (agendaDate) return seasonalHours.filter(item => item.date === agendaDate);
  return seasonalHours;
}

export function summarizeIssueSeasonalHours(issue: SchedulingIssue, seasonalHours: SeasonalStoreHours[] = []): string {
  const matches = getSeasonalHoursForIssue(issue, seasonalHours);
  if (matches.length === 0) return '';
  if (matches.length === 1) return seasonalHoursLabel(matches[0]);
  return `${matches.length} horarios sazonais`;
}
