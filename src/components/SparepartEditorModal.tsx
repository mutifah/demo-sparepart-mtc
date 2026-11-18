import React, { useEffect, useState } from 'react';
import { Minus, Plus, Save, Trash2, X } from 'lucide-react';
import {
  LeadTimeCategory,
  ScoringWeights,
  SparepartItem,
  VedCode,
} from '../types/sparepart';
import {
  computeSparepart,
  defaultEstimasiForLeadTime,
  formatScoreId,
  generateItemId,
  LEAD_TIME_OPTIONS,
  VED_OPTIONS,
} from '../utils/scoring';

interface SparepartEditorModalProps {
  open: boolean;
  initialItem: SparepartItem | null;
  weights: ScoringWeights;
  onClose: () => void;
  onRequestSave: (item: SparepartItem, isNew: boolean) => void;
  onRequestDelete: (item: SparepartItem) => void;
}

const createEmptyItem = (): SparepartItem => ({
  id: generateItemId(),
  noRak: '',
  namaPart: '',
  spesifikasiMerk: '',
  lokasiUnit: 'WTP',
  subLokasi: '',
  namaEquipment: '',
  ved: 'E',
  leadTimeCategory: 'Distributor 1-4 mgg',
  estimasiWaktu: '1-4 minggu',
  satuan: 'pcs',
  minStok: 1,
  maxStok: 2,
  sisaStokAktual: 1,
});

export const SparepartEditorModal: React.FC<SparepartEditorModalProps> = ({
  open,
  initialItem,
  weights,
  onClose,
  onRequestSave,
  onRequestDelete,
}) => {
  const isNew = !initialItem;
  const [form, setForm] = useState<SparepartItem>(createEmptyItem);
  const [validationError, setValidationError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setForm(initialItem ? { ...initialItem } : createEmptyItem());
      setValidationError(null);
    }
  }, [open, initialItem]);

  if (!open) return null;

  const preview = computeSparepart(form, weights);

  const handleSelectLeadTime = (cat: LeadTimeCategory) => {
    setForm((prev) => ({
      ...prev,
      leadTimeCategory: cat,
      estimasiWaktu: defaultEstimasiForLeadTime(cat),
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.namaPart.trim()) {
      setValidationError('Nama Sparepart wajib diisi terlebih dahulu.');
      return;
    }
    const cleaned: SparepartItem = {
      ...form,
      noRak: form.noRak.trim() || '-',
      namaPart: form.namaPart.trim(),
      spesifikasiMerk: form.spesifikasiMerk.trim(),
      lokasiUnit: form.lokasiUnit.trim() || 'WTP',
      subLokasi: form.subLokasi.trim(),
      namaEquipment: form.namaEquipment.trim(),
      satuan: form.satuan.trim() || 'pcs',
    };
    onRequestSave(cleaned, isNew);
  };

  const adjustInt = (
    field: 'minStok' | 'maxStok' | 'sisaStokAktual',
    delta: number
  ) => {
    setForm((prev) => ({
      ...prev,
      [field]: Math.max(0, prev[field] + delta),
    }));
  };

  return (
    <div
      className="fixed inset-0 z-40 flex items-end sm:items-center justify-center bg-slate-950/60 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-labelledby="editor-modal-title"
    >
      <div className="w-full sm:max-w-xl bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl border border-slate-200 max-h-[90vh] flex flex-col overflow-hidden">
        {/* Sticky Modal Header */}
        <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between gap-3 shrink-0 bg-white">
          <div>
            <h2
              id="editor-modal-title"
              className="text-base font-bold text-slate-900"
            >
              {isNew ? 'Tambah Sparepart Baru' : 'Ubah Skoring & Stok'}
            </h2>
            <p className="text-xs text-slate-500">
              Skor dan prioritas dihitung otomatis
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup form"
            className="min-h-[40px] min-w-[40px] rounded-xl text-slate-600 hover:bg-slate-100 flex items-center justify-center shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <form
          id="sparepart-editor-form"
          onSubmit={handleSubmit}
          className="flex-1 overflow-y-auto px-5 py-4 space-y-5"
        >
          {validationError && (
            <div
              className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs font-semibold"
              role="alert"
            >
              {validationError}
            </div>
          )}

          {/* 1. Data Sparepart */}
          <section className="space-y-3">
            <h3 className="text-sm font-bold text-slate-900">
              1. Data Sparepart &amp; Equipment
            </h3>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Nama Sparepart *
              </label>
              <input
                type="text"
                required
                value={form.namaPart}
                onChange={(e) =>
                  setForm((p) => ({ ...p, namaPart: e.target.value }))
                }
                placeholder="Contoh: Mechanical Seal Pompa Submersible"
                className="w-full min-h-[42px] px-3.5 py-2 rounded-xl border border-slate-300 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-700"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Spesifikasi &amp; Merk
              </label>
              <input
                type="text"
                value={form.spesifikasiMerk}
                onChange={(e) =>
                  setForm((p) => ({ ...p, spesifikasiMerk: e.target.value }))
                }
                placeholder="Contoh: DN-400, Festo / 6ES7531, Siemens"
                className="w-full min-h-[42px] px-3.5 py-2 rounded-xl border border-slate-300 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-700"
              />
            </div>

            <div className="grid grid-cols-3 gap-2.5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  No. Rak
                </label>
                <input
                  type="text"
                  value={form.noRak}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, noRak: e.target.value }))
                  }
                  placeholder="RK012C"
                  className="w-full min-h-[42px] px-3 py-2 rounded-xl border border-slate-300 font-mono text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-700"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Satuan
                </label>
                <input
                  type="text"
                  value={form.satuan}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, satuan: e.target.value }))
                  }
                  placeholder="pcs / set"
                  className="w-full min-h-[42px] px-3 py-2 rounded-xl border border-slate-300 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-700"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Lokasi
                </label>
                <input
                  type="text"
                  value={form.lokasiUnit}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, lokasiUnit: e.target.value }))
                  }
                  placeholder="Intake / WTP"
                  className="w-full min-h-[42px] px-3 py-2 rounded-xl border border-slate-300 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-700"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Nama Equipment / Mesin
                </label>
                <input
                  type="text"
                  value={form.namaEquipment}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, namaEquipment: e.target.value }))
                  }
                  placeholder="Contoh: Pompa Submersible Xylem 1-6"
                  className="w-full min-h-[42px] px-3.5 py-2 rounded-xl border border-slate-300 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-700"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Sub Lokasi
                </label>
                <input
                  type="text"
                  value={form.subLokasi}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, subLokasi: e.target.value }))
                  }
                  placeholder="Contoh: Sumur Pompa"
                  className="w-full min-h-[42px] px-3.5 py-2 rounded-xl border border-slate-300 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-700"
                />
              </div>
            </div>
          </section>

          {/* 2. Single VED Parameter */}
          <section className="pt-4 border-t border-slate-100 space-y-2.5">
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                2. Parameter VED · Kekritisan ({weights.ved}%)
              </h3>
              <p className="text-xs text-slate-600">
                Pilih satu tingkat kekritisan sparepart terhadap produksi
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {VED_OPTIONS.map((opt) => {
                const selected = form.ved === opt.code;
                return (
                  <button
                    key={opt.code}
                    type="button"
                    onClick={() =>
                      setForm((p) => ({ ...p, ved: opt.code as VedCode }))
                    }
                    className={`p-3 rounded-xl border text-left transition-all ${
                      selected
                        ? 'border-blue-800 bg-blue-50 ring-2 ring-blue-700'
                        : 'border-slate-200 bg-white hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-bold text-slate-900">
                        {opt.label}
                      </span>
                      <span className="text-xs font-bold text-blue-800 tabular-nums">
                        {opt.score}
                      </span>
                    </div>
                    <p className="mt-1 text-[11px] text-slate-600 leading-snug">
                      {opt.description}
                    </p>
                  </button>
                );
              })}
            </div>
          </section>

          {/* 3. Lead Time */}
          <section className="pt-4 border-t border-slate-100 space-y-2.5">
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                3. Lead Time · Lama Pengadaan ({weights.leadTime}%)
              </h3>
              <p className="text-xs text-slate-600">
                Berapa lama barang datang sejak order dilakukan?
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {LEAD_TIME_OPTIONS.map((opt) => {
                const selected = form.leadTimeCategory === opt.category;
                return (
                  <button
                    key={opt.category}
                    type="button"
                    onClick={() => handleSelectLeadTime(opt.category)}
                    className={`p-3 rounded-xl border text-left transition-all ${
                      selected
                        ? 'border-blue-800 bg-blue-50 ring-2 ring-blue-700'
                        : 'border-slate-200 bg-white hover:bg-slate-50'
                    }`}
                  >
                    <div className="text-xs font-bold text-slate-900">
                      {opt.shortLabel}
                    </div>
                    <div className="mt-0.5 text-xs font-semibold text-blue-800 tabular-nums">
                      Skor {opt.score}
                    </div>
                  </button>
                );
              })}
            </div>
          </section>

          {/* 4. Sisa Stok Gudang */}
          <section className="pt-4 border-t border-slate-100 space-y-2.5">
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                4. Sisa Stok Gudang ({weights.stock}%)
              </h3>
              <p className="text-xs text-slate-600">
                Status:{' '}
                <strong
                  className={
                    preview.statusStok === 'KURANG'
                      ? 'text-red-700'
                      : preview.statusStok === 'MENIPIS'
                        ? 'text-amber-800'
                        : 'text-emerald-800'
                  }
                >
                  {preview.statusStok} (Skor {preview.skorSisaStok})
                </strong>{' '}
                · &lt; Min = 15, Min s/d &lt;2×Min = 10, ≥2×Min = 5
              </p>
            </div>

            <div className="grid grid-cols-3 gap-2.5">
              {(
                [
                  { field: 'minStok', label: 'Min Stok' },
                  { field: 'maxStok', label: 'Max Stok' },
                  { field: 'sisaStokAktual', label: 'Sisa Aktual' },
                ] as const
              ).map(({ field, label }) => (
                <div
                  key={field}
                  className={`rounded-xl border p-2.5 ${
                    field === 'sisaStokAktual'
                      ? 'border-blue-300 bg-blue-50/40'
                      : 'border-slate-200 bg-slate-50'
                  }`}
                >
                  <div className="text-[11px] font-bold text-slate-700 text-center">
                    {label}
                  </div>
                  <div className="mt-1.5 flex items-center justify-between gap-1">
                    <button
                      type="button"
                      onClick={() => adjustInt(field, -1)}
                      aria-label={`Kurangi ${label}`}
                      className="w-8 h-8 rounded-lg bg-white border border-slate-300 text-slate-900 flex items-center justify-center hover:bg-slate-100 shrink-0"
                    >
                      <Minus className="w-3.5 h-3.5" />
                    </button>
                    <input
                      type="number"
                      min={0}
                      inputMode="numeric"
                      value={form[field]}
                      onChange={(e) =>
                        setForm((p) => ({
                          ...p,
                          [field]: Math.max(0, Number(e.target.value || 0)),
                        }))
                      }
                      aria-label={label}
                      className="w-10 text-center text-base font-bold text-slate-900 bg-transparent focus:outline-none tabular-nums"
                    />
                    <button
                      type="button"
                      onClick={() => adjustInt(field, 1)}
                      aria-label={`Tambah ${label}`}
                      className="w-8 h-8 rounded-lg bg-white border border-slate-300 text-slate-900 flex items-center justify-center hover:bg-slate-100 shrink-0"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {!isNew && (
            <div className="pt-1">
              <button
                type="button"
                onClick={() => onRequestDelete(form)}
                className="w-full min-h-[42px] px-4 py-2 rounded-xl border border-red-200 text-red-700 hover:bg-red-50 font-semibold text-xs flex items-center justify-center gap-1.5"
              >
                <Trash2 className="w-4 h-4" />
                <span>Hapus Sparepart Ini</span>
              </button>
            </div>
          )}
        </form>

        {/* Live Score Preview + Save Footer */}
        <div className="px-5 py-3.5 border-t border-slate-200 bg-slate-50 shrink-0 space-y-2.5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-[11px] font-medium text-slate-500">
                Hasil Perhitungan Otomatis
              </div>
              <div className="text-xs sm:text-sm font-bold text-slate-900 tabular-nums">
                {formatScoreId(preview.vedBobot)} +{' '}
                {formatScoreId(preview.ltBobot)} +{' '}
                {formatScoreId(preview.stokBobot)} ={' '}
                <span className="text-base text-blue-900">
                  {formatScoreId(preview.totalSkor)}
                </span>
              </div>
            </div>
            <div
              className={`px-2.5 py-1 rounded-lg text-xs font-bold shrink-0 ${
                preview.prioritas === 1
                  ? 'bg-red-100 text-red-800'
                  : preview.prioritas === 2
                    ? 'bg-amber-100 text-amber-900'
                    : 'bg-emerald-100 text-emerald-800'
              }`}
            >
              Prioritas {preview.prioritas}
            </div>
          </div>

          <button
            type="submit"
            form="sparepart-editor-form"
            className="w-full min-h-[46px] px-4 py-2.5 rounded-xl bg-blue-800 hover:bg-blue-900 text-white font-semibold text-sm flex items-center justify-center gap-2 transition-colors"
          >
            <Save className="w-4 h-4" />
            <span>Simpan ke Google Spreadsheet</span>
          </button>
        </div>
      </div>
    </div>
  );
};
