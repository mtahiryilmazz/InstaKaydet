import React, { useState, useRef, useEffect } from 'react';
import {
  DownloadCloud,
  Layers,
  Puzzle,
  Key,
  SlidersHorizontal,
  Clock,
  Zap,
  Sparkles,
  Check,
  ChevronDown,
} from 'lucide-react';

interface HeaderProps {
  activeTab: 'profile' | 'quick' | 'pdf' | 'logs' | 'cloud';
  setActiveTab: (tab: 'profile' | 'quick' | 'pdf' | 'logs' | 'cloud') => void;
  historyCount: number;
  onQuickCloudBackup: () => void;
  isBackingUp: boolean;
  isDataSaver: boolean;
  onToggleDataSaver: () => void;
  enhanceResolution?: boolean;
  onToggleEnhanceResolution?: () => void;
  onOpenExtensionModal?: () => void;
  onOpenSessionModal?: () => void;
  onOpenScheduledModal?: () => void;
  sessionId?: string;
  scheduledCount?: number;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  historyCount,
  onQuickCloudBackup,
  isBackingUp,
  isDataSaver,
  onToggleDataSaver,
  enhanceResolution = true,
  onToggleEnhanceResolution,
  onOpenExtensionModal,
  onOpenSessionModal,
  onOpenScheduledModal,
  sessionId = '',
  scheduledCount = 0,
}) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const navItems: Array<{
    id: 'profile' | 'quick' | 'pdf' | 'cloud' | 'logs';
    label: string;
    badge?: number;
    isWarning?: boolean;
  }> = [
    { id: 'profile', label: 'Profil & Arşiv' },
    { id: 'quick', label: 'Hızlı İndir' },
    { id: 'pdf', label: 'PDF Stüdyosu' },
    { id: 'cloud', label: 'Yedekler', badge: historyCount },
    { id: 'logs', label: 'Sistem Logları', isWarning: true },
  ];

  return (
    <header className="sticky top-0 z-40 bg-slate-950/90 backdrop-blur-xl border-b border-slate-800/80">
      <div className="max-w-6xl mx-auto px-3 sm:px-6 h-15 flex items-center justify-between gap-2 sm:gap-4">
        {/* Brand Wordmark */}
        <button
          onClick={() => setActiveTab('profile')}
          className="flex items-center gap-2.5 text-left group cursor-pointer focus-visible:outline-none shrink-0"
        >
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-amber-500 via-rose-500 to-purple-600 p-[1.5px] flex items-center justify-center shadow-sm">
            <div className="w-full h-full bg-slate-950 rounded-[10px] flex items-center justify-center">
              <Layers className="w-4 h-4 text-rose-400 group-hover:scale-110 transition-transform" />
            </div>
          </div>
          <div>
            <span className="text-base font-bold tracking-tight text-white group-hover:text-rose-400 transition-colors block leading-none">
              InstaFlow
            </span>
            <span className="text-[11px] text-slate-400 font-medium block mt-0.5">
              Medya & PDF Arşivleyici
            </span>
          </div>
        </button>

        {/* Desktop Segmented Navigation */}
        <nav className="hidden md:flex items-center gap-1 p-1 bg-slate-900/90 border border-slate-800/80 rounded-xl">
          {navItems.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
                  isActive
                    ? 'bg-slate-800 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
                }`}
              >
                {item.isWarning && (
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      isActive ? 'bg-amber-400' : 'bg-amber-400/70'
                    }`}
                  />
                )}
                <span>{item.label}</span>
                {typeof item.badge === 'number' && item.badge > 0 && (
                  <span className="text-[10px] font-mono text-rose-400 tabular-nums">
                    ({item.badge})
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Right Compact Action Cluster (Mobile & Desktop friendly) */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Session Cookie Status Trigger */}
          {onOpenSessionModal && (
            <button
              onClick={onOpenSessionModal}
              className={`px-3 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer border min-h-[40px] ${
                sessionId
                  ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-300 hover:bg-emerald-900/60'
                  : 'bg-slate-900 hover:bg-slate-800 border-slate-800 text-slate-300'
              }`}
              title="Instagram Oturum Çerezi (Session ID) Ayarları"
            >
              <span
                className={`w-2 h-2 rounded-full shrink-0 ${
                  sessionId ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'
                }`}
              />
              <Key className="w-3.5 h-3.5 text-rose-400 hidden sm:inline" />
              <span>{sessionId ? 'Oturum Aktif' : 'Oturum Ekle'}</span>
            </button>
          )}

          {/* Unified Tools & Preferences Dropdown Menu */}
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setIsMenuOpen((prev) => !prev)}
              className={`px-3 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer border min-h-[40px] ${
                isMenuOpen
                  ? 'bg-slate-800 border-slate-700 text-white'
                  : 'bg-slate-900 hover:bg-slate-800 border-slate-800 text-slate-200'
              }`}
              title="Araçlar, Kalite Ayarları ve Eklentiler"
            >
              <SlidersHorizontal className="w-3.5 h-3.5 text-rose-400" />
              <span className="hidden sm:inline">Araçlar</span>
              {scheduledCount > 0 && (
                <span className="w-4 h-4 rounded-full bg-purple-600 text-white text-[10px] font-bold flex items-center justify-center">
                  {scheduledCount}
                </span>
              )}
              <ChevronDown
                className={`w-3.5 h-3.5 text-slate-400 transition-transform ${
                  isMenuOpen ? 'rotate-180' : ''
                }`}
              />
            </button>

            {isMenuOpen && (
              <div className="absolute right-0 mt-2 w-64 bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-2 z-50 space-y-1 animate-in fade-in zoom-in-95 duration-150">
                <div className="px-3 py-1.5 text-[11px] font-semibold text-slate-400 border-b border-slate-800/80">
                  Kalite & Veri Ayarları
                </div>

                {/* HD Resolution Toggle */}
                {onToggleEnhanceResolution && (
                  <button
                    onClick={() => {
                      onToggleEnhanceResolution();
                    }}
                    className="w-full px-3 py-2.5 rounded-xl text-xs font-medium text-left flex items-center justify-between hover:bg-slate-800/80 transition-colors cursor-pointer"
                  >
                    <span className="flex items-center gap-2 text-slate-200">
                      <Sparkles className="w-4 h-4 text-amber-400" />
                      <span>1080p HD Çözünürlük</span>
                    </span>
                    <span
                      className={`text-[11px] font-semibold ${
                        enhanceResolution && !isDataSaver ? 'text-emerald-400' : 'text-slate-500'
                      }`}
                    >
                      {enhanceResolution && !isDataSaver ? 'Açık' : 'Kapalı'}
                    </span>
                  </button>
                )}

                {/* Data Saver Toggle */}
                <button
                  onClick={() => {
                    onToggleDataSaver();
                  }}
                  className="w-full px-3 py-2.5 rounded-xl text-xs font-medium text-left flex items-center justify-between hover:bg-slate-800/80 transition-colors cursor-pointer"
                >
                  <span className="flex items-center gap-2 text-slate-200">
                    <Zap className="w-4 h-4 text-emerald-400" />
                    <span>Veri Tasarrufu Modu</span>
                  </span>
                  <span
                    className={`text-[11px] font-semibold ${
                      isDataSaver ? 'text-emerald-400' : 'text-slate-500'
                    }`}
                  >
                    {isDataSaver ? 'Aktif' : 'Kapalı'}
                  </span>
                </button>

                <div className="px-3 pt-2 pb-1 text-[11px] font-semibold text-slate-400 border-t border-slate-800/80">
                  Yedekleme & Otomasyon
                </div>

                {/* Scheduled Downloads */}
                {onOpenScheduledModal && (
                  <button
                    onClick={() => {
                      setIsMenuOpen(false);
                      onOpenScheduledModal();
                    }}
                    className="w-full px-3 py-2.5 rounded-xl text-xs font-medium text-left flex items-center justify-between hover:bg-slate-800/80 transition-colors cursor-pointer text-slate-200"
                  >
                    <span className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-purple-400" />
                      <span>Zamanlanmış İndirme</span>
                    </span>
                    {scheduledCount > 0 && (
                      <span className="text-[11px] font-mono text-purple-300">
                        {scheduledCount} görev
                      </span>
                    )}
                  </button>
                )}

                {/* Chrome Extension Modal */}
                {onOpenExtensionModal && (
                  <button
                    onClick={() => {
                      setIsMenuOpen(false);
                      onOpenExtensionModal();
                    }}
                    className="w-full px-3 py-2.5 rounded-xl text-xs font-medium text-left flex items-center justify-between hover:bg-slate-800/80 transition-colors cursor-pointer text-slate-200"
                  >
                    <span className="flex items-center gap-2">
                      <Puzzle className="w-4 h-4 text-indigo-400" />
                      <span>Chrome Tarayıcı Eklentisi</span>
                    </span>
                    <span className="text-[10px] text-slate-400">400+</span>
                  </button>
                )}

                {/* Cloud Backup */}
                <button
                  onClick={() => {
                    setIsMenuOpen(false);
                    onQuickCloudBackup();
                  }}
                  disabled={isBackingUp}
                  className="w-full px-3 py-2.5 rounded-xl text-xs font-medium text-left flex items-center justify-between hover:bg-slate-800/80 transition-colors cursor-pointer text-slate-200 disabled:opacity-50"
                >
                  <span className="flex items-center gap-2">
                    <DownloadCloud className="w-4 h-4 text-rose-400" />
                    <span>{isBackingUp ? 'Yedekleniyor...' : 'Geçmişi Buluta Yedekle'}</span>
                  </span>
                  {!isBackingUp && <Check className="w-3.5 h-3.5 text-slate-500" />}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
