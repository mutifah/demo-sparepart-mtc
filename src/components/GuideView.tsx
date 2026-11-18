import React from 'react';
import {
  BookOpen,
  ExternalLink,
  FileSpreadsheet,
  FolderSync,
  LogOut,
  ShieldCheck,
} from 'lucide-react';
import { ScoringWeights } from '../types/sparepart';

interface GuideViewProps {
  spreadsheetTitle: string;
  webViewLink?: string;
  sheetNames: string[];
  hasStandardStructure: boolean;
  weights: ScoringWeights;
  userEmail: string;
  onChangeFile: () => void;
  onLogout: () => void;
}

export const GuideView: React.FC<GuideViewProps> = ({
  spreadsheetTitle,
  webViewLink,
  sheetNames,
  hasStandardStructure,
  weights,
  userEmail,
  onChangeFile,
  onLogout,
}) => {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-5 items-start">
      {/* Connected Google Spreadsheet Info */}
      <section className="lg:col-span-5 bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 space-y-4 shadow-xs">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0">
            <FileSpreadsheet className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <h2 className="text-base font-bold text-slate-900">
              File Google Drive Terhubung
            </h2>
            <p className="text-sm font-semibold text-blue-800 break-words mt-0.5">
              {spreadsheetTitle}
            </p>
            <p className="text-xs text-slate-600 mt-0.5">Akun: {userEmail}</p>
          </div>
        </div>

        <div className="bg-slate-50 rounded-xl p-3.5 text-xs text-slate-700 space-y-1 border border-slate-100">
          <div className="font-semibold text-slate-900">
            Tab dalam file ({sheetNames.length}):
          </div>
          <div className="leading-relaxed">{sheetNames.join(' · ')}</div>
          {!hasStandardStructure && (
            <div className="pt-1.5 text-amber-800 font-medium">
              Pastikan file memiliki tab 1_ASSET_VED, 2_LEAD_TIME, 3_SISA_STOK,
              dan 4_SKORING agar sinkronisasi penuh berjalan lancar.
            </div>
          )}
        </div>

        <div className="space-y-2.5">
          {webViewLink && (
            <a
              href={webViewLink}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full min-h-[44px] px-4 py-2.5 rounded-xl bg-blue-800 hover:bg-blue-900 text-white font-semibold text-sm flex items-center justify-center gap-2 transition-colors"
            >
              <ExternalLink className="w-4 h-4" />
              <span>Buka di Google Sheets</span>
            </a>
          )}
          <button
            type="button"
            onClick={onChangeFile}
            className="w-full min-h-[44px] px-4 py-2.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 font-semibold text-sm flex items-center justify-center gap-2 transition-colors"
          >
            <FolderSync className="w-4 h-4" />
            <span>Ganti / Buat File Spreadsheet</span>
          </button>
          <button
            type="button"
            onClick={onLogout}
            className="w-full min-h-[44px] px-4 py-2.5 rounded-xl border border-red-200 bg-white hover:bg-red-50 text-red-700 font-semibold text-sm flex items-center justify-center gap-2 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            <span>Keluar dari Akun Google</span>
          </button>
        </div>
      </section>

      {/* Scoring Formula & ISO 55001 Reference */}
      <section className="lg:col-span-7 bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 space-y-4 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-800 flex items-center justify-center shrink-0">
            <BookOpen className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900">
              Panduan Rumus &amp; Skoring
            </h2>
            <p className="text-xs text-slate-600">
              Criticality Assessment · ISO 55001 Asset Management
            </p>
          </div>
        </div>

        <div className="bg-blue-50/80 border border-blue-100 rounded-xl p-3.5 text-slate-900">
          <div className="text-xs font-semibold text-blue-900">
            Rumus Skor Total (Bobot Aktif)
          </div>
          <div className="mt-0.5 text-sm font-bold tabular-nums">
            Skor = ({weights.ved}% × VED) + ({weights.leadTime}% × Lead Time) + ({weights.stock}% × Sisa Stok)
          </div>
        </div>

        <div className="space-y-3.5 text-xs sm:text-[13px] text-slate-700">
          <div>
            <h3 className="text-sm font-bold text-slate-900">
              1. VED · Tingkat Kekritisan ({weights.ved}%)
            </h3>
            <ul className="mt-1.5 space-y-1">
              <li>
                <strong className="text-slate-900">V · Vital (15):</strong>{' '}
                Produksi berhenti total jika rusak.
              </li>
              <li>
                <strong className="text-slate-900">E · Essential (10):</strong>{' '}
                Produksi terganggu, tapi bisa disiasati sementara.
              </li>
              <li>
                <strong className="text-slate-900">D · Desirable (5):</strong>{' '}
                Tidak langsung memengaruhi produksi.
              </li>
            </ul>
          </div>

          <div className="pt-3 border-t border-slate-100">
            <h3 className="text-sm font-bold text-slate-900">
              2. Lead Time · Lama Datang ({weights.leadTime}%)
            </h3>
            <ul className="mt-1.5 space-y-1">
              <li>
                <strong className="text-slate-900">Impor / Indent &gt; 1 bln (15):</strong>{' '}
                Estimasi 3–6 bulan.
              </li>
              <li>
                <strong className="text-slate-900">Distributor 1–4 mgg (10):</strong>{' '}
                Estimasi 1–4 minggu.
              </li>
              <li>
                <strong className="text-slate-900">Lokal &lt; 1 mgg (5):</strong>{' '}
                Barang tersedia cepat.
              </li>
            </ul>
          </div>

          <div className="pt-3 border-t border-slate-100">
            <h3 className="text-sm font-bold text-slate-900">
              3. Sisa Stok Gudang ({weights.stock}%)
            </h3>
            <ul className="mt-1.5 space-y-1">
              <li>
                <strong className="text-red-700">Stok &lt; Min (15):</strong>{' '}
                Stok kurang dari batas minimum.
              </li>
              <li>
                <strong className="text-amber-800">Min ≤ Stok &lt; 2×Min (10):</strong>{' '}
                Stok menipis, perlu dipantau.
              </li>
              <li>
                <strong className="text-emerald-800">Stok ≥ 2×Min (5):</strong>{' '}
                Stok aman.
              </li>
            </ul>
          </div>

          <div className="pt-3 border-t border-slate-100">
            <h3 className="text-sm font-bold text-slate-900">
              4. Kategori Prioritas
            </h3>
            <div className="mt-2 grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <div className="rounded-xl bg-red-50 border border-red-200 p-2.5">
                <div className="text-xs font-bold text-red-800">Prioritas 1</div>
                <div className="text-sm font-bold text-slate-900 tabular-nums">
                  11,0 – 15,0
                </div>
                <div className="text-[11px] text-slate-700 mt-0.5">
                  Order segera, masuk anggaran Q1 tahun berikutnya
                </div>
              </div>
              <div className="rounded-xl bg-amber-50 border border-amber-200 p-2.5">
                <div className="text-xs font-bold text-amber-800">Prioritas 2</div>
                <div className="text-sm font-bold text-slate-900 tabular-nums">
                  7,5 – 10,9
                </div>
                <div className="text-[11px] text-slate-700 mt-0.5">
                  Masuk anggaran tahun berjalan, monitor ketat
                </div>
              </div>
              <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-2.5">
                <div className="text-xs font-bold text-emerald-800">Prioritas 3</div>
                <div className="text-sm font-bold text-slate-900 tabular-nums">
                  5,0 – 7,4
                </div>
                <div className="text-[11px] text-slate-700 mt-0.5">
                  Stok aman, order saat mendekati min
                </div>
              </div>
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100 flex items-start gap-2 text-xs text-slate-600">
            <ShieldCheck className="w-4 h-4 text-blue-800 shrink-0 mt-0.5" />
            <span>
              VED &amp; Lead Time bersifat statis, sedangkan Sisa Stok dinamis
              diperbarui tiap siklus perencanaan.
            </span>
          </div>
        </div>
      </section>
    </div>
  );
};
