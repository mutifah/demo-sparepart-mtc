import {
  ComputedSparepart,
  LeadTimeCategory,
  PriorityLevel,
  ScoringWeights,
  SparepartItem,
  StockStatus,
  VedCode,
} from '../types/sparepart';

export const DEFAULT_WEIGHTS: ScoringWeights = {
  ved: 50,
  leadTime: 25,
  stock: 25,
};

export const VED_OPTIONS: Array<{
  code: VedCode;
  label: string;
  score: number;
  description: string;
}> = [
  {
    code: 'V',
    label: 'V · Vital',
    score: 15,
    description: 'Jika rusak, produksi berhenti total.',
  },
  {
    code: 'E',
    label: 'E · Essential',
    score: 10,
    description: 'Produksi terganggu, tapi masih bisa disiasati sementara.',
  },
  {
    code: 'D',
    label: 'D · Desirable',
    score: 5,
    description: 'Tidak langsung memengaruhi jalannya produksi.',
  },
];

export const LEAD_TIME_OPTIONS: Array<{
  category: LeadTimeCategory;
  shortLabel: string;
  estimasi: string;
  score: number;
}> = [
  {
    category: 'Lokal <1 mgg',
    shortLabel: 'Lokal (< 1 minggu)',
    estimasi: '<1 minggu',
    score: 5,
  },
  {
    category: 'Distributor 1-4 mgg',
    shortLabel: 'Distributor (1–4 minggu)',
    estimasi: '1-4 minggu',
    score: 10,
  },
  {
    category: 'Impor/Indent >1 bln',
    shortLabel: 'Impor / Indent (> 1 bulan)',
    estimasi: '3-6 bulan',
    score: 15,
  },
];

export function vedToScore(ved: VedCode): number {
  switch (ved) {
    case 'V':
      return 15;
    case 'E':
      return 10;
    case 'D':
    default:
      return 5;
  }
}

export function parseVedCode(value: unknown, fallback: VedCode = 'E'): VedCode {
  const s = String(value ?? '').trim().toUpperCase();
  if (s.startsWith('V') || s === '15') return 'V';
  if (s.startsWith('E') || s === '10') return 'E';
  if (s.startsWith('D') || s === '5') return 'D';
  return fallback;
}

/**
 * Equipment V = part bisa V/E/D | Equipment E = part maks E | Equipment D = part semua D
 */
export function clampPartVed(partVed: VedCode, equipmentVed: VedCode): VedCode {
  const eqScore = vedToScore(equipmentVed);
  const partScore = vedToScore(partVed);
  if (partScore > eqScore) {
    return equipmentVed;
  }
  return partVed;
}

export function parseLeadTimeCategory(value: unknown): LeadTimeCategory {
  const s = String(value ?? '').trim().toLowerCase();
  if (
    s.includes('impor') ||
    s.includes('indent') ||
    s.includes('>1 bln') ||
    s.includes('bulan') ||
    s === '15'
  ) {
    return 'Impor/Indent >1 bln';
  }
  if (
    s.includes('distributor') ||
    s.includes('1-4') ||
    s.includes('1–4') ||
    s === '10'
  ) {
    return 'Distributor 1-4 mgg';
  }
  if (
    s.includes('lokal') ||
    s.includes('<1 mgg') ||
    s.includes('< 1') ||
    s === '5'
  ) {
    return 'Lokal <1 mgg';
  }
  return 'Distributor 1-4 mgg';
}

export function leadTimeToScore(category: LeadTimeCategory): number {
  switch (category) {
    case 'Impor/Indent >1 bln':
      return 15;
    case 'Distributor 1-4 mgg':
      return 10;
    case 'Lokal <1 mgg':
    default:
      return 5;
  }
}

export function defaultEstimasiForLeadTime(category: LeadTimeCategory): string {
  switch (category) {
    case 'Impor/Indent >1 bln':
      return '3-6 bulan';
    case 'Distributor 1-4 mgg':
      return '1-4 minggu';
    case 'Lokal <1 mgg':
    default:
      return '<1 minggu';
  }
}

/**
 * Stok < Min -> 15 (KURANG)
 * Min <= Stok < 2 * Min -> 10 (MENIPIS)
 * Stok >= 2 * Min -> 5 (AMAN)
 */
export function computeStockStatusAndScore(
  minStok: number,
  maxStok: number,
  sisaAktual: number
): { status: StockStatus; score: number } {
  const min = Number.isFinite(minStok) ? Math.max(0, minStok) : 0;
  const max = Number.isFinite(maxStok) ? Math.max(0, maxStok) : 0;
  const sisa = Number.isFinite(sisaAktual) ? Math.max(0, sisaAktual) : 0;

  if (sisa < min || (min === 0 && max > 0 && sisa === 0)) {
    return { status: 'KURANG', score: 15 };
  }
  if (min > 0 && sisa < 2 * min) {
    return { status: 'MENIPIS', score: 10 };
  }
  return { status: 'AMAN', score: 5 };
}

export function computePriority(totalSkor: number): PriorityLevel {
  if (totalSkor >= 11.0) return 1;
  if (totalSkor >= 7.5) return 2;
  return 3;
}

export function getRecommendationText(prioritas: PriorityLevel): string {
  if (prioritas === 1) {
    return 'Order segera, masuk anggaran Q1 tahun berikutnya.';
  }
  if (prioritas === 2) {
    return 'Masuk anggaran tahun berjalan, monitor ketat.';
  }
  return 'Stok aman, order saat mendekati min.';
}

export function computeSparepart(
  item: SparepartItem,
  weights: ScoringWeights = DEFAULT_WEIGHTS
): ComputedSparepart {
  const effectiveVedPart = clampPartVed(item.vedPart, item.vedEquipment);
  const skorVedEquipment = vedToScore(item.vedEquipment);
  const skorVedPart = vedToScore(effectiveVedPart);
  const skorLeadTime = leadTimeToScore(item.leadTimeCategory);
  const { status: statusStok, score: skorSisaStok } = computeStockStatusAndScore(
    item.minStok,
    item.maxStok,
    item.sisaStokAktual
  );

  const wVed = weights.ved / 100;
  const wLt = weights.leadTime / 100;
  const wStok = weights.stock / 100;

  const vedBobot = round2(skorVedPart * wVed);
  const ltBobot = round2(skorLeadTime * wLt);
  const stokBobot = round2(skorSisaStok * wStok);
  const totalSkor = round2(vedBobot + ltBobot + stokBobot);
  const prioritas = computePriority(totalSkor);

  return {
    ...item,
    vedPart: effectiveVedPart,
    skorVedEquipment,
    skorVedPart,
    skorLeadTime,
    statusStok,
    skorSisaStok,
    vedBobot,
    ltBobot,
    stokBobot,
    totalSkor,
    prioritas,
    rekomendasi: getRecommendationText(prioritas),
  };
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function formatScoreId(n: number): string {
  return n.toLocaleString('id-ID', {
    minimumFractionDigits: n % 1 === 0 ? 0 : 1,
    maximumFractionDigits: 2,
  });
}

export function generateItemId(): string {
  return `sp_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

export const PPT_STARTER_ITEMS: SparepartItem[] = [
  {
    id: 'sp_1',
    noRak: 'LB0001',
    namaPart: 'Analog Input Module S7-1500',
    spesifikasiMerk: '6ES7531-7KF00-0AB0, Siemens',
    lokasiUnit: 'WTP',
    subLokasi: 'Ruang Panel PLC',
    namaEquipment: 'Panel Kontrol Utama PLC S7-1500',
    vedEquipment: 'V',
    vedPart: 'V',
    leadTimeCategory: 'Impor/Indent >1 bln',
    estimasiWaktu: '3-6 bulan',
    satuan: 'pcs',
    minStok: 1,
    maxStok: 2,
    sisaStokAktual: 0,
  },
  {
    id: 'sp_2',
    noRak: 'LB0001',
    namaPart: 'Analog Output Module S7-1500',
    spesifikasiMerk: '6ES7532-7KF00-0AB0, Siemens',
    lokasiUnit: 'WTP',
    subLokasi: 'Ruang Panel PLC',
    namaEquipment: 'Panel Kontrol Utama PLC S7-1500',
    vedEquipment: 'V',
    vedPart: 'V',
    leadTimeCategory: 'Impor/Indent >1 bln',
    estimasiWaktu: '3-6 bulan',
    satuan: 'pcs',
    minStok: 1,
    maxStok: 2,
    sisaStokAktual: 1,
  },
  {
    id: 'sp_3',
    noRak: 'RK012B',
    namaPart: 'Antena Ubiquiti PowerBeam',
    spesifikasiMerk: 'M5-300, Ubiquiti',
    lokasiUnit: 'WTP',
    subLokasi: 'Menara Telemetri',
    namaEquipment: 'Sistem Telemetri SCADA',
    vedEquipment: 'V',
    vedPart: 'V',
    leadTimeCategory: 'Distributor 1-4 mgg',
    estimasiWaktu: '1-4 minggu',
    satuan: 'pcs',
    minStok: 1,
    maxStok: 2,
    sisaStokAktual: 2,
  },
  {
    id: 'sp_4',
    noRak: 'RK012C',
    namaPart: 'Actuator-Double Acting Pneumatic',
    spesifikasiMerk: 'Actuator for Butterfly Valve DN-400, Festo',
    lokasiUnit: 'WTP',
    subLokasi: 'Bak Koagulasi',
    namaEquipment: 'Butterfly Valve DN-400',
    vedEquipment: 'E',
    vedPart: 'E',
    leadTimeCategory: 'Impor/Indent >1 bln',
    estimasiWaktu: '3-6 bulan',
    satuan: 'pcs',
    minStok: 1,
    maxStok: 2,
    sisaStokAktual: 2,
  },
  {
    id: 'sp_5',
    noRak: 'RK005A',
    namaPart: 'Mechanical Seal Pompa Submersible',
    spesifikasiMerk: 'Xylem Flygt Standard Seal',
    lokasiUnit: 'Intake',
    subLokasi: 'Sumur Pompa 1-6',
    namaEquipment: 'Pompa Submersible Xylem 1 - 6',
    vedEquipment: 'E',
    vedPart: 'E',
    leadTimeCategory: 'Distributor 1-4 mgg',
    estimasiWaktu: '1-4 minggu',
    satuan: 'set',
    minStok: 2,
    maxStok: 4,
    sisaStokAktual: 1,
  },
  {
    id: 'sp_6',
    noRak: 'RK005A',
    namaPart: 'Bearing DE Motor',
    spesifikasiMerk: 'SKF Deep Groove Ball Bearing',
    lokasiUnit: 'Intake',
    subLokasi: 'Sumur Pompa 1-6',
    namaEquipment: 'Pompa Submersible Xylem 1 - 6',
    vedEquipment: 'E',
    vedPart: 'E',
    leadTimeCategory: 'Lokal <1 mgg',
    estimasiWaktu: '<1 minggu',
    satuan: 'pcs',
    minStok: 2,
    maxStok: 6,
    sisaStokAktual: 4,
  },
  {
    id: 'sp_7',
    noRak: 'RK003C',
    namaPart: 'Ball Valve Kuningan 1 Inch',
    spesifikasiMerk: 'Kitz Brass 1"',
    lokasiUnit: 'WTP',
    subLokasi: 'Jaringan Dosing',
    namaEquipment: 'Instalasi Pipa Dosing Kimia',
    vedEquipment: 'D',
    vedPart: 'D',
    leadTimeCategory: 'Distributor 1-4 mgg',
    estimasiWaktu: '1-4 minggu',
    satuan: 'pcs',
    minStok: 2,
    maxStok: 5,
    sisaStokAktual: 2,
  },
  {
    id: 'sp_8',
    noRak: 'RK008D',
    namaPart: 'Pressure Gauge 0-10 Bar',
    spesifikasiMerk: 'SS 4" 0-10bar, Wierborck',
    lokasiUnit: 'Intake',
    subLokasi: 'Sumur Pompa 1-6',
    namaEquipment: 'Pompa Submersible Xylem 1 - 6',
    vedEquipment: 'E',
    vedPart: 'D',
    leadTimeCategory: 'Lokal <1 mgg',
    estimasiWaktu: '<1 minggu',
    satuan: 'pcs',
    minStok: 1,
    maxStok: 4,
    sisaStokAktual: 3,
  },
];
