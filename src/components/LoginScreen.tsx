import React from 'react';
import {
  ClipboardCheck,
  FileSpreadsheet,
  PackageSearch,
  ShieldCheck,
  Wrench,
} from 'lucide-react';

interface LoginScreenProps {
  onLogin: () => void;
  isLoggingIn: boolean;
  error: string | null;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({
  onLogin,
  isLoggingIn,
  error,
}) => {
  return (
    <div className="min-h-screen bg-slate-100 flex flex-col justify-center px-4 py-8 sm:px-6 lg:px-8">
      <div className="w-full max-w-4xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-10 items-center">
        {/* Left: Crisp Value Proposition */}
        <div className="lg:col-span-7 space-y-4">
          <div className="inline-flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-900 text-white flex items-center justify-center shadow-xs">
              <Wrench className="w-4 h-4" />
            </div>
            <span className="text-xs font-semibold text-blue-900 tracking-wide">
              Divisi Maintenance · ISO 55001
            </span>
          </div>

          <h1
            className="text-2xl sm:text-3xl font-bold text-slate-900 leading-tight tracking-tight"
            style={{ textWrap: 'balance' }}
          >
            Skoring Prioritas Sparepart Langsung dari HP
          </h1>
          <p className="text-sm sm:text-[15px] text-slate-600 leading-relaxed max-w-lg">
            Tentukan prioritas pengadaan RKAP dan perbarui stok gudang secara
            objektif, tersinkronisasi langsung dengan Google Spreadsheet Anda.
          </p>

          <div className="pt-2 grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-1 gap-3">
            <div className="flex items-start gap-3 bg-white/80 rounded-xl p-3 border border-slate-200/80">
              <div className="w-9 h-9 rounded-lg bg-blue-50 text-blue-800 flex items-center justify-center shrink-0">
                <ClipboardCheck className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-slate-900">
                  Skor Otomatis
                </h2>
                <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">
                  Hitung VED, Lead Time, dan Sisa Stok sesuai bobot 50/30/20.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 bg-white/80 rounded-xl p-3 border border-slate-200/80">
              <div className="w-9 h-9 rounded-lg bg-blue-50 text-blue-800 flex items-center justify-center shrink-0">
                <PackageSearch className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-slate-900">
                  Cek Stok Gudang Cepat
                </h2>
                <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">
                  Update sisa stok per rak dengan tombol tambah/kurang praktis.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 bg-white/80 rounded-xl p-3 border border-slate-200/80">
              <div className="w-9 h-9 rounded-lg bg-blue-50 text-blue-800 flex items-center justify-center shrink-0">
                <FileSpreadsheet className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-slate-900">
                  Terhubung ke Google Drive
                </h2>
                <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">
                  Rumus di spreadsheet Anda tetap aman dan otomatis terhitung.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Right: Sleek Sign-In Card */}
        <div className="lg:col-span-5">
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
            <h2 className="text-lg font-bold text-slate-900">
              Masuk ke Aplikasi
            </h2>
            <p className="mt-1.5 text-sm text-slate-600 leading-relaxed">
              Gunakan akun Google Anda untuk membuka atau membuat file
              spreadsheet di Google Drive.
            </p>

            {error && (
              <div
                className="mt-4 p-3 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs font-medium"
                role="alert"
              >
                {error}
              </div>
            )}

            <div className="mt-5">
              <button
                type="button"
                onClick={onLogin}
                disabled={isLoggingIn}
                className="gsi-material-button"
              >
                <div className="gsi-material-button-content-wrapper">
                  <div className="gsi-material-button-icon">
                    <svg
                      version="1.1"
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 48 48"
                      style={{ display: 'block' }}
                    >
                      <path
                        fill="#EA4335"
                        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
                      />
                      <path
                        fill="#4285F4"
                        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
                      />
                      <path
                        fill="#FBBC05"
                        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
                      />
                      <path
                        fill="#34A853"
                        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
                      />
                      <path fill="none" d="M0 0h48v48H0z" />
                    </svg>
                  </div>
                  <span className="gsi-material-button-contents">
                    {isLoggingIn ? 'Menghubungkan...' : 'Sign in with Google'}
                  </span>
                </div>
              </button>
            </div>

            <div className="mt-4 pt-4 border-t border-slate-100 flex items-start gap-2.5 text-xs text-slate-600 leading-relaxed">
              <ShieldCheck className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
              <span>
                Data tetap tersimpan aman di Google Drive Anda. Perubahan hanya
                disimpan setelah Anda menyetujui dialog konfirmasi.
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
