import React, { useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  Minus,
  Plus,
  RotateCcw,
  Save,
  Search,
} from 'lucide-react';
import { ComputedSparepart, ScoringWeights, SparepartItem } from '../types/sparepart';
import { computeSparepart, formatScoreId } from '../utils/scoring';

interface QuickStockViewProps {
  items: ComputedSparepart[];
  weights: ScoringWeights;
  onRequestSaveBulkStock: (updatedItems: SparepartItem[]) => void;
}

export const QuickStockView: React.FC<QuickStockViewProps> = ({
  items,
  weights,
  onRequestSaveBulkStock,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [onlyNeedsCheck, setOnlyNeedsCheck] = useState(false);
  const [draftStocks, setDraftStocks] = useState<Record<string, number>>({});

  useEffect(() => {
    setDraftStocks({});
  }, [items]);

  const changedIds = useMemo(
    () =>
      Object.keys(draftStocks).filter((id) => {
        const orig = items.find((i) => i.id === id);
        return orig && draftStocks[id] !== orig.sisaStokAktual;
      }),
    [draftStocks, items]
  );

  const visibleItems = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return [...items]
      .sort((a, b) => a.noRak.localeCompare(b.noRak))
      .filter((item) => {
        if (onlyNeedsCheck && item.statusStok === 'AMAN') return false;
        if (!q) return true;
        return (
          item.namaPart.toLowerCase().includes(q) ||
          item.noRak.toLowerCase().includes(q)
        );
      });
  }, [items, searchQuery, onlyNeedsCheck]);

  const getCurrentQty = (item: ComputedSparepart) =>
    draftStocks[item.id] !== undefined
      ? draftStocks[item.id]
      : item.sisaStokAktual;

  const setQty = (item: ComputedSparepart, nextVal: number) => {
    const clamped = Math.max(0, Math.round(nextVal));
    setDraftStocks((prev) => ({
      ...prev,
      [item.id]: clamped,
    }));
  };

  const handleApplySave = () => {
    const updatedList: SparepartItem[] = items.map((item) => {
      const nextStock =
        draftStocks[item.id] !== undefined
          ? draftStocks[item.id]
          : item.sisaStokAktual;
      return {
        id: item.id,
        noRak: item.noRak,
        namaPart: item.namaPart,
        spesifikasiMerk: item.spesifikasiMerk,
        lokasiUnit: item.lokasiUnit,
        subLokasi: item.subLokasi,
        namaEquipment: item.namaEquipment,
        vedEquipment: item.vedEquipment,
        vedPart: item.vedPart,
        leadTimeCategory: item.leadTimeCategory,
        estimasiWaktu: item.estimasiWaktu,
        satuan: item.satuan,
        minStok: item.minStok,
        maxStok: item.maxStok,
        sisaStokAktual: nextStock,
        rowRefs: item.rowRefs,
      };
    });
    onRequestSaveBulkStock(updatedList);
  };

  return (
    <div className="space-y-3.5 pb-20">
      <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3 shadow-xs">
        <div>
          <h2 className="text-base font-bold text-slate-900">
            Cek Stok Fisik Gudang
          </h2>
          <p className="text-xs text-slate-600 mt-0.5">
            Ubah jumlah stok fisik di rak, lalu simpan langsung ke tab
            3_SISA_STOK.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-2.5">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari nomor rak atau nama barang..."
              className="w-full min-h-[44px] pl-10 pr-4 py-2 rounded-xl border border-slate-300 bg-slate-50 text-sm text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-700"
            />
          </div>
          <button
            type="button"
            onClick={() => setOnlyNeedsCheck((v) => !v)}
            className={`min-h-[44px] px-3.5 rounded-xl text-xs font-semibold whitespace-nowrap shrink-0 transition-colors ${
              onlyNeedsCheck
                ? 'bg-slate-900 text-white'
                : 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
            }`}
          >
            {onlyNeedsCheck ? 'Tampilkan Semua' : 'Hanya Stok Kurang / Menipis'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {visibleItems.map((item) => {
          const currentQty = getCurrentQty(item);
          const isModified = currentQty !== item.sisaStokAktual;
          const preview = computeSparepart(
            { ...item, sisaStokAktual: currentQty },
            weights
          );

          return (
            <div
              key={item.id}
              className={`bg-white rounded-2xl border p-3.5 sm:p-4 transition-colors shadow-xs ${
                isModified ? 'border-blue-600 bg-blue-50/20' : 'border-slate-200'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-xs font-mono font-semibold text-blue-800">
                    Rak {item.noRak}
                  </div>
                  <h3 className="mt-0.5 text-sm font-bold text-slate-900 leading-snug">
                    {item.namaPart}
                  </h3>
                  <div className="mt-0.5 text-xs text-slate-600 tabular-nums">
                    Min {item.minStok} · Max {item.maxStok} {item.satuan}
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <div
                    className={`text-xs font-bold ${
                      preview.statusStok === 'KURANG'
                        ? 'text-red-700'
                        : preview.statusStok === 'MENIPIS'
                          ? 'text-amber-800'
                          : 'text-emerald-800'
                    }`}
                  >
                    {preview.statusStok} ({preview.skorSisaStok})
                  </div>
                  <div className="text-[11px] text-slate-600 mt-0.5 tabular-nums">
                    Skor {formatScoreId(preview.totalSkor)} · P{preview.prioritas}
                  </div>
                </div>
              </div>

              {/* Compact Warehouse Stepper */}
              <div className="mt-3 flex items-center justify-between gap-2 bg-slate-50 rounded-xl p-1.5 border border-slate-100">
                <button
                  type="button"
                  onClick={() => setQty(item, currentQty - 1)}
                  aria-label={`Kurangi stok ${item.namaPart}`}
                  className="w-11 h-11 rounded-lg bg-white border border-slate-300 text-slate-900 flex items-center justify-center hover:bg-slate-100 active:scale-95 transition-transform shrink-0"
                >
                  <Minus className="w-4 h-4" />
                </button>

                <div className="flex-1 text-center">
                  <div className="inline-flex items-baseline gap-1.5">
                    <input
                      type="number"
                      min={0}
                      inputMode="numeric"
                      value={currentQty}
                      onChange={(e) => setQty(item, Number(e.target.value || 0))}
                      aria-label={`Jumlah stok ${item.namaPart}`}
                      className="w-16 text-center text-lg font-bold text-slate-900 bg-transparent border-b border-slate-300 focus:border-blue-700 focus:outline-none tabular-nums"
                    />
                    <span className="text-xs font-medium text-slate-600">
                      {item.satuan}
                    </span>
                  </div>
                  {isModified && (
                    <div className="text-[11px] text-blue-800 font-medium">
                      Sebelumnya {item.sisaStokAktual}
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => setQty(item, currentQty + 1)}
                  aria-label={`Tambah stok ${item.namaPart}`}
                  className="w-11 h-11 rounded-lg bg-white border border-slate-300 text-slate-900 flex items-center justify-center hover:bg-slate-100 active:scale-95 transition-transform shrink-0"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Floating Save Bar */}
      {changedIds.length > 0 && (
        <div className="fixed bottom-17 lg:bottom-4 left-0 right-0 z-30 px-4 pointer-events-none">
          <div className="max-w-xl mx-auto bg-slate-900 text-white rounded-2xl p-3 shadow-xl flex items-center justify-between gap-3 pointer-events-auto">
            <div className="flex items-center gap-2 min-w-0">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span className="text-xs sm:text-sm font-semibold truncate">
                {changedIds.length} barang diubah
              </span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setDraftStocks({})}
                aria-label="Reset perubahan stok"
                className="min-h-[38px] px-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset</span>
              </button>
              <button
                type="button"
                onClick={handleApplySave}
                className="min-h-[38px] px-3.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs sm:text-sm font-semibold flex items-center gap-1.5"
              >
                <Save className="w-3.5 h-3.5" />
                <span>Simpan Stok</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
