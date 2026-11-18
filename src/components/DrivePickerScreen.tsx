import React, { useEffect, useState } from 'react';
import {
  ChevronRight,
  FilePlus2,
  FileSpreadsheet,
  LogOut,
  RefreshCw,
  Search,
  Wrench,
} from 'lucide-react';
import { DriveSpreadsheetFile } from '../types/sparepart';

interface DrivePickerScreenProps {
  userEmail: string;
  userName?: string | null;
  files: DriveSpreadsheetFile[];
  isLoadingFiles: boolean;
  isOpeningFile: boolean;
  isCreatingFile: boolean;
  error: string | null;
  onSearch: (query: string) => void;
  onRefresh: () => void;
  onSelectFile: (file: DriveSpreadsheetFile) => void;
  onCreateTemplate: (title: string) => void;
  onLogout: () => void;
}

export const DrivePickerScreen: React.FC<DrivePickerScreenProps> = ({
  userEmail,
  userName,
  files,
  isLoadingFiles,
  isOpeningFile,
  isCreatingFile,
  error,
  onSearch,
  onRefresh,
  onSelectFile,
  onCreateTemplate,
  onLogout,
}) => {
  const [searchInput, setSearchInput] = useState('');
  const [newFileTitle, setNewFileTitle] = useState('Skoring Prioritas Sparepart');

  useEffect(() => {
    const timer = setTimeout(() => {
      onSearch(searchInput);
    }, 350);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchInput]);

  const formatDate = (iso?: string) => {
    if (!iso) return 'Baru diperbarui';
    try {
      return new Date(iso).toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      });
    } catch {
      return '';
    }
  };

  return (
    <div className="min-h-screen bg-slate-100">
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200 px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-blue-900 text-white flex items-center justify-center shrink-0">
            <Wrench className="w-4 h-4" />
          </div>
          <span className="text-base font-bold text-slate-900 truncate">
            Pilih Spreadsheet Drive
          </span>
        </div>
        <button
          type="button"
          onClick={onLogout}
          className="min-h-[40px] px-3 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-100 flex items-center gap-1.5 whitespace-nowrap shrink-0"
        >
          <LogOut className="w-4 h-4" />
          <span>Keluar</span>
        </button>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-5 space-y-5">
        <div className="text-xs sm:text-sm text-slate-600">
          Masuk sebagai{' '}
          <span className="font-semibold text-slate-900">
            {userName || userEmail}
          </span>
        </div>

        {error && (
          <div
            className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-800 text-sm font-medium"
            role="alert"
          >
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          {/* Option 1: Create new template */}
          <section className="lg:col-span-5 bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-800 flex items-center justify-center shrink-0">
                <FilePlus2 className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-900">
                  Buat File Baru (Siap Pakai)
                </h2>
                <p className="text-xs text-slate-600">
                  Otomatis membuat 5 tab sesuai struktur Anda
                </p>
              </div>
            </div>

            <div className="mt-4 space-y-3">
              <label
                htmlFor="new-sheet-name"
                className="block text-xs font-semibold text-slate-700"
              >
                Nama File Spreadsheet Baru
              </label>
              <input
                id="new-sheet-name"
                type="text"
                value={newFileTitle}
                onChange={(e) => setNewFileTitle(e.target.value)}
                placeholder="Contoh: Skoring Sparepart WTP 2026"
                className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-300 bg-white text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-700"
              />
              <button
                type="button"
                disabled={isCreatingFile || isOpeningFile || !newFileTitle.trim()}
                onClick={() => onCreateTemplate(newFileTitle.trim())}
                className="w-full min-h-[46px] px-4 py-2.5 rounded-xl bg-blue-800 hover:bg-blue-900 disabled:bg-blue-400 text-white font-semibold text-sm transition-colors flex items-center justify-center gap-2"
              >
                <FilePlus2 className="w-4 h-4" />
                <span>
                  {isCreatingFile
                    ? 'Membuat Spreadsheet...'
                    : 'Buat Spreadsheet di Google Drive'}
                </span>
              </button>
              <p className="text-xs text-slate-600 leading-relaxed">
                Sudah termasuk tab Panduan, 1_ASSET_VED, 2_LEAD_TIME,
                3_SISA_STOK, 4_SKORING, dan contoh data awal.
              </p>
            </div>
          </section>

          {/* Option 2: Open existing Google Spreadsheet */}
          <section className="lg:col-span-7 bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-bold text-slate-900">
                  Buka Spreadsheet yang Sudah Ada
                </h2>
                <p className="text-xs text-slate-600">
                  Pilih file Google Sheets dari Google Drive Anda
                </p>
              </div>
              <button
                type="button"
                onClick={onRefresh}
                disabled={isLoadingFiles}
                aria-label="Muat ulang daftar file"
                className="min-h-[40px] px-3 rounded-xl border border-slate-300 bg-white text-slate-700 font-semibold text-xs hover:bg-slate-50 flex items-center gap-1.5 shrink-0"
              >
                <RefreshCw
                  className={`w-3.5 h-3.5 ${isLoadingFiles ? 'animate-spin' : ''}`}
                />
                <span className="hidden sm:inline">Muat Ulang</span>
              </button>
            </div>

            <div className="mt-3.5 relative">
              <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="search"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Cari nama file spreadsheet..."
                className="w-full min-h-[44px] pl-10 pr-4 py-2 rounded-xl border border-slate-300 bg-slate-50 text-sm text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-700"
              />
            </div>

            <div className="mt-3.5 max-h-[182px] overflow-y-auto overscroll-contain divide-y divide-slate-200 border border-slate-200 rounded-xl bg-white">
              {isLoadingFiles ? (
                <div className="p-6 text-center text-sm text-slate-600">
                  Sedang mengambil daftar file dari Google Drive...
                </div>
              ) : files.length === 0 ? (
                <div className="p-6 text-center space-y-1">
                  <p className="text-sm font-semibold text-slate-900">
                    Tidak ada file spreadsheet ditemukan
                  </p>
                  <p className="text-xs text-slate-600">
                    Anda dapat membuat file baru di sebelah kiri atau ubah kata
                    kunci pencarian.
                  </p>
                </div>
              ) : (
                files.map((file) => (
                  <button
                    key={file.id}
                    type="button"
                    disabled={isOpeningFile || isCreatingFile}
                    onClick={() => onSelectFile(file)}
                    className="w-full h-[60px] px-3.5 py-2 bg-white hover:bg-blue-50/50 active:bg-blue-50 text-left flex items-center justify-between gap-3 transition-colors disabled:opacity-60"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0">
                        <FileSpreadsheet className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-slate-900 truncate">
                          {file.name}
                        </div>
                        <div className="text-xs text-slate-500">
                          Diubah {formatDate(file.modifiedTime)}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-0.5 text-blue-800 font-semibold text-xs shrink-0">
                      <span>Buka</span>
                      <ChevronRight className="w-4 h-4" />
                    </div>
                  </button>
                ))
              )}
            </div>

            {files.length > 3 && !isLoadingFiles && (
              <p className="mt-2 text-xs text-slate-500 text-center">
                Menampilkan 3 file teratas · geser ke bawah untuk {files.length} file lainnya
              </p>
            )}
          </section>
        </div>
      </main>
    </div>
  );
};
