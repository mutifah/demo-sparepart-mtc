import { useCallback, useEffect, useMemo, useState } from 'react';
import { User } from 'firebase/auth';
import {
  BookOpen,
  ClipboardList,
  FolderSync,
  LayoutDashboard,
  PackageCheck,
  RefreshCw,
  Wrench,
} from 'lucide-react';
import { ConfirmModal } from './components/ConfirmModal';
import { DrivePickerScreen } from './components/DrivePickerScreen';
import { GuideView } from './components/GuideView';
import { LoginScreen } from './components/LoginScreen';
import { QuickStockView } from './components/QuickStockView';
import { ScoringFilter, ScoringListView } from './components/ScoringListView';
import { SparepartEditorModal } from './components/SparepartEditorModal';
import { SummaryView } from './components/SummaryView';
import {
  clearAccessToken,
  getAccessToken,
  googleSignIn,
  initAuth,
  logout,
} from './services/googleAuth';
import {
  AuthExpiredError,
  createTemplateSpreadsheet,
  deleteItemFromSpreadsheet,
  listDriveSpreadsheets,
  loadSpreadsheetData,
  saveItemToSpreadsheet,
  saveWeightsToSpreadsheet,
  updateStockRowsInSpreadsheet,
} from './services/googleSheetsSync';
import {
  DriveSpreadsheetFile,
  LoadedSpreadsheet,
  ScoringWeights,
  SparepartItem,
} from './types/sparepart';
import { computeSparepart, PPT_STARTER_ITEMS, DEFAULT_WEIGHTS } from './utils/scoring';

type ActiveTab = 'summary' | 'scoring' | 'stock' | 'guide';

type PendingMutation =
  | {
      kind: 'saveItem';
      title: string;
      description: string;
      details: string[];
      confirmLabel: string;
      variant: 'primary' | 'danger';
      item: SparepartItem;
      isNew: boolean;
      successMessage: string;
      closeEditorOnSuccess?: boolean;
    }
  | {
      kind: 'deleteItem';
      title: string;
      description: string;
      details: string[];
      confirmLabel: string;
      variant: 'primary' | 'danger';
      item: SparepartItem;
      successMessage: string;
      closeEditorOnSuccess?: boolean;
    }
  | {
      kind: 'saveStock';
      title: string;
      description: string;
      details: string[];
      confirmLabel: string;
      variant: 'primary' | 'danger';
      nextItems: SparepartItem[];
      successMessage: string;
      closeEditorOnSuccess?: boolean;
    }
  | {
      kind: 'saveWeights';
      title: string;
      description: string;
      details: string[];
      confirmLabel: string;
      variant: 'primary' | 'danger';
      nextWeights: ScoringWeights;
      successMessage: string;
      closeEditorOnSuccess?: boolean;
    };

export default function App() {
  const [needsAuth, setNeedsAuth] = useState(true);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);

  const [driveFiles, setDriveFiles] = useState<DriveSpreadsheetFile[]>([]);
  const [isLoadingFiles, setIsLoadingFiles] = useState(false);
  const [isOpeningFile, setIsOpeningFile] = useState(false);
  const [isCreatingFile, setIsCreatingFile] = useState(false);
  const [driveError, setDriveError] = useState<string | null>(null);

  const [activeSheet, setActiveSheet] = useState<LoadedSpreadsheet | null>(null);
  const [activeTab, setActiveTab] = useState<ActiveTab>('summary');
  const [scoringFilter, setScoringFilter] = useState<ScoringFilter>('ALL');

  const [editorOpen, setEditorOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<SparepartItem | null>(null);

  const [pendingMutation, setPendingMutation] = useState<PendingMutation | null>(
    null
  );
  const [isSavingSheet, setIsSavingSheet] = useState(false);
  const [isRefreshingSheet, setIsRefreshingSheet] = useState(false);
  const [feedback, setFeedback] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  useEffect(() => {
    const unsub = initAuth(
      (authedUser) => {
        setUser(authedUser);
        setNeedsAuth(false);
      },
      () => {
        setNeedsAuth(true);
        setUser(null);
      }
    );
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!feedback) return;
    const t = setTimeout(() => setFeedback(null), 5000);
    return () => clearTimeout(t);
  }, [feedback]);

  const handleAuthExpired = useCallback(() => {
    clearAccessToken();
    setNeedsAuth(true);
    setAuthError('Sesi Google Anda telah berakhir. Silakan masuk kembali.');
  }, []);

  const fetchDriveFiles = useCallback(
    async (query = '') => {
      const token = getAccessToken();
      if (!token) {
        setNeedsAuth(true);
        return;
      }
      setIsLoadingFiles(true);
      setDriveError(null);
      try {
        const files = await listDriveSpreadsheets(token, query);
        setDriveFiles(files);
      } catch (err) {
        if (err instanceof AuthExpiredError) {
          handleAuthExpired();
        } else {
          setDriveError(
            err instanceof Error
              ? err.message
              : 'Gagal memuat daftar file Google Drive.'
          );
        }
      } finally {
        setIsLoadingFiles(false);
      }
    },
    [handleAuthExpired]
  );

  const handleLogin = async () => {
    setIsLoggingIn(true);
    setAuthError(null);
    try {
      const result = await googleSignIn();
      if (result) {
        setUser(result.user);
        setNeedsAuth(false);
        await fetchDriveFiles('');
      }
    } catch (err) {
      setAuthError(
        err instanceof Error
          ? err.message
          : 'Gagal masuk dengan Google. Pastikan pop-up tidak diblokir.'
      );
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    setUser(null);
    setActiveSheet(null);
    setDriveFiles([]);
    setNeedsAuth(true);
    setAuthError(null);
  };

  const handleSelectFile = async (file: DriveSpreadsheetFile) => {
    const token = getAccessToken();
    if (!token) {
      handleAuthExpired();
      return;
    }
    setIsOpeningFile(true);
    setDriveError(null);
    try {
      const loaded = await loadSpreadsheetData(token, file.id);
      setActiveSheet(loaded);
      setActiveTab('summary');
    } catch (err) {
      if (err instanceof AuthExpiredError) {
        handleAuthExpired();
      } else {
        setDriveError(
          err instanceof Error
            ? err.message
            : 'Gagal membaca isi file spreadsheet.'
        );
      }
    } finally {
      setIsOpeningFile(false);
    }
  };

  const handleCreateTemplate = async (title: string) => {
    const token = getAccessToken();
    if (!token) {
      handleAuthExpired();
      return;
    }
    setIsCreatingFile(true);
    setDriveError(null);
    try {
      const created = await createTemplateSpreadsheet(
        token,
        title,
        DEFAULT_WEIGHTS,
        PPT_STARTER_ITEMS
      );
      const loaded = await loadSpreadsheetData(token, created.spreadsheetId);
      setActiveSheet(loaded);
      setActiveTab('summary');
      setFeedback({
        type: 'success',
        message: `File "${loaded.title}" berhasil dibuat di Google Drive Anda.`,
      });
    } catch (err) {
      if (err instanceof AuthExpiredError) {
        handleAuthExpired();
      } else {
        setDriveError(
          err instanceof Error
            ? err.message
            : 'Gagal membuat file spreadsheet baru.'
        );
      }
    } finally {
      setIsCreatingFile(false);
    }
  };

  const handleRefreshActiveSheet = async () => {
    if (!activeSheet) return;
    const token = getAccessToken();
    if (!token) {
      handleAuthExpired();
      return;
    }
    setIsRefreshingSheet(true);
    try {
      const reloaded = await loadSpreadsheetData(
        token,
        activeSheet.spreadsheetId
      );
      setActiveSheet(reloaded);
      setFeedback({
        type: 'success',
        message: 'Data terbaru berhasil diambil dari Google Spreadsheet.',
      });
    } catch (err) {
      if (err instanceof AuthExpiredError) {
        handleAuthExpired();
      } else {
        setFeedback({
          type: 'error',
          message:
            err instanceof Error
              ? err.message
              : 'Gagal menyegarkan data spreadsheet.',
        });
      }
    } finally {
      setIsRefreshingSheet(false);
    }
  };

  const computedItems = useMemo(() => {
    if (!activeSheet) return [];
    return activeSheet.items.map((item) =>
      computeSparepart(item, activeSheet.weights)
    );
  }, [activeSheet]);

  const executePendingMutation = async () => {
    if (!activeSheet || !pendingMutation) return;
    const token = getAccessToken();
    if (!token) {
      setPendingMutation(null);
      handleAuthExpired();
      return;
    }
    setIsSavingSheet(true);
    try {
      if (pendingMutation.kind === 'saveItem') {
        await saveItemToSpreadsheet(
          token,
          activeSheet,
          pendingMutation.item,
          pendingMutation.isNew
        );
      } else if (pendingMutation.kind === 'deleteItem') {
        await deleteItemFromSpreadsheet(
          token,
          activeSheet,
          pendingMutation.item
        );
      } else if (pendingMutation.kind === 'saveStock') {
        await updateStockRowsInSpreadsheet(
          token,
          activeSheet,
          pendingMutation.nextItems
        );
      } else if (pendingMutation.kind === 'saveWeights') {
        await saveWeightsToSpreadsheet(
          token,
          activeSheet,
          pendingMutation.nextWeights
        );
      }

      const reloaded = await loadSpreadsheetData(
        token,
        activeSheet.spreadsheetId
      );
      setActiveSheet(reloaded);

      if (pendingMutation.closeEditorOnSuccess) {
        setEditorOpen(false);
        setEditingItem(null);
      }

      setFeedback({
        type: 'success',
        message: pendingMutation.successMessage,
      });
      setPendingMutation(null);
    } catch (err) {
      if (err instanceof AuthExpiredError) {
        setPendingMutation(null);
        handleAuthExpired();
      } else {
        setFeedback({
          type: 'error',
          message:
            err instanceof Error
              ? err.message
              : 'Gagal menyimpan data ke Google Spreadsheet.',
        });
        setPendingMutation(null);
      }
    } finally {
      setIsSavingSheet(false);
    }
  };

  const handleRequestSaveItem = (item: SparepartItem, isNew: boolean) => {
    if (!activeSheet) return;
    setPendingMutation({
      kind: 'saveItem',
      title: isNew
        ? 'Tambah Sparepart ke Spreadsheet?'
        : 'Simpan Perubahan ke Spreadsheet?',
      description: `Perubahan untuk "${item.namaPart}" akan ditulis ke file Google Sheets "${activeSheet.title}".`,
      details: [
        'Tab diperbarui: 1_ASSET_VED, 2_LEAD_TIME, 3_SISA_STOK, dan 4_SKORING (rumus sheet tetap terjaga)',
        `No. Rak: ${item.noRak} · VED Eq: ${item.vedEquipment} · VED Part: ${item.vedPart} · Sisa Stok: ${item.sisaStokAktual} ${item.satuan}`,
      ],
      confirmLabel: 'Ya, Simpan Sekarang',
      variant: 'primary',
      item,
      isNew,
      successMessage: isNew
        ? `Sparepart "${item.namaPart}" berhasil ditambahkan ke Spreadsheet.`
        : `Data "${item.namaPart}" berhasil diperbarui di Spreadsheet.`,
      closeEditorOnSuccess: true,
    });
  };

  const handleRequestDeleteItem = (item: SparepartItem) => {
    if (!activeSheet) return;
    setPendingMutation({
      kind: 'deleteItem',
      title: 'Hapus Sparepart dari Spreadsheet?',
      description: `Anda yakin ingin menghapus "${item.namaPart}" dari file "${activeSheet.title}"?`,
      details: [
        'Baris data barang ini akan dihapus dari tab skoring di Google Sheets.',
        'Tindakan ini tidak dapat dibatalkan secara otomatis.',
      ],
      confirmLabel: 'Ya, Hapus Data',
      variant: 'danger',
      item,
      successMessage: `Sparepart "${item.namaPart}" telah dihapus dari Spreadsheet.`,
      closeEditorOnSuccess: true,
    });
  };

  const handleRequestSaveBulkStock = (updatedItems: SparepartItem[]) => {
    if (!activeSheet) return;
    const changed = updatedItems.filter((u) => {
      const orig = activeSheet.items.find((o) => o.id === u.id);
      return orig && orig.sisaStokAktual !== u.sisaStokAktual;
    });
    if (changed.length === 0) return;

    setPendingMutation({
      kind: 'saveStock',
      title: 'Simpan Hasil Cek Stok Gudang?',
      description: `Sebanyak ${changed.length} sparepart mengalami perubahan jumlah stok dan akan diperbarui pada tab 3_SISA_STOK di "${activeSheet.title}".`,
      details: changed.slice(0, 5).map((c) => {
        const orig = activeSheet.items.find((o) => o.id === c.id);
        return `${c.namaPart}: ${orig?.sisaStokAktual ?? 0} → ${c.sisaStokAktual} ${c.satuan}`;
      }),
      confirmLabel: 'Ya, Simpan Stok',
      variant: 'primary',
      nextItems: updatedItems,
      successMessage: `${changed.length} data stok berhasil disimpan ke Spreadsheet.`,
    });
  };

  const handleRequestSaveWeights = (newWeights: ScoringWeights) => {
    if (!activeSheet) return;
    setPendingMutation({
      kind: 'saveWeights',
      title: 'Simpan Perubahan Bobot Skoring?',
      description: `Bobot perhitungan pada file "${activeSheet.title}" akan diperbarui dan seluruh skor prioritas akan dihitung ulang.`,
      details: [
        `Bobot baru: VED ${newWeights.ved}% · Lead Time ${newWeights.leadTime}% · Sisa Stok ${newWeights.stock}%`,
        'Tab 4_SKORING pada Google Sheets akan langsung menyesuaikan bobot ini.',
      ],
      confirmLabel: 'Ya, Simpan Bobot',
      variant: 'primary',
      nextWeights: newWeights,
      successMessage: 'Bobot penilaian berhasil disimpan ke Spreadsheet.',
    });
  };

  if (needsAuth) {
    return (
      <LoginScreen
        onLogin={handleLogin}
        isLoggingIn={isLoggingIn}
        error={authError}
      />
    );
  }

  if (!activeSheet) {
    return (
      <DrivePickerScreen
        userEmail={user?.email || 'Akun Google'}
        userName={user?.displayName}
        files={driveFiles}
        isLoadingFiles={isLoadingFiles}
        isOpeningFile={isOpeningFile}
        isCreatingFile={isCreatingFile}
        error={driveError}
        onSearch={(q) => fetchDriveFiles(q)}
        onRefresh={() => fetchDriveFiles('')}
        onSelectFile={handleSelectFile}
        onCreateTemplate={handleCreateTemplate}
        onLogout={handleLogout}
      />
    );
  }

  const navItems: Array<{
    id: ActiveTab;
    label: string;
    Icon: typeof LayoutDashboard;
  }> = [
    { id: 'summary', label: 'Ringkasan', Icon: LayoutDashboard },
    { id: 'scoring', label: 'Skoring', Icon: ClipboardList },
    { id: 'stock', label: 'Cek Stok', Icon: PackageCheck },
    { id: 'guide', label: 'Panduan', Icon: BookOpen },
  ];

  return (
    <div className="min-h-screen bg-slate-100 pb-20 lg:pb-10">
      {/* Top Bar */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200 px-4 sm:px-6 h-13 lg:h-14 flex items-center justify-between gap-6">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-7 h-7 rounded-lg bg-blue-900 text-white flex items-center justify-center shrink-0">
            <Wrench className="w-3.5 h-3.5" />
          </div>
          <span className="text-sm sm:text-base font-bold text-slate-900 truncate max-w-[190px] sm:max-w-xs whitespace-nowrap shrink-0">
            {activeSheet.title}
          </span>
        </div>

        <nav className="hidden lg:flex items-center gap-6">
          {navItems.map(({ id, label }) => (
            <button
              key={id}
              type="button"
              onClick={() => setActiveTab(id)}
              className={`min-h-[44px] px-2 text-sm font-semibold whitespace-nowrap shrink-0 transition-colors border-b-2 ${
                activeTab === id
                  ? 'border-blue-800 text-blue-800'
                  : 'border-transparent text-slate-600 hover:text-slate-900'
              }`}
            >
              {label}
            </button>
          ))}
        </nav>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handleRefreshActiveSheet}
            disabled={isRefreshingSheet}
            aria-label="Muat Ulang Data"
            className="min-h-[38px] px-3 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-semibold text-xs flex items-center gap-1.5 whitespace-nowrap shrink-0"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 ${isRefreshingSheet ? 'animate-spin' : ''}`}
            />
            <span className="hidden sm:inline">Muat Ulang</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveSheet(null);
              fetchDriveFiles('');
            }}
            className="hidden lg:flex min-h-[38px] px-3.5 rounded-xl bg-blue-800 hover:bg-blue-900 text-white font-semibold text-xs items-center gap-1.5 whitespace-nowrap shrink-0"
          >
            <FolderSync className="w-3.5 h-3.5" />
            <span>Ganti File</span>
          </button>
        </div>
      </header>

      {/* Main Content Container */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-4 sm:py-5 space-y-4">
        {feedback && (
          <div
            role="status"
            className={`p-3.5 rounded-xl border text-xs sm:text-sm font-semibold flex items-center justify-between gap-3 ${
              feedback.type === 'success'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                : 'bg-red-50 border-red-200 text-red-900'
            }`}
          >
            <span>{feedback.message}</span>
            <button
              type="button"
              onClick={() => setFeedback(null)}
              className="text-xs underline shrink-0"
            >
              Tutup
            </button>
          </div>
        )}

        {activeSheet.warnings.length > 0 && (
          <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs sm:text-sm">
            {activeSheet.warnings[0]}
          </div>
        )}

        {activeTab === 'summary' && (
          <SummaryView
            items={computedItems}
            weights={activeSheet.weights}
            onSelectPriorityFilter={(filter) => {
              setScoringFilter(filter);
              setActiveTab('scoring');
            }}
            onEditItem={(item) => {
              setEditingItem(item);
              setEditorOpen(true);
            }}
            onRequestSaveWeights={handleRequestSaveWeights}
            onGoToQuickStock={() => setActiveTab('stock')}
          />
        )}

        {activeTab === 'scoring' && (
          <ScoringListView
            items={computedItems}
            activeFilter={scoringFilter}
            onChangeFilter={setScoringFilter}
            onEditItem={(item) => {
              setEditingItem(item);
              setEditorOpen(true);
            }}
            onAddNew={() => {
              setEditingItem(null);
              setEditorOpen(true);
            }}
          />
        )}

        {activeTab === 'stock' && (
          <QuickStockView
            items={computedItems}
            weights={activeSheet.weights}
            onRequestSaveBulkStock={handleRequestSaveBulkStock}
          />
        )}

        {activeTab === 'guide' && (
          <GuideView
            spreadsheetTitle={activeSheet.title}
            webViewLink={activeSheet.webViewLink}
            sheetNames={activeSheet.sheetNames}
            hasStandardStructure={activeSheet.hasStandardStructure}
            weights={activeSheet.weights}
            userEmail={user?.email || 'Akun Google'}
            onChangeFile={() => {
              setActiveSheet(null);
              fetchDriveFiles('');
            }}
            onLogout={handleLogout}
          />
        )}
      </main>

      {/* Fixed Bottom Tab Navigation on Mobile (< lg) */}
      <nav
        aria-label="Menu Utama"
        className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 pb-safe"
      >
        <div className="grid grid-cols-4 h-15 items-center">
          {navItems.map(({ id, label, Icon }) => {
            const active = activeTab === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => setActiveTab(id)}
                className={`h-full flex flex-col items-center justify-center gap-1 transition-colors ${
                  active ? 'text-blue-800' : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                <Icon className="w-5 h-5" strokeWidth={active ? 2.3 : 1.8} />
                <span className="text-[11px] font-semibold tracking-tight leading-none">
                  {label}
                </span>
              </button>
            );
          })}
        </div>
      </nav>

      {/* Step-by-step Guided Editor Modal */}
      <SparepartEditorModal
        open={editorOpen}
        initialItem={editingItem}
        weights={activeSheet.weights}
        onClose={() => {
          setEditorOpen(false);
          setEditingItem(null);
        }}
        onRequestSave={handleRequestSaveItem}
        onRequestDelete={handleRequestDeleteItem}
      />

      {/* Explicit Confirmation Dialog before any Google Sheets write/delete */}
      <ConfirmModal
        open={Boolean(pendingMutation)}
        title={pendingMutation?.title ?? ''}
        description={pendingMutation?.description ?? ''}
        details={pendingMutation?.details ?? []}
        confirmLabel={pendingMutation?.confirmLabel}
        variant={pendingMutation?.variant}
        isLoading={isSavingSheet}
        onConfirm={executePendingMutation}
        onCancel={() => {
          if (!isSavingSheet) setPendingMutation(null);
        }}
      />
    </div>
  );
}
