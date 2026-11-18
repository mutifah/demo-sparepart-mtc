import React, { useEffect, useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  PackageX,
  SlidersHorizontal,
} from 'lucide-react';
import {
  ComputedSparepart,
  PriorityLevel,
  ScoringWeights,
} from '../types/sparepart';
import { DEFAULT_WEIGHTS, formatScoreId } from '../utils/scoring';

interface SummaryViewProps {
  items: ComputedSparepart[];
  weights: ScoringWeights;
  onSelectPriorityFilter: (priority: PriorityLevel | 'KURANG') => void;
  onEditItem: (item: ComputedSparepart) => void;
  onRequestSaveWeights: (newWeights: ScoringWeights) => void;
  onGoToQuickStock: () => void;
}

export const SummaryView: React.FC<SummaryViewProps> = ({
  items,
  weights,
  onSelectPriorityFilter,
  onEditItem,
  onRequestSaveWeights,
  onGoToQuickStock,
}) => {
  const [draftWeights, setDraftWeights] = useState<ScoringWeights>(weights);
  const [showWeightEditor, setShowWeightEditor] = useState(false);

  useEffect(() => {
    setDraftWeights(weights);
  }, [weights]);

  const total = items.length;
  const p1Count = items.filter((i) => i.prioritas === 1).length;
  const p2Count = items.filter((i) => i.prioritas === 2).length;
  const p3Count = items.filter((i) => i.prioritas === 3).length;
  const lowStockCount = items.filter((i) => i.statusStok === 'KURANG').length;

  const p1Pct = total > 0 ? Math.round((p1Count / total) * 100) : 0;
  const p2Pct = total > 0 ? Math.round((p2Count / total) * 100) : 0;
  const p3Pct = total > 0 ? Math.max(0, 100 - p1Pct - p2Pct) : 0;

  const urgentItems = [...items]
    .sort((a, b) => b.totalSkor - a.totalSkor)
    .slice(0, 5);

  const weightSum =
    draftWeights.ved + draftWeights.leadTime + draftWeights.stock;
  const isWeightChanged =
    draftWeights.ved !== weights.ved ||
    draftWeights.leadTime !== weights.leadTime ||
    draftWeights.stock !== weights.stock;

  const adjustWeight = (key: keyof ScoringWeights, delta: number) => {
    setDraftWeights((prev) => ({
      ...prev,
      [key]: Math.min(90, Math.max(5, prev[key] + delta)),
    }));
  };

  return (
    <div className="space-y-4 sm:space-y-5">
      {/* Executive Distribution Hero Card */}
      <section className="rounded-2xl bg-gradient-to-br from-slate-900 via-blue-950 to-blue-900 text-white p-4 sm:p-5 shadow-sm">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-xs font-medium text-blue-200">
              Total Inventaris Terdata
            </p>
            <div className="mt-0.5 flex items-baseline gap-2">
              <span className="text-2xl sm:text-3xl font-bold tabular-nums">
                {total}
              </span>
              <span className="text-xs sm:text-sm text-blue-100">
                sparepart aktif
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={onGoToQuickStock}
            className="min-h-[40px] px-3.5 py-2 rounded-xl bg-white/15 hover:bg-white/25 text-white text-xs font-semibold transition-colors whitespace-nowrap shrink-0"
          >
            Cek Stok Gudang
          </button>
        </div>

        {/* Proportional Priority Bar */}
        <div className="mt-4">
          <div className="h-2.5 w-full rounded-full overflow-hidden flex bg-white/15">
            {p1Count > 0 && (
              <div
                style={{ width: `${(p1Count / total) * 100}%` }}
                className="bg-red-500 h-full"
              />
            )}
            {p2Count > 0 && (
              <div
                style={{ width: `${(p2Count / total) * 100}%` }}
                className="bg-amber-400 h-full"
              />
            )}
            {p3Count > 0 && (
              <div
                style={{ width: `${(p3Count / total) * 100}%` }}
                className="bg-emerald-400 h-full"
              />
            )}
          </div>
          <div className="mt-2.5 grid grid-cols-3 gap-2 text-xs">
            <div className="flex items-center gap-1.5 text-blue-100">
              <span className="w-2.5 h-2.5 rounded-xs bg-red-500 shrink-0" />
              <span className="truncate">
                P1: <strong className="text-white tabular-nums">{p1Count}</strong> ({p1Pct}%)
              </span>
            </div>
            <div className="flex items-center gap-1.5 text-blue-100">
              <span className="w-2.5 h-2.5 rounded-xs bg-amber-400 shrink-0" />
              <span className="truncate">
                P2: <strong className="text-white tabular-nums">{p2Count}</strong> ({p2Pct}%)
              </span>
            </div>
            <div className="flex items-center gap-1.5 text-blue-100">
              <span className="w-2.5 h-2.5 rounded-xs bg-emerald-400 shrink-0" />
              <span className="truncate">
                P3: <strong className="text-white tabular-nums">{p3Count}</strong> ({p3Pct}%)
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Compact 2x2 / 4-col Priority Filter Cards */}
      <section aria-label="Ringkasan Prioritas">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <button
            type="button"
            onClick={() => onSelectPriorityFilter(1)}
            className="bg-white rounded-2xl border border-slate-200 p-3.5 sm:p-4 text-left hover:border-red-300 hover:bg-red-50/30 active:scale-[0.99] transition-all flex flex-col justify-between gap-2 shadow-xs"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold text-red-700">
                Prioritas 1 · Kritis
              </span>
              <div className="w-7 h-7 rounded-lg bg-red-50 text-red-700 flex items-center justify-center shrink-0">
                <AlertCircle className="w-4 h-4" />
              </div>
            </div>
            <div>
              <div className="text-2xl font-bold text-slate-900 tabular-nums">
                {p1Count}
              </div>
              <div className="text-[11px] text-slate-500 mt-0.5">
                Skor 11,0 – 15,0
              </div>
            </div>
          </button>

          <button
            type="button"
            onClick={() => onSelectPriorityFilter(2)}
            className="bg-white rounded-2xl border border-slate-200 p-3.5 sm:p-4 text-left hover:border-amber-300 hover:bg-amber-50/30 active:scale-[0.99] transition-all flex flex-col justify-between gap-2 shadow-xs"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold text-amber-800">
                Prioritas 2 · Sedang
              </span>
              <div className="w-7 h-7 rounded-lg bg-amber-50 text-amber-700 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-4 h-4" />
              </div>
            </div>
            <div>
              <div className="text-2xl font-bold text-slate-900 tabular-nums">
                {p2Count}
              </div>
              <div className="text-[11px] text-slate-500 mt-0.5">
                Skor 7,5 – 10,9
              </div>
            </div>
          </button>

          <button
            type="button"
            onClick={() => onSelectPriorityFilter(3)}
            className="bg-white rounded-2xl border border-slate-200 p-3.5 sm:p-4 text-left hover:border-emerald-300 hover:bg-emerald-50/30 active:scale-[0.99] transition-all flex flex-col justify-between gap-2 shadow-xs"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold text-emerald-800">
                Prioritas 3 · Rendah
              </span>
              <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0">
                <CheckCircle2 className="w-4 h-4" />
              </div>
            </div>
            <div>
              <div className="text-2xl font-bold text-slate-900 tabular-nums">
                {p3Count}
              </div>
              <div className="text-[11px] text-slate-500 mt-0.5">
                Skor 5,0 – 7,4
              </div>
            </div>
          </button>

          <button
            type="button"
            onClick={() => onSelectPriorityFilter('KURANG')}
            className="bg-white rounded-2xl border border-slate-200 p-3.5 sm:p-4 text-left hover:border-slate-300 hover:bg-slate-50 active:scale-[0.99] transition-all flex flex-col justify-between gap-2 shadow-xs"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold text-slate-700">
                Stok Kurang
              </span>
              <div className="w-7 h-7 rounded-lg bg-slate-100 text-red-700 flex items-center justify-center shrink-0">
                <PackageX className="w-4 h-4" />
              </div>
            </div>
            <div>
              <div className="text-2xl font-bold text-slate-900 tabular-nums">
                {lowStockCount}
              </div>
              <div className="text-[11px] text-slate-500 mt-0.5">
                Di bawah batas min
              </div>
            </div>
          </button>
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-5 items-start">
        {/* Top Priority Items for RKAP */}
        <section className="lg:col-span-7 bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-xs">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Prioritas Pengadaan Tertinggi
              </h2>
              <p className="text-xs text-slate-600">
                Urutan teratas untuk acuan pengadaan RKAP
              </p>
            </div>
          </div>

          {urgentItems.length === 0 ? (
            <div className="mt-4 py-6 text-center text-sm text-slate-600">
              Belum ada data sparepart pada file ini.
            </div>
          ) : (
            <div className="mt-3 divide-y divide-slate-100">
              {urgentItems.map((item, idx) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onEditItem(item)}
                  className="w-full py-3 text-left hover:bg-slate-50 rounded-xl px-2 -mx-2 transition-colors flex items-center justify-between gap-3"
                >
                  <div className="flex items-start gap-3 min-w-0">
                    <span className="w-6 h-6 rounded-lg bg-slate-100 text-slate-700 text-xs font-bold flex items-center justify-center shrink-0 mt-0.5 tabular-nums">
                      {idx + 1}
                    </span>
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-slate-900 truncate">
                        {item.namaPart}
                      </div>
                      <div className="mt-0.5 text-xs text-slate-600 flex flex-wrap items-center gap-x-1.5">
                        <span className="font-mono font-medium text-slate-700">
                          Rak {item.noRak}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span className="truncate">
                          {item.namaEquipment || item.lokasiUnit}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span>
                          Stok {item.sisaStokAktual} {item.satuan} ({item.statusStok})
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <div className="text-right">
                      <div className="text-base font-bold text-slate-900 tabular-nums">
                        {formatScoreId(item.totalSkor)}
                      </div>
                      <div
                        className={`text-[11px] font-bold ${
                          item.prioritas === 1
                            ? 'text-red-700'
                            : item.prioritas === 2
                              ? 'text-amber-800'
                              : 'text-emerald-800'
                        }`}
                      >
                        Prioritas {item.prioritas}
                      </div>
                    </div>
                    <ArrowRight className="w-4 h-4 text-slate-400" />
                  </div>
                </button>
              ))}
            </div>
          )}
        </section>

        {/* Weights Card */}
        <section className="lg:col-span-5 bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-xs">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Bobot Penilaian Aktif
              </h2>
              <p className="text-xs text-slate-600">
                Standar: 50% VED · 30% Lead Time · 20% Stok
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setDraftWeights(weights);
                setShowWeightEditor((v) => !v);
              }}
              className="min-h-[38px] px-3 rounded-xl border border-slate-300 text-slate-700 font-semibold text-xs hover:bg-slate-50 flex items-center gap-1.5 shrink-0"
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span>{showWeightEditor ? 'Tutup' : 'Ubah'}</span>
            </button>
          </div>

          <div className="mt-3.5 grid grid-cols-3 gap-2.5 text-center">
            <div className="bg-slate-50 rounded-xl p-2.5 border border-slate-100">
              <div className="text-[11px] font-medium text-slate-600">VED</div>
              <div className="mt-0.5 text-lg font-bold text-slate-900 tabular-nums">
                {weights.ved}%
              </div>
            </div>
            <div className="bg-slate-50 rounded-xl p-2.5 border border-slate-100">
              <div className="text-[11px] font-medium text-slate-600">
                Lead Time
              </div>
              <div className="mt-0.5 text-lg font-bold text-slate-900 tabular-nums">
                {weights.leadTime}%
              </div>
            </div>
            <div className="bg-slate-50 rounded-xl p-2.5 border border-slate-100">
              <div className="text-[11px] font-medium text-slate-600">
                Sisa Stok
              </div>
              <div className="mt-0.5 text-lg font-bold text-slate-900 tabular-nums">
                {weights.stock}%
              </div>
            </div>
          </div>

          {showWeightEditor && (
            <div className="mt-4 pt-4 border-t border-slate-100 space-y-3">
              {(
                [
                  { key: 'ved', label: 'Bobot VED' },
                  { key: 'leadTime', label: 'Bobot Lead Time' },
                  { key: 'stock', label: 'Bobot Sisa Stok' },
                ] as const
              ).map(({ key, label }) => (
                <div
                  key={key}
                  className="flex items-center justify-between gap-3"
                >
                  <span className="text-xs font-semibold text-slate-700">
                    {label}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => adjustWeight(key, -5)}
                      aria-label={`Kurangi ${label}`}
                      className="w-9 h-9 rounded-lg border border-slate-300 bg-white text-slate-900 font-bold text-sm hover:bg-slate-50"
                    >
                      −
                    </button>
                    <span className="w-12 text-center font-bold text-sm text-slate-900 tabular-nums">
                      {draftWeights[key]}%
                    </span>
                    <button
                      type="button"
                      onClick={() => adjustWeight(key, 5)}
                      aria-label={`Tambah ${label}`}
                      className="w-9 h-9 rounded-lg border border-slate-300 bg-white text-slate-900 font-bold text-sm hover:bg-slate-50"
                    >
                      +
                    </button>
                  </div>
                </div>
              ))}

              <div className="flex items-center justify-between text-xs pt-1">
                <span className="font-semibold text-slate-600">
                  Total (harus 100%)
                </span>
                <span
                  className={`font-bold tabular-nums ${
                    weightSum === 100 ? 'text-emerald-700' : 'text-red-700'
                  }`}
                >
                  {weightSum}%
                </span>
              </div>

              <div className="flex flex-wrap gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setDraftWeights({ ...DEFAULT_WEIGHTS })}
                  className="min-h-[40px] px-3 rounded-xl border border-slate-300 text-slate-700 text-xs font-semibold hover:bg-slate-50"
                >
                  Reset (50/30/20)
                </button>
                <button
                  type="button"
                  disabled={weightSum !== 100 || !isWeightChanged}
                  onClick={() => onRequestSaveWeights(draftWeights)}
                  className="flex-1 min-h-[40px] px-3.5 rounded-xl bg-blue-800 hover:bg-blue-900 disabled:bg-slate-300 text-white text-xs font-semibold"
                >
                  Simpan Bobot
                </button>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
};
