import React, { useMemo, useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Plus,
  Search,
  Sliders,
} from 'lucide-react';
import { ComputedSparepart, PriorityLevel } from '../types/sparepart';
import { formatScoreId } from '../utils/scoring';

export type ScoringFilter = 'ALL' | PriorityLevel | 'KURANG';

interface ScoringListViewProps {
  items: ComputedSparepart[];
  activeFilter: ScoringFilter;
  onChangeFilter: (f: ScoringFilter) => void;
  onEditItem: (item: ComputedSparepart) => void;
  onAddNew: () => void;
}

export const ScoringListView: React.FC<ScoringListViewProps> = ({
  items,
  activeFilter,
  onChangeFilter,
  onEditItem,
  onAddNew,
}) => {
  const [searchQuery, setSearchQuery] = useState('');

  const filteredItems = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return items
      .filter((item) => {
        if (activeFilter === 'KURANG') {
          if (item.statusStok !== 'KURANG') return false;
        } else if (activeFilter !== 'ALL') {
          if (item.prioritas !== activeFilter) return false;
        }
        if (!q) return true;
        return (
          item.namaPart.toLowerCase().includes(q) ||
          item.noRak.toLowerCase().includes(q) ||
          item.namaEquipment.toLowerCase().includes(q) ||
          item.spesifikasiMerk.toLowerCase().includes(q) ||
          item.lokasiUnit.toLowerCase().includes(q)
        );
      })
      .sort((a, b) => b.totalSkor - a.totalSkor);
  }, [items, activeFilter, searchQuery]);

  const filterButtons: Array<{ key: ScoringFilter; label: string }> = [
    { key: 'ALL', label: `Semua (${items.length})` },
    {
      key: 1,
      label: `Prioritas 1 (${items.filter((i) => i.prioritas === 1).length})`,
    },
    {
      key: 2,
      label: `Prioritas 2 (${items.filter((i) => i.prioritas === 2).length})`,
    },
    {
      key: 3,
      label: `Prioritas 3 (${items.filter((i) => i.prioritas === 3).length})`,
    },
    {
      key: 'KURANG',
      label: `Stok Kurang (${items.filter((i) => i.statusStok === 'KURANG').length})`,
    },
  ];

  return (
    <div className="space-y-3.5">
      {/* Search and Add New Bar */}
      <div className="flex flex-col sm:flex-row gap-2.5">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari nama sparepart, equipment, atau no. rak..."
            className="w-full min-h-[44px] pl-10 pr-4 py-2 rounded-xl border border-slate-300 bg-white text-sm text-slate-900 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-700"
          />
        </div>
        <button
          type="button"
          onClick={onAddNew}
          className="min-h-[44px] px-4 py-2 rounded-xl bg-blue-800 hover:bg-blue-900 active:scale-[0.99] text-white font-semibold text-sm flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0 transition-all"
        >
          <Plus className="w-4 h-4" />
          <span>Tambah Sparepart</span>
        </button>
      </div>

      {/* Horizontal Filter Buttons */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
        {filterButtons.map((btn) => {
          const isActive = activeFilter === btn.key;
          return (
            <button
              key={String(btn.key)}
              type="button"
              onClick={() => onChangeFilter(btn.key)}
              className={`min-h-[38px] px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap shrink-0 transition-colors ${
                isActive
                  ? 'bg-slate-900 text-white'
                  : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
              }`}
            >
              {btn.label}
            </button>
          );
        })}
      </div>

      {/* Results List */}
      {filteredItems.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-7 text-center space-y-1.5">
          <p className="text-sm font-bold text-slate-900">
            Sparepart tidak ditemukan
          </p>
          <p className="text-xs text-slate-600">
            Coba ubah kata kunci pencarian atau pilih filter &ldquo;Semua&rdquo;.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {filteredItems.map((item) => {
            const priorityStyles =
              item.prioritas === 1
                ? {
                    bar: 'bg-red-600',
                    label: 'text-red-700',
                    Icon: AlertCircle,
                    text: 'Prioritas 1 · Kritis',
                  }
                : item.prioritas === 2
                  ? {
                      bar: 'bg-amber-500',
                      label: 'text-amber-800',
                      Icon: AlertTriangle,
                      text: 'Prioritas 2 · Sedang',
                    }
                  : {
                      bar: 'bg-emerald-600',
                      label: 'text-emerald-800',
                      Icon: CheckCircle2,
                      text: 'Prioritas 3 · Rendah',
                    };

            const PriorityIcon = priorityStyles.Icon;
            const scorePct = Math.min(100, Math.round((item.totalSkor / 15) * 100));

            return (
              <article
                key={item.id}
                className="bg-white rounded-2xl border border-slate-200 p-4 flex flex-col justify-between gap-3.5 shadow-xs hover:border-slate-300 transition-colors"
              >
                <div>
                  {/* Priority Status + Score Meter */}
                  <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-slate-100">
                    <div
                      className={`flex items-center gap-1.5 text-xs font-bold ${priorityStyles.label}`}
                    >
                      <PriorityIcon className="w-4 h-4 shrink-0" />
                      <span>{priorityStyles.text}</span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <div className="w-12 h-1.5 rounded-full bg-slate-100 overflow-hidden hidden sm:block">
                        <div
                          style={{ width: `${scorePct}%` }}
                          className={`h-full rounded-full ${priorityStyles.bar}`}
                        />
                      </div>
                      <span className="text-sm font-bold text-slate-900 tabular-nums">
                        {formatScoreId(item.totalSkor)}
                      </span>
                    </div>
                  </div>

                  {/* Title & Unboxed Metadata */}
                  <h3 className="mt-2.5 text-[15px] font-bold text-slate-900 leading-snug">
                    {item.namaPart}
                  </h3>
                  {item.spesifikasiMerk && (
                    <p className="mt-0.5 text-xs text-slate-600 line-clamp-1">
                      {item.spesifikasiMerk}
                    </p>
                  )}
                  <div className="mt-1.5 text-xs text-slate-600 flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
                    <span className="font-mono font-semibold text-slate-800">
                      Rak {item.noRak}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span className="truncate max-w-[180px]">
                      {item.namaEquipment || 'Equipment umum'}
                    </span>
                    {item.lokasiUnit && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span>{item.lokasiUnit}</span>
                      </>
                    )}
                  </div>

                  {/* Compact 3-Parameter Grid */}
                  <div className="mt-3 grid grid-cols-3 gap-1.5 bg-slate-50 rounded-xl py-2 px-2.5 text-center border border-slate-100">
                    <div>
                      <div className="text-[11px] font-medium text-slate-500">
                        VED
                      </div>
                      <div className="mt-0.5 text-xs font-bold text-slate-900 tabular-nums">
                        {item.ved} ({item.skorVed})
                      </div>
                    </div>
                    <div>
                      <div className="text-[11px] font-medium text-slate-500">
                        Lead Time
                      </div>
                      <div className="mt-0.5 text-xs font-bold text-slate-900 tabular-nums">
                        {item.skorLeadTime}
                      </div>
                    </div>
                    <div>
                      <div className="text-[11px] font-medium text-slate-500">
                        Sisa Stok
                      </div>
                      <div
                        className={`mt-0.5 text-xs font-bold tabular-nums ${
                          item.statusStok === 'KURANG'
                            ? 'text-red-700'
                            : item.statusStok === 'MENIPIS'
                              ? 'text-amber-800'
                              : 'text-emerald-800'
                        }`}
                      >
                        {item.sisaStokAktual} {item.satuan}
                      </div>
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => onEditItem(item)}
                  className="w-full min-h-[40px] px-3.5 py-2 rounded-xl border border-slate-200 bg-slate-50/70 hover:bg-blue-50 hover:border-blue-300 text-blue-800 font-semibold text-xs flex items-center justify-center gap-1.5 transition-colors"
                >
                  <Sliders className="w-3.5 h-3.5" />
                  <span>Ubah Nilai &amp; Stok</span>
                </button>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
};
