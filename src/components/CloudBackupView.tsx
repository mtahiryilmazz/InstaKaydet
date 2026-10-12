import React, { useState, useEffect } from 'react';
import { DownloadHistoryItem, CloudBackupSnapshot } from '../types';
import {
  createCloudBackup,
  listCloudBackups,
  restoreCloudBackup,
  deleteCloudBackup,
  clearAllCloudBackups,
  clearServerCache,
  exportBackupAsJsonFile,
  clearLocalHistory
} from '../services/backupService';
import {
  Cloud,
  DownloadCloud,
  UploadCloud,
  FileJson,
  Trash2,
  CheckCircle2,
  FolderArchive,
  FileText,
  Film,
  Image as ImageIcon,
  Clock,
  RotateCcw,
  Sparkles,
  ShieldCheck,
  HardDrive,
  RefreshCw,
  AlertTriangle,
  X
} from 'lucide-react';

import { DateRangeFilter } from './DateRangeFilter';

interface CloudBackupViewProps {
  history: DownloadHistoryItem[];
  onHistoryUpdated: (newHistory: DownloadHistoryItem[]) => void;
  onShowToast: (msg: string) => void;
}

interface ConfirmModalState {
  isOpen: boolean;
  title: string;
  description: string;
  confirmButtonText: string;
  isDestructive?: boolean;
  action: () => Promise<void> | void;
}

export const CloudBackupView: React.FC<CloudBackupViewProps> = ({
  history,
  onHistoryUpdated,
  onShowToast,
}) => {
  const [backups, setBackups] = useState<CloudBackupSnapshot[]>([]);
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [deletingBackupId, setDeletingBackupId] = useState<string | null>(null);
  const [isClearingAllBackups, setIsClearingAllBackups] = useState(false);
  const [activeFilter, setActiveFilter] = useState<'all' | 'carousel' | 'pdf' | 'media'>('all');
  const [historyStartDate, setHistoryStartDate] = useState('');
  const [historyEndDate, setHistoryEndDate] = useState('');
  const [backupNameInput, setBackupNameInput] = useState('');
  const [showBackupModal, setShowBackupModal] = useState(false);
  const [autoSync, setAutoSync] = useState(true);

  // In-app confirmation dialog (ZERO window.confirm, 100% reliable inside iframes)
  const [confirmModal, setConfirmModal] = useState<ConfirmModalState | null>(null);

  // Load cloud backups on mount
  useEffect(() => {
    loadBackups();
  }, []);

  const loadBackups = async () => {
    const list = await listCloudBackups();
    setBackups(list);
  };

  const handleCreateBackup = async () => {
    setIsBackingUp(true);
    try {
      const name = backupNameInput.trim() || `Bulut Yedek ${new Date().toLocaleDateString('tr-TR')} ${new Date().toLocaleTimeString('tr-TR')}`;
      await createCloudBackup(name, history, { autoSync });
      await loadBackups();
      setShowBackupModal(false);
      setBackupNameInput('');
      onShowToast(`Bulut yedeklemesi başarıyla tamamlandı (${history.length} kayıt)`);
    } catch (err: any) {
      onShowToast(`Bulut yedekleme hatası: ${err.message}`);
    } finally {
      setIsBackingUp(false);
    }
  };

  const handleRestoreBackup = async (backupId: string, name: string) => {
    setIsRestoring(true);
    try {
      const restored = await restoreCloudBackup(backupId);
      onHistoryUpdated(restored);
      onShowToast(`"${name}" bulut yedeğinden ${restored.length} kayıt geri yüklendi.`);
    } catch (err: any) {
      onShowToast(`Geri yükleme hatası: ${err.message}`);
    } finally {
      setIsRestoring(false);
    }
  };

  // Requirement:
  // "Implement a 'Clear History' feature in CloudBackupView that explicitly removes all items
  // from the cloud database and synchronizes the local state to match an empty storage state."
  const promptClearAllHistoryAndCloud = () => {
    setConfirmModal({
      isOpen: true,
      title: 'Tüm Bulut ve İndirme Geçmişini Temizle',
      description: 'Bulut veritabanındaki TÜM yedekler ve yerel cihaz indirme geçmişiniz kalıcı olarak silinecektir. Depolama tamamen sıfırlanacaktır.',
      confirmButtonText: 'Evet, Tümünü Temizle ve Sıfırla',
      isDestructive: true,
      action: executeClearAllHistoryAndCloud,
    });
  };

  const executeClearAllHistoryAndCloud = async () => {
    setIsClearingAllBackups(true);
    try {
      // 1. Explicitly remove all items from the cloud database
      await clearAllCloudBackups();

      // 2. Clear server-side profile and media caches
      try {
        await clearServerCache();
      } catch {}

      // 3. Clear local storage history and synchronise local state to empty storage state
      clearLocalHistory();
      onHistoryUpdated([]);

      // 4. Reset component backups state to empty array
      setBackups([]);

      onShowToast('Bulut veritabanı ve indirme geçmişi tamamen temizlendi (Boş depolama durumuna eşitlendi).');
    } catch (err: any) {
      onShowToast(`Temizleme hatası: ${err.message}`);
    } finally {
      setIsClearingAllBackups(false);
      setConfirmModal(null);
    }
  };

  // Single backup deletion prompt
  const promptDeleteSingleBackup = (backupId: string, name: string) => {
    setConfirmModal({
      isOpen: true,
      title: 'Bulut Yedeğini Sil',
      description: `"${name}" adlı bulut yedek noktası kalıcı olarak silinecektir. Devam etmek istiyor musunuz?`,
      confirmButtonText: 'Yedeği Sil',
      isDestructive: true,
      action: async () => {
        setDeletingBackupId(backupId);
        try {
          await deleteCloudBackup(backupId);
          setBackups(prev => prev.filter(b => b.id !== backupId));
          onShowToast(`"${name}" bulut yedeği silindi.`);
        } catch (err: any) {
          onShowToast(`Silme hatası: ${err.message}`);
        } finally {
          setDeletingBackupId(null);
          setConfirmModal(null);
        }
      },
    });
  };

  // Clear local history only prompt
  const promptClearLocalHistoryOnly = () => {
    setConfirmModal({
      isOpen: true,
      title: 'Cihaz İndirme Geçmişini Temizle',
      description: 'Cihazınızdaki indirme geçmişi kayıtları temizlenecektir. Buluttaki yedekleriniz etkilenmez.',
      confirmButtonText: 'Geçmişi Temizle',
      isDestructive: true,
      action: () => {
        clearLocalHistory();
        onHistoryUpdated([]);
        onShowToast('İndirme geçmişi temizlendi.');
        setConfirmModal(null);
      },
    });
  };

  const handleFileImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        if (parsed.history && Array.isArray(parsed.history)) {
          onHistoryUpdated(parsed.history);
          onShowToast(`Dosyadan ${parsed.history.length} indirme kaydı geri yüklendi.`);
        } else {
          onShowToast('Geçersiz yedek dosyası formatı');
        }
      } catch {
        onShowToast('Yedek dosyası okunamadı');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // Filter history: type filter + date range filter
  const filteredHistory = history.filter(item => {
    if (activeFilter === 'carousel' && item.type !== 'carousel_folder' && item.type !== 'date_archive') return false;
    if (activeFilter === 'pdf' && item.type !== 'pdf_archive') return false;
    if (activeFilter === 'media' && item.type !== 'single_photo' && item.type !== 'single_video') return false;

    if (historyStartDate || historyEndDate) {
      const itemDate = new Date(item.timestamp);
      const itemDateStr = itemDate.toISOString().slice(0, 10);
      if (historyStartDate && itemDateStr < historyStartDate) return false;
      if (historyEndDate && itemDateStr > historyEndDate) return false;
    }

    return true;
  });

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Cloud Hub Status Card */}
      <div className="bg-gradient-to-br from-slate-900 to-slate-950 border border-slate-800 rounded-3xl p-5 sm:p-6 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-rose-500/5 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-10">
          <div>
            <div className="flex items-center gap-2 text-rose-400 text-xs font-semibold uppercase tracking-wider mb-1">
              <ShieldCheck className="w-4 h-4" />
              <span>Güvenli Bulut Depolama</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
              İndirme Geçmişi & Bulut Yedekleme
            </h2>
            <p className="text-xs sm:text-sm text-slate-400 mt-1">
              İndirilen tüm fotoğraf, video, karusel klasörleri ve PDF arşivlerinin geçmişini bulutta saklayın ve yönetin.
            </p>
          </div>

          {/* Action buttons: Backup, Clear, and JSON Export */}
          <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
            <button
              onClick={() => setShowBackupModal(true)}
              disabled={isBackingUp}
              className="px-4 py-2.5 bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs sm:text-sm rounded-xl transition-all shadow-md active:scale-95 disabled:opacity-50 flex items-center gap-2 cursor-pointer min-h-[42px]"
            >
              <UploadCloud className="w-4 h-4" />
              <span>Buluta Şimdi Yedekle</span>
            </button>

            {/* Clear History & Cloud Database button */}
            <button
              onClick={promptClearAllHistoryAndCloud}
              disabled={isClearingAllBackups}
              className="px-3.5 py-2.5 bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 border border-rose-500/30 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50 min-h-[42px]"
              title="Bulut veritabanını ve yerel indirme geçmişini tamamen temizle"
            >
              <Trash2 className="w-4 h-4 text-rose-400" />
              <span>{isClearingAllBackups ? 'Temizleniyor...' : 'Bulut Kayıtlarını Temizle'}</span>
            </button>

            <button
              onClick={() => exportBackupAsJsonFile(history)}
              className="px-3.5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700/80 rounded-xl text-xs font-medium transition-colors flex items-center gap-1.5 cursor-pointer min-h-[42px]"
              title="Yedek dosyasını JSON olarak indir"
            >
              <FileJson className="w-4 h-4 text-amber-400" />
              <span>JSON İndir</span>
            </button>
          </div>
        </div>

        {/* Cloud Quick Metrics */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-5 border-t border-slate-800/80 text-xs">
          <div className="bg-slate-900/60 p-3 rounded-xl border border-slate-800/60">
            <div className="text-slate-400">Toplam İndirme</div>
            <div className="text-lg font-bold text-white tabular-nums mt-0.5">{history.length} Kayıt</div>
          </div>
          <div className="bg-slate-900/60 p-3 rounded-xl border border-slate-800/60">
            <div className="text-slate-400">Bulut Anlık Görüntüleri</div>
            <div className="text-lg font-bold text-rose-400 tabular-nums mt-0.5">{backups.length} Yedek</div>
          </div>
          <div className="bg-slate-900/60 p-3 rounded-xl border border-slate-800/60">
            <div className="text-slate-400">Son Yedekleme</div>
            <div className="text-sm font-semibold text-slate-200 mt-1 truncate">
              {backups[0] ? new Date(backups[0].timestamp).toLocaleDateString('tr-TR') : 'Henüz Yok'}
            </div>
          </div>
          <div className="bg-slate-900/60 p-3 rounded-xl border border-slate-800/60 flex items-center justify-between">
            <div>
              <div className="text-slate-400">Oto-Senkron</div>
              <div className="text-sm font-semibold text-emerald-400 mt-0.5">
                {autoSync ? 'Aktif' : 'Devre Dışı'}
              </div>
            </div>
            <input
              type="checkbox"
              checked={autoSync}
              onChange={(e) => setAutoSync(e.target.checked)}
              className="accent-rose-500 w-4 h-4 cursor-pointer"
            />
          </div>
        </div>
      </div>

      {/* Cloud Snapshots List Drawer */}
      <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-4 sm:p-5">
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <Cloud className="w-4 h-4 text-rose-400" />
            <h3 className="text-sm font-bold text-white">Bulut Yedekleme Noktaları (Geri Yükle & Yönet)</h3>
            <span className="text-xs text-slate-400">({backups.length} nokta)</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={promptClearAllHistoryAndCloud}
              disabled={isClearingAllBackups}
              className="px-2.5 py-1 text-slate-300 hover:text-rose-400 hover:bg-rose-500/10 border border-slate-700/80 hover:border-rose-500/30 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              title="Tüm bulut yedekleme kayıtlarını temizle"
            >
              <Trash2 className="w-3.5 h-3.5 text-rose-400" />
              <span>{isClearingAllBackups ? 'Temizleniyor...' : 'Tüm Bulut Kayıtlarını Temizle'}</span>
            </button>
          </div>
        </div>

        {backups.length === 0 ? (
          <div className="p-6 text-center text-xs text-slate-500 border border-dashed border-slate-800 rounded-xl">
            Bulut depolamada kayıtlı yedek bulunmuyor. Yukarıdaki "Buluta Şimdi Yedekle" butonuyla anlık yedek alabilirsiniz.
          </div>
        ) : (
          <div className="space-y-2">
            {backups.map((b) => (
              <div
                key={b.id}
                className="bg-slate-950/70 border border-slate-800/80 rounded-xl p-3 flex items-center justify-between gap-3 text-xs"
              >
                <div className="min-w-0">
                  <div className="font-semibold text-slate-200 truncate">{b.name}</div>
                  <div className="text-slate-400 text-[11px] mt-0.5">
                    {new Date(b.timestamp).toLocaleString('tr-TR')} · {b.itemCount} indirme kaydı
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => handleRestoreBackup(b.id, b.name)}
                    disabled={isRestoring || deletingBackupId === b.id}
                    className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded-lg font-medium flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50 border border-slate-700/60"
                  >
                    <RotateCcw className="w-3.5 h-3.5 text-rose-400" />
                    <span>Geri Yükle</span>
                  </button>

                  <button
                    onClick={() => promptDeleteSingleBackup(b.id, b.name)}
                    disabled={deletingBackupId === b.id}
                    className="px-2.5 py-1.5 bg-slate-900 hover:bg-rose-500/15 text-slate-400 hover:text-rose-400 rounded-lg font-medium flex items-center gap-1 transition-colors cursor-pointer disabled:opacity-50 border border-slate-800 hover:border-rose-500/40"
                    title="Bu bulut yedeğini sil"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                    <span className="hidden sm:inline">Sil</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Download History Feed */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-slate-800">
          <div>
            <h3 className="text-base font-bold text-white">Cihaz İndirme Geçmişi</h3>
            <p className="text-xs text-slate-400">
              Galeriye indirilen fotoğraflar, videolar, karusel klasörleri ve PDF belgeleri
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {history.length > 0 && (
              <button
                onClick={promptClearLocalHistoryOnly}
                className="px-2.5 py-1.5 text-slate-400 hover:text-amber-400 hover:bg-amber-500/10 border border-slate-800 hover:border-amber-500/30 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 cursor-pointer"
                title="Sadece cihaz indirme geçmişini temizle"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Geçmişi Temizle</span>
              </button>
            )}

            <label className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700/60 rounded-xl text-xs font-medium transition-colors flex items-center gap-1.5 cursor-pointer">
              <DownloadCloud className="w-3.5 h-3.5 text-rose-400" />
              <span>Yedek Dosyası Yükle</span>
              <input
                type="file"
                accept=".json"
                onChange={handleFileImport}
                className="hidden"
              />
            </label>
          </div>
        </div>

        {/* History Filters */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
          <button
            onClick={() => setActiveFilter('all')}
            className={`px-3 py-1.5 rounded-xl font-medium transition-colors cursor-pointer ${
              activeFilter === 'all'
                ? 'bg-rose-600 text-white shadow-sm'
                : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            Tümü ({history.length})
          </button>
          <button
            onClick={() => setActiveFilter('media')}
            className={`px-3 py-1.5 rounded-xl font-medium transition-colors cursor-pointer ${
              activeFilter === 'media'
                ? 'bg-rose-600 text-white shadow-sm'
                : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            Tekli Medya ({history.filter(h => h.type === 'single_photo' || h.type === 'single_video').length})
          </button>
          <button
            onClick={() => setActiveFilter('carousel')}
            className={`px-3 py-1.5 rounded-xl font-medium transition-colors cursor-pointer ${
              activeFilter === 'carousel'
                ? 'bg-rose-600 text-white shadow-sm'
                : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            Karusel & Günlük Klasörler ({history.filter(h => h.type === 'carousel_folder' || h.type === 'date_archive').length})
          </button>
          <button
            onClick={() => setActiveFilter('pdf')}
            className={`px-3 py-1.5 rounded-xl font-medium transition-colors cursor-pointer ${
              activeFilter === 'pdf'
                ? 'bg-rose-600 text-white shadow-sm'
                : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            PDF Belgeleri ({history.filter(h => h.type === 'pdf_archive').length})
          </button>
        </div>

        {/* Date Range Filter for History */}
        <DateRangeFilter
          startDate={historyStartDate}
          endDate={historyEndDate}
          onStartDateChange={setHistoryStartDate}
          onEndDateChange={setHistoryEndDate}
          onClear={() => {
            setHistoryStartDate('');
            setHistoryEndDate('');
          }}
          totalCount={history.length}
          filteredCount={filteredHistory.length}
          label="İndirme Tarih Aralığı"
        />

        {/* History Items List */}
        {filteredHistory.length === 0 ? (
          <div className="bg-slate-900/40 border border-dashed border-slate-800 rounded-2xl p-8 text-center">
            <HardDrive className="w-8 h-8 text-slate-600 mx-auto mb-2" />
            <div className="text-xs font-semibold text-slate-300">
              Henüz indirme kaydı bulunmuyor
            </div>
            <p className="text-[11px] text-slate-500 mt-1 max-w-sm mx-auto">
              Kullanıcı profilinden veya hızlı indirme sekmesinden fotoğraf, video, karusel klasörü veya PDF indirdiğinizde kayıtlar burada listelenecektir.
            </p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {filteredHistory.map((item) => (
              <div
                key={item.id}
                className="bg-slate-900/70 border border-slate-800/80 rounded-2xl p-3.5 flex items-center justify-between gap-3 transition-colors hover:border-slate-700"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-12 h-12 rounded-xl bg-slate-950 border border-slate-800 overflow-hidden shrink-0 flex items-center justify-center">
                    {item.thumbnailUrl ? (
                      <img
                        src={item.thumbnailUrl}
                        alt="Thumbnail"
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover"
                      />
                    ) : item.type === 'pdf_archive' ? (
                      <FileText className="w-6 h-6 text-rose-400" />
                    ) : item.type === 'carousel_folder' ? (
                      <FolderArchive className="w-6 h-6 text-amber-400" />
                    ) : item.type === 'single_video' ? (
                      <Film className="w-6 h-6 text-sky-400" />
                    ) : (
                      <ImageIcon className="w-6 h-6 text-slate-500" />
                    )}
                  </div>

                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm text-slate-100 truncate">
                        {item.title}
                      </span>
                      <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 shrink-0">
                        {item.type === 'pdf_archive'
                          ? 'PDF Arşivi'
                          : item.type === 'carousel_folder'
                          ? 'Karusel Klasörü'
                          : item.type === 'date_archive'
                          ? 'Günlük Arşiv'
                          : item.type === 'single_video'
                          ? 'Reels Video'
                          : 'Fotoğraf'}
                      </span>
                    </div>

                    <div className="flex items-center gap-3 mt-1 text-xs text-slate-400">
                      <span>{new Date(item.timestamp).toLocaleString('tr-TR')}</span>
                      <span>·</span>
                      <span className="text-slate-300 font-medium">{item.fileSizeEstimate}</span>
                      {item.note && (
                        <>
                          <span>·</span>
                          <span className="truncate max-w-[150px] sm:max-w-xs text-slate-400">
                            {item.note}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="text-[11px] font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-1 rounded-lg flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">İndirildi</span>
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Cloud Backup Creation Modal */}
      {showBackupModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full p-6 shadow-2xl">
            <div className="w-12 h-12 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center mb-3">
              <UploadCloud className="w-6 h-6 text-rose-400" />
            </div>
            <h3 className="text-lg font-bold text-white tracking-tight">
              Buluta Yeni Yedek Kaydet
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              Geçmişteki {history.length} adet indirme kaydınız bulut depolama sunucusunda güvenle arşivlenecektir.
            </p>

            <div className="mt-4">
              <label className="text-xs font-semibold text-slate-300 block mb-1.5">
                Yedekleme Adı (Opsiyonel)
              </label>
              <input
                type="text"
                value={backupNameInput}
                onChange={(e) => setBackupNameInput(e.target.value)}
                placeholder={`Yedekleme ${new Date().toLocaleDateString('tr-TR')}`}
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-xs sm:text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-rose-500"
              />
            </div>

            <div className="mt-6 flex items-center gap-2">
              <button
                onClick={() => setShowBackupModal(false)}
                className="flex-1 py-2.5 px-4 bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium text-xs sm:text-sm rounded-xl transition-colors cursor-pointer"
              >
                Vazgeç
              </button>
              <button
                onClick={handleCreateBackup}
                disabled={isBackingUp}
                className="flex-1 py-2.5 px-4 bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs sm:text-sm rounded-xl transition-all shadow-md active:scale-95 disabled:opacity-50 flex items-center justify-center gap-1.5 cursor-pointer"
              >
                {isBackingUp ? 'Kaydediliyor...' : 'Yedeği Oluştur'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* In-App Confirmation Modal (Replaces window.confirm completely!) */}
      {confirmModal && confirmModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full p-6 shadow-2xl relative">
            <button
              onClick={() => setConfirmModal(null)}
              className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="w-12 h-12 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center mb-3">
              <AlertTriangle className="w-6 h-6 text-rose-400" />
            </div>

            <h3 className="text-lg font-bold text-white tracking-tight">
              {confirmModal.title}
            </h3>
            <p className="text-xs sm:text-sm text-slate-300 mt-2 leading-relaxed">
              {confirmModal.description}
            </p>

            <div className="mt-6 flex items-center gap-3">
              <button
                onClick={() => setConfirmModal(null)}
                className="flex-1 py-2.5 px-4 bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium text-xs sm:text-sm rounded-xl transition-colors cursor-pointer min-h-[42px]"
              >
                Vazgeç
              </button>

              <button
                onClick={() => confirmModal.action()}
                className="flex-1 py-2.5 px-4 bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs sm:text-sm rounded-xl transition-all shadow-md active:scale-95 cursor-pointer min-h-[42px] flex items-center justify-center gap-1.5"
              >
                <Trash2 className="w-4 h-4" />
                <span>{confirmModal.confirmButtonText}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
