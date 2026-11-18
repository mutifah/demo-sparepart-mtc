import React from 'react';
import { AlertTriangle, CheckCircle2, X } from 'lucide-react';

interface ConfirmModalProps {
  open: boolean;
  title: string;
  description: string;
  details?: string[];
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'primary' | 'danger';
  isLoading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  open,
  title,
  description,
  details = [],
  confirmLabel = 'Ya, Lanjutkan',
  cancelLabel = 'Batal',
  variant = 'primary',
  isLoading = false,
  onConfirm,
  onCancel,
}) => {
  if (!open) return null;

  const isDanger = variant === 'danger';

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-950/60 backdrop-blur-xs p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-modal-title"
    >
      <div className="w-full sm:max-w-md bg-white rounded-t-3xl sm:rounded-2xl shadow-xl border border-slate-200 p-5 pb-7 sm:pb-5">
        <div className="w-9 h-1 bg-slate-300 rounded-full mx-auto mb-3.5 sm:hidden" />

        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                isDanger
                  ? 'bg-red-50 text-red-700'
                  : 'bg-blue-50 text-blue-800'
              }`}
            >
              {isDanger ? (
                <AlertTriangle className="w-5 h-5" />
              ) : (
                <CheckCircle2 className="w-5 h-5" />
              )}
            </div>
            <div>
              <h2
                id="confirm-modal-title"
                className="text-base font-bold text-slate-900 leading-snug"
              >
                {title}
              </h2>
              <p className="mt-1.5 text-sm text-slate-600 leading-relaxed">
                {description}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onCancel}
            disabled={isLoading}
            aria-label="Tutup dialog"
            className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {details.length > 0 && (
          <ul className="mt-3.5 space-y-1.5 bg-slate-50 rounded-xl p-3.5 text-xs text-slate-700">
            {details.map((item, idx) => (
              <li key={idx} className="flex items-start gap-2">
                <span className="font-bold text-slate-400">•</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        )}

        <div className="mt-5 grid grid-cols-2 gap-2.5">
          <button
            type="button"
            onClick={onCancel}
            disabled={isLoading}
            className="min-h-[44px] px-4 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-800 font-semibold text-sm hover:bg-slate-50 active:scale-[0.99] transition-all"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isLoading}
            className={`min-h-[44px] px-4 py-2.5 rounded-xl text-white font-semibold text-sm active:scale-[0.99] transition-all flex items-center justify-center gap-2 ${
              isDanger
                ? 'bg-red-700 hover:bg-red-800 disabled:bg-red-400'
                : 'bg-blue-800 hover:bg-blue-900 disabled:bg-blue-400'
            }`}
          >
            {isLoading ? 'Menyimpan...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};
