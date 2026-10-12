import React from 'react';
import { DownloadCloud, Sparkles, FolderArchive, Layers } from 'lucide-react';

interface HeaderProps {
  activeTab: 'profile' | 'quick' | 'pdf' | 'cloud';
  setActiveTab: (tab: 'profile' | 'quick' | 'pdf' | 'cloud') => void;
  historyCount: number;
  onQuickCloudBackup: () => void;
  isBackingUp: boolean;
  isDataSaver: boolean;
  onToggleDataSaver: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  historyCount,
  onQuickCloudBackup,
  isBackingUp,
  isDataSaver,
  onToggleDataSaver,
}) => {
  return (
    <header className="sticky top-0 z-40 bg-slate-950/90 backdrop-blur-md border-b border-slate-800/80">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
        {/* Zone 1: Single text element wordmark */}
        <div className="flex items-center gap-2.5 shrink-0">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-amber-500 via-rose-500 to-purple-600 p-0.5 flex items-center justify-center shadow-sm">
            <div className="w-full h-full bg-slate-950 rounded-[6px] flex items-center justify-center">
              <Layers className="w-4 h-4 text-rose-400" />
            </div>
          </div>
          <button
            onClick={() => setActiveTab('profile')}
            className="text-left group cursor-pointer focus-visible:outline-none"
          >
            <span className="text-base font-bold tracking-tight text-white group-hover:text-rose-400 transition-colors">
              InstaFlow
            </span>
            <span className="hidden sm:inline text-xs text-slate-400 ml-1.5 font-normal">
              Arşivleyici
            </span>
          </button>
        </div>

        {/* Zone 2: Desktop Navigation Links */}
        <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-300">
          <button
            onClick={() => setActiveTab('profile')}
            className={`whitespace-nowrap transition-colors py-1 cursor-pointer ${
              activeTab === 'profile'
                ? 'text-white border-b-2 border-rose-500 font-semibold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Kullanıcı & Tarih Arşivi
          </button>
          <button
            onClick={() => setActiveTab('quick')}
            className={`whitespace-nowrap transition-colors py-1 cursor-pointer ${
              activeTab === 'quick'
                ? 'text-white border-b-2 border-rose-500 font-semibold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Hızlı Medya İndir
          </button>
          <button
            onClick={() => setActiveTab('pdf')}
            className={`whitespace-nowrap transition-colors py-1 cursor-pointer ${
              activeTab === 'pdf'
                ? 'text-white border-b-2 border-rose-500 font-semibold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Tek Dosya PDF
          </button>
          <button
            onClick={() => setActiveTab('cloud')}
            className={`whitespace-nowrap transition-colors py-1 cursor-pointer ${
              activeTab === 'cloud'
                ? 'text-white border-b-2 border-rose-500 font-semibold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Bulut Yedek & Geçmiş ({historyCount})
          </button>
        </nav>

        {/* Zone 3: Actions (Tasarruf Modu & Cloud Backup) */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Data Saver Mode Toggle Button */}
          <button
            onClick={onToggleDataSaver}
            className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer border min-h-[38px] ${
              isDataSaver
                ? 'bg-emerald-950/70 border-emerald-500/50 text-emerald-300 shadow-sm'
                : 'bg-slate-900 border-slate-700/80 text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
            title={
              isDataSaver
                ? 'Veri Tasarrufu Modu Aktif: Orta Çözünürlük ve ~%60 Daha Az Mobil Kota Harcar'
                : 'Veri Tasarrufu Kapalı: Orijinal HD Çözünürlük'
            }
          >
            <span className={`w-2 h-2 rounded-full ${isDataSaver ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'}`} />
            <span className="hidden sm:inline">Tasarruf Modu:</span>
            <span>{isDataSaver ? 'Açık' : 'Kapalı'}</span>
          </button>

          <button
            onClick={onQuickCloudBackup}
            disabled={isBackingUp}
            className="px-3.5 py-1.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 border border-slate-700/80 rounded-lg transition-all flex items-center gap-1.5 active:scale-95 disabled:opacity-50 cursor-pointer min-h-[38px]"
            title="İndirme geçmişini buluta yedekle"
          >
            <DownloadCloud className={`w-3.5 h-3.5 text-rose-400 ${isBackingUp ? 'animate-bounce' : ''}`} />
            <span className="hidden sm:inline">
              {isBackingUp ? 'Buluta Yedekleniyor...' : 'Buluta Yedekle'}
            </span>
            <span className="sm:hidden">Yedekle</span>
          </button>
        </div>
      </div>
    </header>
  );
};
