export type VedCode = 'V' | 'E' | 'D';

export type LeadTimeCategory =
  | 'Lokal <1 mgg'
  | 'Distributor 1-4 mgg'
  | 'Impor/Indent >1 bln';

export type StockStatus = 'AMAN' | 'MENIPIS' | 'KURANG';

export type PriorityLevel = 1 | 2 | 3;

export interface ScoringWeights {
  ved: number; // Default 50
  leadTime: number; // Default 25
  stock: number; // Default 25
}

export interface SheetRowRefs {
  vedRow?: number; // 1-based row number in Google Sheets
  ltRow?: number;
  stokRow?: number;
  skoringRow?: number;
}

export interface SparepartItem {
  id: string;
  noRak: string;
  namaPart: string;
  spesifikasiMerk: string;
  lokasiUnit: string;
  subLokasi: string;
  namaEquipment: string;
  ved: VedCode; // Single VED parameter
  leadTimeCategory: LeadTimeCategory;
  estimasiWaktu: string;
  satuan: string;
  minStok: number;
  maxStok: number;
  sisaStokAktual: number;
  rowRefs?: SheetRowRefs;
}

export interface ComputedSparepart extends SparepartItem {
  skorVed: number;
  skorLeadTime: number;
  statusStok: StockStatus;
  skorSisaStok: number;
  vedBobot: number;
  ltBobot: number;
  stokBobot: number;
  totalSkor: number;
  prioritas: PriorityLevel;
  rekomendasi: string;
}

export interface DriveSpreadsheetFile {
  id: string;
  name: string;
  modifiedTime?: string;
  webViewLink?: string;
}

export interface SheetColumnLayout {
  sheetName: string;
  sheetId: number;
  headerRow: number; // 1-based
  lastRow: number; // 1-based
  cols: Record<string, number>; // 0-based column index
  formulaCols: Record<string, boolean>; // whether that column uses sheet formulas
}

export interface SpreadsheetLayout {
  ved?: SheetColumnLayout;
  lt?: SheetColumnLayout;
  stok?: SheetColumnLayout;
  skoring?: SheetColumnLayout;
  weightCells?: {
    sheetName: string;
    vedCell?: string;
    ltCell?: string;
    stokCell?: string;
  };
}

export interface LoadedSpreadsheet {
  spreadsheetId: string;
  title: string;
  webViewLink?: string;
  locale: string;
  sheetNames: string[];
  hasStandardStructure: boolean;
  weights: ScoringWeights;
  items: SparepartItem[];
  layout: SpreadsheetLayout;
  warnings: string[];
}
