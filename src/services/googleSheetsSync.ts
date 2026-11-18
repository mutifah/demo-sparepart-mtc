import {
  DriveSpreadsheetFile,
  LoadedSpreadsheet,
  ScoringWeights,
  SheetColumnLayout,
  SparepartItem,
  SpreadsheetLayout,
} from '../types/sparepart';
import {
  computeSparepart,
  DEFAULT_WEIGHTS,
  defaultEstimasiForLeadTime,
  generateItemId,
  parseLeadTimeCategory,
  parseVedCode,
} from '../utils/scoring';

const DRIVE_API = 'https://www.googleapis.com/drive/v3';
const SHEETS_API = 'https://sheets.googleapis.com/v4/spreadsheets';

export const STANDARD_TABS = {
  GUIDE: 'Panduan',
  VED: '1_ASSET_VED',
  LEAD_TIME: '2_LEAD_TIME',
  STOCK: '3_SISA_STOK',
  SCORING: '4_SKORING',
} as const;

export class AuthExpiredError extends Error {
  constructor(message = 'Sesi Google berakhir. Silakan masuk ulang.') {
    super(message);
    this.name = 'AuthExpiredError';
  }
}

async function googleFetch(url: string, token: string, init?: RequestInit) {
  const res = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  });

  if (res.status === 401) {
    throw new AuthExpiredError();
  }

  if (!res.ok) {
    const errBody = await res.text();
    let msg = `Permintaan gagal (${res.status})`;
    try {
      const parsed = JSON.parse(errBody);
      if (parsed?.error?.message) {
        msg = parsed.error.message;
      }
    } catch {
      // ignore json parse error
    }
    throw new Error(msg);
  }

  return res.json();
}

export async function listDriveSpreadsheets(
  token: string,
  searchQuery = ''
): Promise<DriveSpreadsheetFile[]> {
  const escaped = searchQuery.trim().replace(/'/g, "\\'");
  const qParts = [
    "mimeType='application/vnd.google-apps.spreadsheet'",
    'trashed=false',
  ];
  if (escaped) {
    qParts.push(`name contains '${escaped}'`);
  }
  const params = new URLSearchParams({
    q: qParts.join(' and '),
    fields: 'files(id,name,modifiedTime,webViewLink)',
    orderBy: 'modifiedTime desc',
    pageSize: '30',
    includeItemsFromAllDrives: 'true',
    supportsAllDrives: 'true',
  });

  const data = await googleFetch(`${DRIVE_API}/files?${params.toString()}`, token);
  return (data.files ?? []) as DriveSpreadsheetFile[];
}

function parseNumber(val: unknown, fallback = 0): number {
  if (typeof val === 'number') return Number.isFinite(val) ? val : fallback;
  const cleaned = String(val ?? '')
    .trim()
    .replace(/%/g, '')
    .replace(/\s+/g, '')
    .replace(',', '.');
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeHeader(h: unknown): string {
  return String(h ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

function colToLetter(colIdx0: number): string {
  let n = colIdx0 + 1;
  let s = '';
  while (n > 0) {
    const rem = (n - 1) % 26;
    s = String.fromCharCode(65 + rem) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

function findSheetByName(
  sheetInfos: Array<{ sheetId: number; title: string }>,
  candidates: string[]
): { sheetId: number; title: string } | undefined {
  for (const c of candidates) {
    const exact = sheetInfos.find(
      (s) => s.title.toLowerCase().trim() === c.toLowerCase()
    );
    if (exact) return exact;
  }
  for (const s of sheetInfos) {
    const l = s.title.toLowerCase();
    if (candidates.some((c) => l.includes(c.toLowerCase()))) {
      return s;
    }
  }
  return undefined;
}

function quoteSheetRange(sheetName: string, range: string): string {
  const escaped = sheetName.replace(/'/g, "''");
  return encodeURIComponent(`'${escaped}'!${range}`);
}

function formatA1Cell(sheetName: string, row1: number, col0: number): string {
  const escaped = sheetName.replace(/'/g, "''");
  return `'${escaped}'!${colToLetter(col0)}${row1}`;
}

function isFormulaValue(val: unknown): boolean {
  return typeof val === 'string' && val.trim().startsWith('=');
}

function findColumnIndex(
  normalizedHeaders: string[],
  matchers: string[],
  exclude: string[] = []
): number {
  return normalizedHeaders.findIndex((h) => {
    if (!h) return false;
    if (exclude.some((ex) => h.includes(ex))) return false;
    return matchers.some((m) => h.includes(m));
  });
}

function detectFormulaColumns(
  formulaRows: unknown[][],
  headerRow0: number,
  cols: Record<string, number>
): Record<string, boolean> {
  const result: Record<string, boolean> = {};
  for (const [key, colIdx] of Object.entries(cols)) {
    if (colIdx < 0) continue;
    let hasFormula = false;
    for (
      let r = headerRow0 + 1;
      r < Math.min(formulaRows.length, headerRow0 + 15);
      r++
    ) {
      const cell = formulaRows[r]?.[colIdx];
      if (isFormulaValue(cell)) {
        hasFormula = true;
        break;
      }
    }
    result[key] = hasFormula;
  }
  return result;
}

export async function loadSpreadsheetData(
  token: string,
  spreadsheetId: string
): Promise<LoadedSpreadsheet> {
  const meta = await googleFetch(
    `${SHEETS_API}/${spreadsheetId}?fields=spreadsheetId,spreadsheetUrl,properties(title,locale),sheets(properties(sheetId,title))`,
    token
  );

  const title: string = meta.properties?.title || 'Spreadsheet Tanpa Judul';
  const locale: string = meta.properties?.locale || 'en_US';
  const webViewLink: string | undefined = meta.spreadsheetUrl;
  const sheetInfos: Array<{ sheetId: number; title: string }> = (
    meta.sheets ?? []
  ).map((s: { properties: { sheetId: number; title: string } }) => ({
    sheetId: s.properties.sheetId,
    title: s.properties.title,
  }));
  const sheetNames = sheetInfos.map((s) => s.title);

  const vedSheet = findSheetByName(sheetInfos, [
    '1_asset_ved',
    '1 asset ved',
    '1 ved',
    'asset_ved',
    'ved',
  ]);
  const ltSheet = findSheetByName(sheetInfos, [
    '2_lead_time',
    '2 lead time',
    'lead_time',
    'lead time',
    'leadtime',
  ]);
  const stokSheet = findSheetByName(sheetInfos, [
    '3_sisa_stok',
    '3 sisa stok',
    'sisa_stok',
    'sisa stok',
    'stok',
  ]);
  const skoringSheet = findSheetByName(sheetInfos, [
    '4_skoring',
    '4 skoring',
    'skoring',
    'kompilasi',
  ]);
  const masterSheet = findSheetByName(sheetInfos, ['master part', 'master']);

  const hasStandardStructure = Boolean(
    vedSheet && ltSheet && stokSheet && skoringSheet
  );

  const warnings: string[] = [];
  let weights: ScoringWeights = { ...DEFAULT_WEIGHTS };
  const items: SparepartItem[] = [];
  const layout: SpreadsheetLayout = {};

  if (hasStandardStructure || vedSheet || stokSheet || skoringSheet) {
    const targetSheets = [
      vedSheet,
      ltSheet,
      stokSheet,
      skoringSheet,
      masterSheet,
    ].filter(Boolean) as Array<{ sheetId: number; title: string }>;

    const uniqueSheets = Array.from(
      new Map(targetSheets.map((s) => [s.title, s])).values()
    );

    const rangesQuery = uniqueSheets
      .map((s) => `ranges=${quoteSheetRange(s.title, 'A1:Z1000')}`)
      .join('&');

    const [valBatch, formulaBatch] = await Promise.all([
      googleFetch(
        `${SHEETS_API}/${spreadsheetId}/values:batchGet?${rangesQuery}&valueRenderOption=UNFORMATTED_VALUE`,
        token
      ),
      googleFetch(
        `${SHEETS_API}/${spreadsheetId}/values:batchGet?${rangesQuery}&valueRenderOption=FORMULA`,
        token
      ),
    ]);

    const valBySheet = new Map<string, unknown[][]>();
    const formulaBySheet = new Map<string, unknown[][]>();
    uniqueSheets.forEach((s, idx) => {
      valBySheet.set(s.title, valBatch.valueRanges?.[idx]?.values ?? []);
      formulaBySheet.set(s.title, formulaBatch.valueRanges?.[idx]?.values ?? []);
    });

    // 1. Parse Skoring sheet for weights and row references
    const skoringMap = new Map<string, number>();
    if (skoringSheet) {
      const rows = valBySheet.get(skoringSheet.title) ?? [];
      const fRows = formulaBySheet.get(skoringSheet.title) ?? [];

      // Look for weights in top 5 rows
      for (let r = 0; r < Math.min(rows.length, 6); r++) {
        const row = rows[r] ?? [];
        const rowText = row.map((c) => String(c ?? '').toLowerCase()).join(' ');
        if (rowText.includes('bobot') || rowText.includes('ved')) {
          const weightEntries: Array<{ col0: number; val: number }> = [];
          row.forEach((c, col0) => {
            let pct = -1;
            if (typeof c === 'number' && c > 0 && c < 1) {
              pct = Math.round(c * 100);
            } else if (typeof c === 'number' && c >= 5 && c < 100) {
              pct = Math.round(c);
            } else if (typeof c === 'string' && c.includes('%')) {
              pct = Math.round(parseNumber(c, -1));
            }
            if (pct > 0 && pct < 100) {
              weightEntries.push({ col0, val: pct });
            }
          });
          if (
            weightEntries.length >= 3 &&
            weightEntries[0].val + weightEntries[1].val + weightEntries[2].val === 100
          ) {
            weights = {
              ved: weightEntries[0].val,
              leadTime: weightEntries[1].val,
              stock: weightEntries[2].val,
            };
            layout.weightCells = {
              sheetName: skoringSheet.title,
              vedCell: `${colToLetter(weightEntries[0].col0)}${r + 1}`,
              ltCell: `${colToLetter(weightEntries[1].col0)}${r + 1}`,
              stokCell: `${colToLetter(weightEntries[2].col0)}${r + 1}`,
            };
            break;
          }
        }
      }

      const headerIdx = rows.findIndex((r) =>
        r.some((c) => {
          const h = normalizeHeader(c);
          return h.includes('namasparepart') || h.includes('namapart');
        })
      );
      if (headerIdx >= 0) {
        const headers = rows[headerIdx].map(normalizeHeader);
        const cols: Record<string, number> = {
          noRak: findColumnIndex(headers, ['rak', 'kode']),
          namaPart: findColumnIndex(headers, ['namasparepart', 'namapart', 'sparepart']),
          skorVed: findColumnIndex(headers, ['skorved'], ['bobot']),
          skorLt: findColumnIndex(headers, ['skorleadtime', 'skorlt'], ['bobot']),
          skorStok: findColumnIndex(headers, ['skorsisastok', 'skorstok'], ['bobot']),
          vedBobot: findColumnIndex(headers, ['vedbobot', 'vedx']),
          ltBobot: findColumnIndex(headers, ['ltbobot', 'ltx']),
          stokBobot: findColumnIndex(headers, ['stokbobot', 'stokx']),
          totalSkor: findColumnIndex(headers, ['totalskor', 'total']),
          prioritas: findColumnIndex(headers, ['prioritas']),
        };
        layout.skoring = {
          sheetName: skoringSheet.title,
          sheetId: skoringSheet.sheetId,
          headerRow: headerIdx + 1,
          lastRow: rows.length,
          cols,
          formulaCols: detectFormulaColumns(fRows, headerIdx, cols),
        };
        for (let i = headerIdx + 1; i < rows.length; i++) {
          const name = String(rows[i]?.[cols.namaPart] ?? '').trim();
          if (name) {
            skoringMap.set(name.toLowerCase(), i + 1);
          }
        }
      }
    }

    // 2. Parse 1_ASSET_VED
    interface VedParsed {
      row1: number;
      noRak: string;
      spesifikasiMerk: string;
      lokasiUnit: string;
      subLokasi: string;
      namaEquipment: string;
      namaPart: string;
      ved: 'V' | 'E' | 'D';
      satuan: string;
    }
    const vedList: VedParsed[] = [];
    const vedByName = new Map<string, VedParsed>();

    if (vedSheet) {
      const rows = valBySheet.get(vedSheet.title) ?? [];
      const fRows = formulaBySheet.get(vedSheet.title) ?? [];
      const headerIdx = rows.findIndex((r) =>
        r.some((c) => {
          const h = normalizeHeader(c);
          return (
            h.includes('namasparepart') ||
            h.includes('namapart') ||
            (h.includes('sparepart') && !h.includes('skor'))
          );
        })
      );

      if (headerIdx >= 0) {
        const headers = rows[headerIdx].map(normalizeHeader);
        const cols: Record<string, number> = {
          noRak: findColumnIndex(headers, ['rak', 'kode']),
          lokasiUnit: findColumnIndex(headers, ['lokasi', 'unit'], ['sub']),
          subLokasi: findColumnIndex(headers, ['sublokasi', 'sub']),
          namaEquipment: findColumnIndex(headers, ['equipment', 'mesin'], ['ved', 'skor']),
          vedEquipment: findColumnIndex(headers, ['vedequipment', 'vedeq']),
          namaPart: findColumnIndex(headers, ['namasparepart', 'namapart', 'sparepart'], ['skor', 'ved']),
          spesifikasiMerk: findColumnIndex(headers, ['spesifikasi', 'merk', 'spec']),
          vedPart: findColumnIndex(headers, ['vedpart', 'ved'], ['equipment', 'eq', 'skor']),
          skorVed: findColumnIndex(headers, ['skorvedpart', 'skorved'], ['equipment', 'eq']),
          satuan: findColumnIndex(headers, ['satuan', 'sat']),
        };

        layout.ved = {
          sheetName: vedSheet.title,
          sheetId: vedSheet.sheetId,
          headerRow: headerIdx + 1,
          lastRow: rows.length,
          cols,
          formulaCols: detectFormulaColumns(fRows, headerIdx, cols),
        };

        let lastLokasi = 'WTP';
        let lastSub = '';
        let lastEq = '';

        for (let i = headerIdx + 1; i < rows.length; i++) {
          const row = rows[i] ?? [];
          const partName =
            cols.namaPart >= 0 ? String(row[cols.namaPart] ?? '').trim() : '';
          if (!partName) continue;

          const lokasi =
            cols.lokasiUnit >= 0 ? String(row[cols.lokasiUnit] ?? '').trim() : '';
          const sub =
            cols.subLokasi >= 0 ? String(row[cols.subLokasi] ?? '').trim() : '';
          const eq =
            cols.namaEquipment >= 0
              ? String(row[cols.namaEquipment] ?? '').trim()
              : '';

          if (lokasi) lastLokasi = lokasi;
          if (sub) lastSub = sub;
          if (eq) lastEq = eq;

          const vedRaw =
            cols.vedPart >= 0
              ? row[cols.vedPart]
              : cols.vedEquipment >= 0
                ? row[cols.vedEquipment]
                : 'E';

          const entry: VedParsed = {
            row1: i + 1,
            noRak: cols.noRak >= 0 ? String(row[cols.noRak] ?? '').trim() : '',
            spesifikasiMerk:
              cols.spesifikasiMerk >= 0
                ? String(row[cols.spesifikasiMerk] ?? '').trim()
                : '',
            lokasiUnit: lokasi || lastLokasi,
            subLokasi: sub || lastSub,
            namaEquipment: eq || lastEq,
            namaPart: partName,
            ved: parseVedCode(vedRaw, 'E'),
            satuan: cols.satuan >= 0 ? String(row[cols.satuan] ?? '').trim() : '',
          };
          vedList.push(entry);
          vedByName.set(partName.toLowerCase(), entry);
        }
      }
    }

    // 3. Parse 2_LEAD_TIME
    const ltMap = new Map<
      string,
      { row1: number; noRak: string; kategori: string; estimasi: string }
    >();
    if (ltSheet) {
      const rows = valBySheet.get(ltSheet.title) ?? [];
      const fRows = formulaBySheet.get(ltSheet.title) ?? [];
      const headerIdx = rows.findIndex((r) =>
        r.some((c) => {
          const h = normalizeHeader(c);
          return h.includes('namasparepart') || h.includes('namapart');
        })
      );
      if (headerIdx >= 0) {
        const headers = rows[headerIdx].map(normalizeHeader);
        const cols: Record<string, number> = {
          noRak: findColumnIndex(headers, ['rak', 'kode']),
          namaPart: findColumnIndex(headers, ['namasparepart', 'namapart', 'sparepart']),
          kategori: findColumnIndex(headers, ['kategorileadtime', 'kategori', 'leadtime'], ['skor']),
          estimasi: findColumnIndex(headers, ['estimasi', 'waktu']),
          skorLt: findColumnIndex(headers, ['skorleadtime', 'skor']),
        };
        layout.lt = {
          sheetName: ltSheet.title,
          sheetId: ltSheet.sheetId,
          headerRow: headerIdx + 1,
          lastRow: rows.length,
          cols,
          formulaCols: detectFormulaColumns(fRows, headerIdx, cols),
        };
        for (let i = headerIdx + 1; i < rows.length; i++) {
          const row = rows[i] ?? [];
          const partName =
            cols.namaPart >= 0 ? String(row[cols.namaPart] ?? '').trim() : '';
          if (!partName) continue;
          const catRaw =
            cols.kategori >= 0
              ? String(row[cols.kategori] ?? '').trim()
              : cols.skorLt >= 0
                ? String(row[cols.skorLt] ?? '').trim()
                : '';
          ltMap.set(partName.toLowerCase(), {
            row1: i + 1,
            noRak: cols.noRak >= 0 ? String(row[cols.noRak] ?? '').trim() : '',
            kategori: catRaw,
            estimasi:
              cols.estimasi >= 0 ? String(row[cols.estimasi] ?? '').trim() : '',
          });
        }
      }
    }

    // 4. Parse 3_SISA_STOK
    interface StokParsed {
      row1: number;
      noRak: string;
      namaPart: string;
      satuan: string;
      minStok: number;
      maxStok: number;
      sisaAktual: number;
    }
    const stokList: StokParsed[] = [];
    const stokMap = new Map<string, StokParsed>();
    if (stokSheet) {
      const rows = valBySheet.get(stokSheet.title) ?? [];
      const fRows = formulaBySheet.get(stokSheet.title) ?? [];
      const headerIdx = rows.findIndex((r) =>
        r.some((c) => {
          const h = normalizeHeader(c);
          return h.includes('namasparepart') || h.includes('namapart');
        })
      );
      if (headerIdx >= 0) {
        const headers = rows[headerIdx].map(normalizeHeader);
        const cols: Record<string, number> = {
          noRak: findColumnIndex(headers, ['rak', 'kode']),
          namaPart: findColumnIndex(headers, ['namasparepart', 'namapart', 'sparepart']),
          satuan: findColumnIndex(headers, ['satuan', 'sat']),
          minStok: findColumnIndex(headers, ['minstok', 'min']),
          maxStok: findColumnIndex(headers, ['maxstok', 'max']),
          sisaAktual: findColumnIndex(headers, ['sisastokaktual', 'stokaktual', 'sisa', 'aktual'], ['skor', 'status']),
          status: findColumnIndex(headers, ['status']),
          skorStok: findColumnIndex(headers, ['skorsisastok', 'skorstok', 'skor']),
        };
        layout.stok = {
          sheetName: stokSheet.title,
          sheetId: stokSheet.sheetId,
          headerRow: headerIdx + 1,
          lastRow: rows.length,
          cols,
          formulaCols: detectFormulaColumns(fRows, headerIdx, cols),
        };
        for (let i = headerIdx + 1; i < rows.length; i++) {
          const row = rows[i] ?? [];
          const partName =
            cols.namaPart >= 0 ? String(row[cols.namaPart] ?? '').trim() : '';
          if (!partName) continue;
          const entry: StokParsed = {
            row1: i + 1,
            noRak: cols.noRak >= 0 ? String(row[cols.noRak] ?? '').trim() : '',
            namaPart: partName,
            satuan:
              cols.satuan >= 0 ? String(row[cols.satuan] ?? 'pcs').trim() || 'pcs' : 'pcs',
            minStok: cols.minStok >= 0 ? parseNumber(row[cols.minStok], 0) : 0,
            maxStok: cols.maxStok >= 0 ? parseNumber(row[cols.maxStok], 2) : 2,
            sisaAktual:
              cols.sisaAktual >= 0 ? parseNumber(row[cols.sisaAktual], 0) : 0,
          };
          stokList.push(entry);
          stokMap.set(partName.toLowerCase(), entry);
        }
      }
    }

    // Optional Master part enrichment
    const masterMap = new Map<
      string,
      { noRak: string; spec: string; equipment: string; satuan: string }
    >();
    if (masterSheet) {
      const rows = valBySheet.get(masterSheet.title) ?? [];
      const headerIdx = rows.findIndex((r) =>
        r.some((c) => {
          const h = normalizeHeader(c);
          return h.includes('namasparepart') || h.includes('namapart');
        })
      );
      if (headerIdx >= 0) {
        const headers = rows[headerIdx].map(normalizeHeader);
        const colRak = findColumnIndex(headers, ['rak']);
        const colName = findColumnIndex(headers, ['namasparepart', 'namapart']);
        const colSpec = findColumnIndex(headers, ['spesifikasi', 'merk']);
        const colEq = findColumnIndex(headers, ['equipment']);
        const colSat = findColumnIndex(headers, ['sat']);
        for (let i = headerIdx + 1; i < rows.length; i++) {
          const row = rows[i] ?? [];
          const name = colName >= 0 ? String(row[colName] ?? '').trim() : '';
          if (!name) continue;
          masterMap.set(name.toLowerCase(), {
            noRak: colRak >= 0 ? String(row[colRak] ?? '').trim() : '',
            spec: colSpec >= 0 ? String(row[colSpec] ?? '').trim() : '',
            equipment: colEq >= 0 ? String(row[colEq] ?? '').trim() : '',
            satuan: colSat >= 0 ? String(row[colSat] ?? '').trim() : '',
          });
        }
      }
    }

    // Build unified items list from 1_ASSET_VED (or fallback to 3_SISA_STOK)
    const orderedNames: string[] = [];
    const seen = new Set<string>();
    for (const v of vedList) {
      const k = v.namaPart.toLowerCase();
      if (!seen.has(k)) {
        seen.add(k);
        orderedNames.push(v.namaPart);
      }
    }
    for (const s of stokList) {
      const k = s.namaPart.toLowerCase();
      if (!seen.has(k)) {
        seen.add(k);
        orderedNames.push(s.namaPart);
      }
    }

    for (const partName of orderedNames) {
      const key = partName.toLowerCase();
      const ved = vedByName.get(key);
      const lt = ltMap.get(key);
      const st = stokMap.get(key);
      const m = masterMap.get(key);
      const skRow = skoringMap.get(key);

      const leadTimeCategory = parseLeadTimeCategory(lt?.kategori);

      items.push({
        id: generateItemId(),
        noRak: st?.noRak || lt?.noRak || ved?.noRak || m?.noRak || '-',
        namaPart: partName,
        spesifikasiMerk: ved?.spesifikasiMerk || m?.spec || '',
        lokasiUnit: ved?.lokasiUnit || 'WTP',
        subLokasi: ved?.subLokasi || '',
        namaEquipment: ved?.namaEquipment || m?.equipment || '',
        ved: ved?.ved ?? 'E',
        leadTimeCategory,
        estimasiWaktu:
          lt?.estimasi || defaultEstimasiForLeadTime(leadTimeCategory),
        satuan: st?.satuan || ved?.satuan || m?.satuan || 'pcs',
        minStok: st?.minStok ?? 1,
        maxStok: st?.maxStok ?? 2,
        sisaStokAktual: st?.sisaAktual ?? 0,
        rowRefs: {
          vedRow: ved?.row1,
          ltRow: lt?.row1,
          stokRow: st?.row1,
          skoringRow: skRow,
        },
      });
    }

    if (!hasStandardStructure) {
      warnings.push(
        `Beberapa tab standar (${STANDARD_TABS.VED}, ${STANDARD_TABS.LEAD_TIME}, ${STANDARD_TABS.STOCK}, ${STANDARD_TABS.SCORING}) belum ditemukan di file ini.`
      );
    }
  } else {
    // Generic single-sheet fallback
    const firstSheet = sheetInfos[0];
    if (firstSheet) {
      const rangeData = await googleFetch(
        `${SHEETS_API}/${spreadsheetId}/values/${quoteSheetRange(firstSheet.title, 'A1:Z1000')}?valueRenderOption=UNFORMATTED_VALUE`,
        token
      );
      const rows: unknown[][] = rangeData.values ?? [];
      const headerIdx = rows.findIndex((r) =>
        r.some((c) => {
          const h = normalizeHeader(c);
          return h.includes('nama') || h.includes('part') || h.includes('barang');
        })
      );
      if (headerIdx >= 0) {
        const headers = rows[headerIdx].map(normalizeHeader);
        const colRak = findColumnIndex(headers, ['rak', 'kode']);
        const colName = findColumnIndex(headers, ['namasparepart', 'namapart', 'nama', 'part', 'barang']);
        const colSpec = findColumnIndex(headers, ['spesifikasi', 'merk', 'spec']);
        const colEq = findColumnIndex(headers, ['equipment', 'mesin', 'unit']);
        const colVed = findColumnIndex(headers, ['ved']);
        const colLt = findColumnIndex(headers, ['leadtime', 'lt']);
        const colMin = findColumnIndex(headers, ['min']);
        const colMax = findColumnIndex(headers, ['max']);
        const colSisa = findColumnIndex(headers, ['sisa', 'stokaktual', 'stok', 'qty']);
        const colSat = findColumnIndex(headers, ['satuan', 'sat']);

        for (let i = headerIdx + 1; i < rows.length; i++) {
          const row = rows[i] ?? [];
          const namaPart = colName >= 0 ? String(row[colName] ?? '').trim() : '';
          if (!namaPart) continue;
          const ltCat = parseLeadTimeCategory(
            colLt >= 0 ? row[colLt] : 'Distributor 1-4 mgg'
          );
          items.push({
            id: generateItemId(),
            noRak: colRak >= 0 ? String(row[colRak] ?? '-').trim() || '-' : '-',
            namaPart,
            spesifikasiMerk:
              colSpec >= 0 ? String(row[colSpec] ?? '').trim() : '',
            lokasiUnit: 'WTP',
            subLokasi: '',
            namaEquipment: colEq >= 0 ? String(row[colEq] ?? '').trim() : '',
            ved: parseVedCode(colVed >= 0 ? row[colVed] : 'E', 'E'),
            leadTimeCategory: ltCat,
            estimasiWaktu: defaultEstimasiForLeadTime(ltCat),
            satuan:
              colSat >= 0
                ? String(row[colSat] ?? 'pcs').trim() || 'pcs'
                : 'pcs',
            minStok: colMin >= 0 ? parseNumber(row[colMin], 1) : 1,
            maxStok: colMax >= 0 ? parseNumber(row[colMax], 2) : 2,
            sisaStokAktual: colSisa >= 0 ? parseNumber(row[colSisa], 1) : 1,
          });
        }
      }
      warnings.push(
        `File ini memakai format tab khusus (${firstSheet.title}). Untuk sinkronisasi penuh, gunakan template 5 tab standar.`
      );
    }
  }

  return {
    spreadsheetId,
    title,
    webViewLink,
    locale,
    sheetNames,
    hasStandardStructure,
    weights,
    items,
    layout,
    warnings,
  };
}

/**
 * Surgical stock update: ONLY updates Sisa Stok Aktual (and non-formula Status/Skor)
 * on 3_SISA_STOK (and non-formula 4_SKORING cells), keeping all user formulas intact!
 */
export async function updateStockRowsInSpreadsheet(
  token: string,
  loaded: LoadedSpreadsheet,
  updatedItems: SparepartItem[]
): Promise<void> {
  const { spreadsheetId, layout, weights } = loaded;
  const stokLayout = layout.stok;
  const skoringLayout = layout.skoring;

  if (!stokLayout || stokLayout.cols.sisaAktual < 0) {
    // Fallback if sheet didn't have standard layout
    await rewriteStandardTabs(token, loaded, weights, updatedItems);
    return;
  }

  const updates: Array<{ range: string; values: (string | number)[][] }> = [];

  for (const item of updatedItems) {
    const orig = loaded.items.find((o) => o.id === item.id);
    if (!orig || orig.sisaStokAktual === item.sisaStokAktual) continue;

    const computed = computeSparepart(item, weights);
    const stokRow = item.rowRefs?.stokRow;

    if (stokRow) {
      updates.push({
        range: formatA1Cell(
          stokLayout.sheetName,
          stokRow,
          stokLayout.cols.sisaAktual
        ),
        values: [[item.sisaStokAktual]],
      });

      if (
        stokLayout.cols.status >= 0 &&
        !stokLayout.formulaCols.status
      ) {
        updates.push({
          range: formatA1Cell(stokLayout.sheetName, stokRow, stokLayout.cols.status),
          values: [[computed.statusStok]],
        });
      }

      if (
        stokLayout.cols.skorStok >= 0 &&
        !stokLayout.formulaCols.skorStok
      ) {
        updates.push({
          range: formatA1Cell(
            stokLayout.sheetName,
            stokRow,
            stokLayout.cols.skorStok
          ),
          values: [[computed.skorSisaStok]],
        });
      }
    }

    const skRow = item.rowRefs?.skoringRow;
    if (skRow && skoringLayout) {
      if (
        skoringLayout.cols.skorStok >= 0 &&
        !skoringLayout.formulaCols.skorStok
      ) {
        updates.push({
          range: formatA1Cell(
            skoringLayout.sheetName,
            skRow,
            skoringLayout.cols.skorStok
          ),
          values: [[computed.skorSisaStok]],
        });
      }
      if (
        skoringLayout.cols.stokBobot >= 0 &&
        !skoringLayout.formulaCols.stokBobot
      ) {
        updates.push({
          range: formatA1Cell(
            skoringLayout.sheetName,
            skRow,
            skoringLayout.cols.stokBobot
          ),
          values: [[computed.stokBobot]],
        });
      }
      if (
        skoringLayout.cols.totalSkor >= 0 &&
        !skoringLayout.formulaCols.totalSkor
      ) {
        updates.push({
          range: formatA1Cell(
            skoringLayout.sheetName,
            skRow,
            skoringLayout.cols.totalSkor
          ),
          values: [[computed.totalSkor]],
        });
      }
      if (
        skoringLayout.cols.prioritas >= 0 &&
        !skoringLayout.formulaCols.prioritas
      ) {
        updates.push({
          range: formatA1Cell(
            skoringLayout.sheetName,
            skRow,
            skoringLayout.cols.prioritas
          ),
          values: [[`Prioritas ${computed.prioritas}`]],
        });
      }
    }
  }

  if (updates.length > 0) {
    await googleFetch(`${SHEETS_API}/${spreadsheetId}/values:batchUpdate`, token, {
      method: 'POST',
      body: JSON.stringify({
        valueInputOption: 'USER_ENTERED',
        data: updates,
      }),
    });
  }
}

/**
 * Surgical single-item update or append, preserving formulas and other rows.
 */
export async function saveItemToSpreadsheet(
  token: string,
  loaded: LoadedSpreadsheet,
  item: SparepartItem,
  isNew: boolean
): Promise<void> {
  const { spreadsheetId, layout, weights, locale } = loaded;
  if (!layout.ved || !layout.lt || !layout.stok || !layout.skoring) {
    const nextItems = isNew
      ? [...loaded.items, item]
      : loaded.items.map((x) => (x.id === item.id ? item : x));
    await rewriteStandardTabs(token, loaded, weights, nextItems);
    return;
  }

  const computed = computeSparepart(item, weights);
  const updates: Array<{ range: string; values: (string | number)[][] }> = [];
  const sep = locale.toLowerCase().startsWith('id') ? ';' : ',';

  const setCell = (
    sheetLayout: SheetColumnLayout,
    row1: number,
    colKey: string,
    val: string | number
  ) => {
    const colIdx = sheetLayout.cols[colKey];
    if (colIdx === undefined || colIdx < 0) return;
    if (sheetLayout.formulaCols[colKey]) return; // Never overwrite formulas!
    updates.push({
      range: formatA1Cell(sheetLayout.sheetName, row1, colIdx),
      values: [[val]],
    });
  };

  if (!isNew && item.rowRefs?.vedRow && item.rowRefs?.ltRow && item.rowRefs?.stokRow) {
    // Update existing rows surgically
    const vRow = item.rowRefs.vedRow;
    setCell(layout.ved, vRow, 'noRak', item.noRak);
    setCell(layout.ved, vRow, 'lokasiUnit', item.lokasiUnit);
    setCell(layout.ved, vRow, 'subLokasi', item.subLokasi);
    setCell(layout.ved, vRow, 'namaEquipment', item.namaEquipment);
    setCell(layout.ved, vRow, 'namaPart', item.namaPart);
    setCell(layout.ved, vRow, 'spesifikasiMerk', item.spesifikasiMerk);
    setCell(layout.ved, vRow, 'vedPart', item.ved);
    setCell(layout.ved, vRow, 'skorVed', computed.skorVed);
    setCell(layout.ved, vRow, 'satuan', item.satuan);

    const lRow = item.rowRefs.ltRow;
    setCell(layout.lt, lRow, 'noRak', item.noRak);
    setCell(layout.lt, lRow, 'namaPart', item.namaPart);
    setCell(layout.lt, lRow, 'kategori', item.leadTimeCategory);
    setCell(layout.lt, lRow, 'estimasi', item.estimasiWaktu);
    setCell(layout.lt, lRow, 'skorLt', computed.skorLeadTime);

    const sRow = item.rowRefs.stokRow;
    setCell(layout.stok, sRow, 'noRak', item.noRak);
    setCell(layout.stok, sRow, 'namaPart', item.namaPart);
    setCell(layout.stok, sRow, 'satuan', item.satuan);
    setCell(layout.stok, sRow, 'minStok', item.minStok);
    setCell(layout.stok, sRow, 'maxStok', item.maxStok);
    setCell(layout.stok, sRow, 'sisaAktual', item.sisaStokAktual);
    setCell(layout.stok, sRow, 'status', computed.statusStok);
    setCell(layout.stok, sRow, 'skorStok', computed.skorSisaStok);

    if (item.rowRefs.skoringRow) {
      const kRow = item.rowRefs.skoringRow;
      setCell(layout.skoring, kRow, 'noRak', item.noRak);
      setCell(layout.skoring, kRow, 'namaPart', item.namaPart);
      setCell(layout.skoring, kRow, 'skorVed', computed.skorVed);
      setCell(layout.skoring, kRow, 'skorLt', computed.skorLeadTime);
      setCell(layout.skoring, kRow, 'skorStok', computed.skorSisaStok);
      setCell(layout.skoring, kRow, 'vedBobot', computed.vedBobot);
      setCell(layout.skoring, kRow, 'ltBobot', computed.ltBobot);
      setCell(layout.skoring, kRow, 'stokBobot', computed.stokBobot);
      setCell(layout.skoring, kRow, 'totalSkor', computed.totalSkor);
      setCell(
        layout.skoring,
        kRow,
        'prioritas',
        `Prioritas ${computed.prioritas}`
      );
    }

    if (updates.length > 0) {
      await googleFetch(
        `${SHEETS_API}/${spreadsheetId}/values:batchUpdate`,
        token,
        {
          method: 'POST',
          body: JSON.stringify({
            valueInputOption: 'USER_ENTERED',
            data: updates,
          }),
        }
      );
    }
    return;
  }

  // Append new row cleanly at lastRow + 1 on each sheet
  const buildAppendRow = (
    sheetLayout: SheetColumnLayout,
    row1: number,
    valuesByKey: Record<string, string | number>
  ) => {
    const maxCol = Math.max(
      0,
      ...Object.values(sheetLayout.cols).filter((c) => c >= 0)
    );
    const rowArr: (string | number)[] = new Array(maxCol + 1).fill('');
    for (const [k, colIdx] of Object.entries(sheetLayout.cols)) {
      if (colIdx < 0) continue;
      if (valuesByKey[k] !== undefined) {
        rowArr[colIdx] = valuesByKey[k];
      }
    }
    const escaped = sheetLayout.sheetName.replace(/'/g, "''");
    return {
      range: `'${escaped}'!A${row1}`,
      values: [rowArr],
    };
  };

  const vNext = layout.ved.lastRow + 1;
  const lNext = layout.lt.lastRow + 1;
  const sNext = layout.stok.lastRow + 1;
  const kNext = layout.skoring.lastRow + 1;

  const minColLetter =
    layout.stok.cols.minStok >= 0
      ? colToLetter(layout.stok.cols.minStok)
      : 'D';
  const sisaColLetter =
    layout.stok.cols.sisaAktual >= 0
      ? colToLetter(layout.stok.cols.sisaAktual)
      : 'F';

  const appendData = [
    buildAppendRow(layout.ved, vNext, {
      noRak: item.noRak,
      lokasiUnit: item.lokasiUnit,
      subLokasi: item.subLokasi,
      namaEquipment: item.namaEquipment,
      vedEquipment: item.ved,
      namaPart: item.namaPart,
      spesifikasiMerk: item.spesifikasiMerk,
      vedPart: item.ved,
      skorVed: computed.skorVed,
      satuan: item.satuan,
    }),
    buildAppendRow(layout.lt, lNext, {
      noRak: item.noRak,
      namaPart: item.namaPart,
      kategori: item.leadTimeCategory,
      estimasi: item.estimasiWaktu,
      skorLt: computed.skorLeadTime,
    }),
    buildAppendRow(layout.stok, sNext, {
      noRak: item.noRak,
      namaPart: item.namaPart,
      satuan: item.satuan,
      minStok: item.minStok,
      maxStok: item.maxStok,
      sisaAktual: item.sisaStokAktual,
      status: layout.stok.formulaCols.status
        ? `=IF(${sisaColLetter}${sNext}<${minColLetter}${sNext}${sep}"KURANG"${sep}IF(${sisaColLetter}${sNext}<2*${minColLetter}${sNext}${sep}"MENIPIS"${sep}"AMAN"))`
        : computed.statusStok,
      skorStok: layout.stok.formulaCols.skorStok
        ? `=IF(${sisaColLetter}${sNext}<${minColLetter}${sNext}${sep}15${sep}IF(${sisaColLetter}${sNext}<2*${minColLetter}${sNext}${sep}10${sep}5))`
        : computed.skorSisaStok,
    }),
    buildAppendRow(layout.skoring, kNext, {
      noRak: item.noRak,
      namaPart: item.namaPart,
      skorVed: computed.skorVed,
      skorLt: computed.skorLeadTime,
      skorStok: computed.skorSisaStok,
      vedBobot: computed.vedBobot,
      ltBobot: computed.ltBobot,
      stokBobot: computed.stokBobot,
      totalSkor: computed.totalSkor,
      prioritas: `Prioritas ${computed.prioritas}`,
    }),
  ];

  await googleFetch(`${SHEETS_API}/${spreadsheetId}/values:batchUpdate`, token, {
    method: 'POST',
    body: JSON.stringify({
      valueInputOption: 'USER_ENTERED',
      data: appendData,
    }),
  });
}

export async function deleteItemFromSpreadsheet(
  token: string,
  loaded: LoadedSpreadsheet,
  item: SparepartItem
): Promise<void> {
  const { spreadsheetId, layout } = loaded;
  const requests: unknown[] = [];

  const pushDelete = (sheetLayout: SheetColumnLayout | undefined, row1?: number) => {
    if (!sheetLayout || !row1) return;
    requests.push({
      deleteDimension: {
        range: {
          sheetId: sheetLayout.sheetId,
          dimension: 'ROWS',
          startIndex: row1 - 1,
          endIndex: row1,
        },
      },
    });
  };

  pushDelete(layout.ved, item.rowRefs?.vedRow);
  pushDelete(layout.lt, item.rowRefs?.ltRow);
  pushDelete(layout.stok, item.rowRefs?.stokRow);
  pushDelete(layout.skoring, item.rowRefs?.skoringRow);

  if (requests.length > 0) {
    await googleFetch(`${SHEETS_API}/${spreadsheetId}:batchUpdate`, token, {
      method: 'POST',
      body: JSON.stringify({ requests }),
    });
  }
}

export async function saveWeightsToSpreadsheet(
  token: string,
  loaded: LoadedSpreadsheet,
  newWeights: ScoringWeights
): Promise<void> {
  const { spreadsheetId, layout, items } = loaded;
  const wc = layout.weightCells;
  if (wc?.vedCell && wc?.ltCell && wc?.stokCell && layout.skoring?.formulaCols.totalSkor) {
    const escaped = wc.sheetName.replace(/'/g, "''");
    await googleFetch(`${SHEETS_API}/${spreadsheetId}/values:batchUpdate`, token, {
      method: 'POST',
      body: JSON.stringify({
        valueInputOption: 'USER_ENTERED',
        data: [
          { range: `'${escaped}'!${wc.vedCell}`, values: [[newWeights.ved / 100]] },
          { range: `'${escaped}'!${wc.ltCell}`, values: [[newWeights.leadTime / 100]] },
          { range: `'${escaped}'!${wc.stokCell}`, values: [[newWeights.stock / 100]] },
        ],
      }),
    });
    return;
  }

  await rewriteStandardTabs(token, loaded, newWeights, items);
}

function buildGuideRows(): (string | number)[][] {
  return [
    ['PANDUAN PENGGUNAAN – SISTEM SKORING PRIORITAS SPAREPART'],
    ['Mengacu pada prinsip Criticality Assessment – ISO 55001 Asset Management'],
    [''],
    ['ALUR KERJA'],
    ['Step 1', 'Sheet [1_ASSET_VED] → Klasifikasi equipment & spare part ke dalam kategori V / E / D'],
    ['Step 2', 'Sheet [2_LEAD_TIME] → Isi estimasi lead time pengadaan tiap spare part (Lokal / Distributor / Impor)'],
    ['Step 3', 'Sheet [3_SISA_STOK] → Update sisa stok aktual tiap siklus perencanaan'],
    ['Step 4', 'Sheet [4_SKORING] → Hasil kompilasi otomatis berdasarkan bobot VED + Lead Time + Sisa Stok'],
    [''],
    ['SKEMA SKOR'],
    ['Parameter VED', 'Vital = 15 | Essential = 10 | Desirable = 5'],
    ['Bobot Default', 'VED = 50% | Lead Time = 25% | Sisa Stok = 25% → Total Skor Maks = 15.0'],
    ['Skor Stok', 'Stok < Min → 15 | Min ≤ Stok < 2×Min → 10 | Stok ≥ 2×Min → 5'],
    ['Skor Lead Time', 'Impor/Indent >1 bln → 15 | Distributor 1–4 mgg → 10 | Lokal <1 mgg → 5'],
    [''],
    ['KATEGORI PRIORITAS'],
    ['Prioritas 1', 'Skor 11.0 – 15.0 → Order segera, masuk anggaran Q1 tahun berikutnya'],
    ['Prioritas 2', 'Skor 7.5 – 10.9 → Masuk anggaran tahun berjalan, monitor ketat'],
    ['Prioritas 3', 'Skor 5.0 – 7.4 → Stok aman, order saat mendekati min'],
  ];
}

function buildStandardTabsValues(
  weights: ScoringWeights,
  items: SparepartItem[],
  locale: string
) {
  const sep = locale.toLowerCase().startsWith('id') ? ';' : ',';
  const computed = items.map((item) => computeSparepart(item, weights));

  const vedValues: (string | number)[][] = [
    [
      'No. Rak',
      'Lokasi / Unit',
      'Sub Lokasi',
      'Nama Equipment',
      'Nama Spare Part',
      'Spesifikasi & Merk',
      'VED',
      'Skor VED',
    ],
    ...computed.map((item, idx) => {
      const r = idx + 2;
      return [
        item.noRak,
        item.lokasiUnit,
        item.subLokasi,
        item.namaEquipment,
        item.namaPart,
        item.spesifikasiMerk,
        item.ved,
        `=IF(G${r}="V"${sep}15${sep}IF(G${r}="E"${sep}10${sep}5))`,
      ];
    }),
  ];

  const ltValues: (string | number)[][] = [
    ['DATA LEAD TIME PENGADAAN SPAREPART'],
    ['No. Rak', 'Nama Spare Part', 'Kategori Lead Time', 'Estimasi Waktu', 'Skor Lead Time'],
    ...computed.map((item, idx) => {
      const r = idx + 3;
      return [
        item.noRak,
        item.namaPart,
        item.leadTimeCategory,
        item.estimasiWaktu,
        `=IF(C${r}="Impor/Indent >1 bln"${sep}15${sep}IF(C${r}="Distributor 1-4 mgg"${sep}10${sep}5))`,
      ];
    }),
  ];

  const stokValues: (string | number)[][] = [
    ['DATA SISA STOK – UPDATE SETIAP SIKLUS PERENCANAAN'],
    [
      'No. Rak',
      'Nama Spare Part',
      'Sat.',
      'Min Stok',
      'Max Stok',
      'Sisa Stok Aktual',
      'Status vs Min',
      'Skor Sisa Stok',
    ],
    ...computed.map((item, idx) => {
      const r = idx + 3;
      return [
        item.noRak,
        item.namaPart,
        item.satuan,
        item.minStok,
        item.maxStok,
        item.sisaStokAktual,
        `=IF(OR(F${r}<D${r}${sep}AND(D${r}=0${sep}E${r}>0${sep}F${r}=0))${sep}"KURANG"${sep}IF(AND(D${r}>0${sep}F${r}<2*D${r})${sep}"MENIPIS"${sep}"AMAN"))`,
        `=IF(OR(F${r}<D${r}${sep}AND(D${r}=0${sep}E${r}>0${sep}F${r}=0))${sep}15${sep}IF(AND(D${r}>0${sep}F${r}<2*D${r})${sep}10${sep}5))`,
      ];
    }),
  ];

  const skoringValues: (string | number)[][] = [
    ['KOMPILASI SKORING PRIORITAS PENGADAAN SPAREPART'],
    [
      'BOBOT',
      'VED',
      weights.ved / 100,
      'Lead Time',
      weights.leadTime / 100,
      'Sisa Stok',
      weights.stock / 100,
      '',
      '',
      '',
    ],
    [
      'No. Rak',
      'Nama Spare Part',
      'Skor VED',
      'Skor Lead Time',
      'Skor Sisa Stok',
      'VED × Bobot',
      'LT × Bobot',
      'Stok × Bobot',
      'Total Skor',
      'Prioritas',
    ],
    ...computed.map((item, idx) => {
      const rowNum = idx + 4;
      const vedRefRow = idx + 2;
      const ltRefRow = idx + 3;
      const stokRefRow = idx + 3;
      return [
        item.noRak,
        item.namaPart,
        `='${STANDARD_TABS.VED}'!H${vedRefRow}`,
        `='${STANDARD_TABS.LEAD_TIME}'!E${ltRefRow}`,
        `='${STANDARD_TABS.STOCK}'!H${stokRefRow}`,
        `=C${rowNum}*$C$2`,
        `=D${rowNum}*$E$2`,
        `=E${rowNum}*$G$2`,
        `=F${rowNum}+G${rowNum}+H${rowNum}`,
        `=IF(I${rowNum}>=11${sep}"Prioritas 1"${sep}IF(I${rowNum}>=7.5${sep}"Prioritas 2"${sep}"Prioritas 3"))`,
      ];
    }),
  ];

  return {
    guideValues: buildGuideRows(),
    vedValues,
    ltValues,
    stokValues,
    skoringValues,
  };
}

async function rewriteStandardTabs(
  token: string,
  loaded: LoadedSpreadsheet,
  weights: ScoringWeights,
  items: SparepartItem[]
) {
  const { spreadsheetId, sheetNames, locale } = loaded;
  const requiredTabs = [
    STANDARD_TABS.GUIDE,
    STANDARD_TABS.VED,
    STANDARD_TABS.LEAD_TIME,
    STANDARD_TABS.STOCK,
    STANDARD_TABS.SCORING,
  ];
  const missingTabs = requiredTabs.filter(
    (t) => !sheetNames.some((s) => s.toLowerCase() === t.toLowerCase())
  );

  if (missingTabs.length > 0) {
    await googleFetch(`${SHEETS_API}/${spreadsheetId}:batchUpdate`, token, {
      method: 'POST',
      body: JSON.stringify({
        requests: missingTabs.map((t) => ({
          addSheet: { properties: { title: t } },
        })),
      }),
    });
  }

  const values = buildStandardTabsValues(weights, items, locale);

  await googleFetch(`${SHEETS_API}/${spreadsheetId}/values:batchUpdate`, token, {
    method: 'POST',
    body: JSON.stringify({
      valueInputOption: 'USER_ENTERED',
      data: [
        { range: `'${STANDARD_TABS.GUIDE}'!A1`, values: values.guideValues },
        { range: `'${STANDARD_TABS.VED}'!A1`, values: values.vedValues },
        { range: `'${STANDARD_TABS.LEAD_TIME}'!A1`, values: values.ltValues },
        { range: `'${STANDARD_TABS.STOCK}'!A1`, values: values.stokValues },
        { range: `'${STANDARD_TABS.SCORING}'!A1`, values: values.skoringValues },
      ],
    }),
  });
}

export async function createTemplateSpreadsheet(
  token: string,
  title: string,
  weights: ScoringWeights,
  items: SparepartItem[]
): Promise<{ spreadsheetId: string; title: string; webViewLink?: string }> {
  const createPayload = {
    properties: {
      title: title.trim() || 'Skoring Prioritas Sparepart',
      locale: 'en_US',
    },
    sheets: [
      { properties: { title: STANDARD_TABS.GUIDE, index: 0 } },
      { properties: { title: STANDARD_TABS.VED, index: 1 } },
      { properties: { title: STANDARD_TABS.LEAD_TIME, index: 2 } },
      { properties: { title: STANDARD_TABS.STOCK, index: 3 } },
      { properties: { title: STANDARD_TABS.SCORING, index: 4 } },
    ],
  };

  const created = await googleFetch(SHEETS_API, token, {
    method: 'POST',
    body: JSON.stringify(createPayload),
  });

  const spreadsheetId: string = created.spreadsheetId;
  const webViewLink: string | undefined = created.spreadsheetUrl;
  const sheetsMeta: Array<{ properties: { sheetId: number; title: string } }> =
    created.sheets ?? [];

  const values = buildStandardTabsValues(weights, items, 'en_US');

  await googleFetch(`${SHEETS_API}/${spreadsheetId}/values:batchUpdate`, token, {
    method: 'POST',
    body: JSON.stringify({
      valueInputOption: 'USER_ENTERED',
      data: [
        { range: `'${STANDARD_TABS.GUIDE}'!A1`, values: values.guideValues },
        { range: `'${STANDARD_TABS.VED}'!A1`, values: values.vedValues },
        { range: `'${STANDARD_TABS.LEAD_TIME}'!A1`, values: values.ltValues },
        { range: `'${STANDARD_TABS.STOCK}'!A1`, values: values.stokValues },
        { range: `'${STANDARD_TABS.SCORING}'!A1`, values: values.skoringValues },
      ],
    }),
  });

  const requests: unknown[] = [];
  const headerRowsByTitle: Record<string, number> = {
    [STANDARD_TABS.VED]: 0,
    [STANDARD_TABS.LEAD_TIME]: 1,
    [STANDARD_TABS.STOCK]: 1,
    [STANDARD_TABS.SCORING]: 2,
  };

  for (const s of sheetsMeta) {
    const rowIdx = headerRowsByTitle[s.properties.title];
    if (rowIdx !== undefined) {
      requests.push({
        repeatCell: {
          range: {
            sheetId: s.properties.sheetId,
            startRowIndex: rowIdx,
            endRowIndex: rowIdx + 1,
          },
          cell: {
            userEnteredFormat: {
              backgroundColor: { red: 0.118, green: 0.227, blue: 0.541 },
              textFormat: {
                foregroundColor: { red: 1, green: 1, blue: 1 },
                bold: true,
              },
            },
          },
          fields: 'userEnteredFormat(backgroundColor,textFormat)',
        },
      });
    }
    if (s.properties.title === STANDARD_TABS.SCORING) {
      requests.push({
        repeatCell: {
          range: {
            sheetId: s.properties.sheetId,
            startRowIndex: 1,
            endRowIndex: 2,
            startColumnIndex: 2,
            endColumnIndex: 7,
          },
          cell: {
            userEnteredFormat: {
              numberFormat: { type: 'PERCENT', pattern: '0%' },
              textFormat: { bold: true },
            },
          },
          fields: 'userEnteredFormat(numberFormat,textFormat)',
        },
      });
    }
  }

  if (requests.length > 0) {
    await googleFetch(`${SHEETS_API}/${spreadsheetId}:batchUpdate`, token, {
      method: 'POST',
      body: JSON.stringify({ requests }),
    });
  }

  return {
    spreadsheetId,
    title: created.properties?.title || title,
    webViewLink,
  };
}
