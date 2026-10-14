import React, { useState, useEffect, useRef } from 'react';
import { UserProfile } from '../types';
import {
  Search,
  CheckCircle2,
  FileText,
  ArrowUpDown,
  Sparkles,
  Loader2,
  Plus,
  X,
  Clock,
  Download,
  Table,
  Key,
  Puzzle,
  MoreHorizontal,
  RefreshCw,
  Film,
  XCircle,
} from 'lucide-react';

interface UserProfileHeaderProps {
  profile: UserProfile;
  totalPosts: number;
  totalMedia: number;
  onSearchUsername: (username: string, force?: boolean) => void;
  isLoading: boolean;
  onOpenPdfModal: () => void;
  sortOrder: 'desc' | 'asc';
  onToggleSortOrder: () => void;
  selectedCount?: number;
  onSelectAllPosts?: () => void;
  onClearSelection?: () => void;
  onExportSelectedPdf?: () => void;
  onOpenSessionModal?: () => void;
  onOpenBulkDownloadModal?: () => void;
  onExportCsvStandalone?: () => void;
  onOpenExtensionModal?: () => void;
  sessionId?: string;
  isDataSaver?: boolean;
  onToggleDataSaver?: () => void;
  cooldownSeconds: number;
  autoLiveFetch?: boolean;
  onToggleAutoLiveFetch?: () => void;
  onDeepScan?: (targetCount: number) => void;
  onCancelDeepScan?: () => void;
  isScanningDeep?: boolean;
  excludeVideos?: boolean;
  onToggleExcludeVideos?: () => void;
  onLoadMore?: () => void;
  isLoadingMore?: boolean;
  hasNextPage?: boolean;
}

export const UserProfileHeader: React.FC<UserProfileHeaderProps> = ({
  profile,
  totalPosts,
  onSearchUsername,
  isLoading,
  onOpenPdfModal,
  sortOrder,
  onToggleSortOrder,
  onOpenSessionModal,
  onOpenBulkDownloadModal,
  onExportCsvStandalone,
  onOpenExtensionModal,
  sessionId = '',
  cooldownSeconds,
  onDeepScan,
  onCancelDeepScan,
  isScanningDeep = false,
  excludeVideos = true,
  onToggleExcludeVideos,
}) => {
  const [searchInput, setSearchInput] = useState(profile.username || '');
  const [isActionsMenuOpen, setIsActionsMenuOpen] = useState(false);
  const actionsMenuRef = useRef<HTMLDivElement>(null);

  const [savedAccounts, setSavedAccounts] = useState<string[]>(() => {
    try {
      const stored = localStorage.getItem('instaflow_saved_quick_accounts');
      return stored ? JSON.parse(stored) : ['dkabcikpsslianne', 'trthaber'];
    } catch {
      return ['dkabcikpsslianne', 'trthaber'];
    }
  });
  const [isAddingAccount, setIsAddingAccount] = useState(false);
  const [newAccountInput, setNewAccountInput] = useState('');

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (actionsMenuRef.current && !actionsMenuRef.current.contains(e.target as Node)) {
        setIsActionsMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const prevProfileUsernameRef = useRef(profile.username);
  useEffect(() => {
    if (profile.username && profile.username !== prevProfileUsernameRef.current) {
      prevProfileUsernameRef.current = profile.username;
      setSearchInput(profile.username);
    }
  }, [profile.username]);

  const cleanInput = (val: string) => {
    return val
      .replace(/^https?:\/\/(www\.)?instagram\.com\//, '')
      .replace(/^@/, '')
      .replace(/\/.*$/, '')
      .trim()
      .toLowerCase();
  };

  const handleAddAccount = (accountToAdd?: string) => {
    const raw = accountToAdd || newAccountInput;
    const clean = cleanInput(raw);
    if (!clean) return;
    if (!savedAccounts.includes(clean)) {
      const updated = [...savedAccounts, clean];
      setSavedAccounts(updated);
      try {
        localStorage.setItem('instaflow_saved_quick_accounts', JSON.stringify(updated));
      } catch {}
    }
    setNewAccountInput('');
    setIsAddingAccount(false);
  };

  const handleRemoveAccount = (e: React.MouseEvent, accountToRemove: string) => {
    e.stopPropagation();
    const updated = savedAccounts.filter((a) => a !== accountToRemove);
    setSavedAccounts(updated);
    try {
      localStorage.setItem('instaflow_saved_quick_accounts', JSON.stringify(updated));
    } catch {}
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = cleanInput(searchInput);
    if (cleaned && !isLoading) {
      onSearchUsername(cleaned, true);
    }
  };

  const handleForceRefresh = () => {
    const cleaned = cleanInput(searchInput) || profile.username;
    if (cleaned && !isLoading) {
      onSearchUsername(cleaned, true);
    }
  };

  const handlePasteInput = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const text = e.clipboardData.getData('text');
    if (text) {
      const cleaned = cleanInput(text);
      if (cleaned) {
        setSearchInput(cleaned);
        setTimeout(() => {
          onSearchUsername(cleaned, true);
        }, 60);
      }
    }
  };

  return (
    <div className="bg-slate-900/70 border border-slate-800/90 rounded-2xl p-4 sm:p-6 space-y-4 mb-5 backdrop-blur-sm shadow-lg">
      {/* Search Bar & Quick Accounts */}
      <div className="space-y-3">
        <form onSubmit={handleSearchSubmit} className="flex items-center gap-2">
          <div className="relative flex-1 min-w-0">
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onPaste={handlePasteInput}
              placeholder="Kullanıcı adı veya profil linki (örn: dkabcikpsslianne)"
              className="w-full pl-9 pr-3 py-2.5 bg-slate-950/90 border border-slate-800 rounded-xl text-xs sm:text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-rose-500 transition-colors"
            />
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>

          <button
            type="submit"
            disabled={isLoading || !cleanInput(searchInput)}
            className="px-4 py-2.5 text-white font-semibold text-xs sm:text-sm rounded-xl transition-all shadow-sm active:scale-95 disabled:opacity-50 flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap min-h-[42px] bg-rose-600 hover:bg-rose-500 shrink-0"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-white" />
                <span className="hidden sm:inline">Yükleniyor...</span>
              </>
            ) : (
              <>
                <Search className="w-4 h-4 sm:hidden" />
                <span>Profili Getir</span>
              </>
            )}
          </button>

          {profile.username && (
            <button
              type="button"
              onClick={handleForceRefresh}
              disabled={isLoading}
              className="p-2.5 bg-slate-800/80 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700/60 rounded-xl transition-all cursor-pointer min-h-[42px] min-w-[42px] flex items-center justify-center shrink-0 disabled:opacity-40"
              title="Canlı Veriyi Yenile"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-rose-400' : ''}`} />
            </button>
          )}
        </form>

        {/* Horizontal Quick Accounts Bar */}
        <div className="flex items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5 max-w-full">
            <span className="text-slate-500 shrink-0 text-[11px] font-medium">Kayıtlı:</span>
            {savedAccounts.map((acc) => (
              <div
                key={acc}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-lg transition-colors whitespace-nowrap border text-[11px] shrink-0 ${
                  profile.username === acc
                    ? 'bg-rose-500/15 text-rose-300 border-rose-500/30 font-semibold'
                    : 'bg-slate-950/60 hover:bg-slate-800 text-slate-300 border-slate-800'
                }`}
              >
                <button
                  type="button"
                  onClick={() => {
                    setSearchInput(acc);
                    onSearchUsername(acc, true);
                  }}
                  className="cursor-pointer"
                >
                  @{acc}
                </button>
                <button
                  type="button"
                  onClick={(e) => handleRemoveAccount(e, acc)}
                  className="text-slate-500 hover:text-rose-400 p-0.5 rounded cursor-pointer"
                  title="Kaldır"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}

            {profile.username && !savedAccounts.includes(profile.username) && (
              <button
                type="button"
                onClick={() => handleAddAccount(profile.username)}
                className="px-2 py-1 text-[11px] text-rose-400 hover:text-rose-300 bg-rose-500/10 rounded-lg flex items-center gap-1 cursor-pointer shrink-0 font-medium"
              >
                <Plus className="w-3 h-3" />
                <span>@{profile.username}</span>
              </button>
            )}

            {isAddingAccount ? (
              <div className="flex items-center gap-1 shrink-0">
                <input
                  type="text"
                  value={newAccountInput}
                  onChange={(e) => setNewAccountInput(e.target.value)}
                  placeholder="kullanıcı adı"
                  className="px-2 py-1 text-[11px] bg-slate-950 border border-slate-700 rounded-lg text-white w-28 focus:outline-none focus:border-rose-500"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddAccount();
                    }
                  }}
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => handleAddAccount()}
                  className="px-2 py-1 bg-rose-600 text-white text-[11px] rounded-lg cursor-pointer font-medium"
                >
                  Ekle
                </button>
                <button
                  type="button"
                  onClick={() => setIsAddingAccount(false)}
                  className="text-slate-400 hover:text-white text-[11px] px-1 cursor-pointer"
                >
                  ✕
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setIsAddingAccount(true)}
                className="px-2 py-1 text-[11px] text-slate-400 hover:text-white bg-slate-950/60 hover:bg-slate-800 border border-slate-800 rounded-lg flex items-center gap-1 cursor-pointer shrink-0"
              >
                <Plus className="w-3 h-3" />
                <span>Ekle</span>
              </button>
            )}
          </div>

          {cooldownSeconds > 0 && (
            <div className="flex items-center gap-1.5 text-[11px] text-amber-300 shrink-0 font-mono tabular-nums">
              <Clock className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
              <span>{cooldownSeconds}sn</span>
            </div>
          )}
        </div>
      </div>

      {/* Profile Summary & Clean Action Hierarchy */}
      {profile.username && (
        <div className="pt-4 border-t border-slate-800/80 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          {/* Left: Avatar & Bio */}
          <div className="flex items-start sm:items-center gap-3.5 min-w-0">
            <div className="relative shrink-0">
              <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full p-0.5 bg-gradient-to-tr from-amber-500 via-rose-500 to-purple-600">
                {profile.avatarUrl ? (
                  <img
                    src={profile.avatarUrl}
                    alt={profile.username}
                    referrerPolicy="no-referrer"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = `data:image/svg+xml;utf8,${encodeURIComponent(
                        `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200"><defs><linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#f09433"/><stop offset="50%" stop-color="#dc2743"/><stop offset="100%" stop-color="#bc1888"/></linearGradient></defs><rect width="200" height="200" rx="100" fill="url(#g)"/><text x="100" y="116" font-family="sans-serif" font-size="70" font-weight="bold" fill="#ffffff" text-anchor="middle" dominant-baseline="middle">${(
                          profile.username || 'IG'
                        )
                          .slice(0, 2)
                          .toUpperCase()}</text></svg>`
                      )}`;
                    }}
                    className="w-full h-full object-cover rounded-full bg-slate-950"
                  />
                ) : (
                  <div className="w-full h-full rounded-full bg-slate-900 flex items-center justify-center font-bold text-white text-base">
                    {profile.username?.slice(0, 2).toUpperCase() || 'IG'}
                  </div>
                )}
              </div>
              {profile.isVerified && (
                <CheckCircle2 className="w-4 h-4 text-sky-400 bg-slate-950 rounded-full absolute bottom-0 right-0" />
              )}
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base sm:text-lg font-bold text-white tracking-tight truncate">
                  @{profile.username}
                </h2>
                <span className="text-xs text-slate-400 hidden sm:inline">·</span>
                <span className="text-xs text-slate-400 truncate">
                  {profile.fullName || `@${profile.username}`}
                </span>
              </div>

              {profile.bio && (
                <p className="text-xs text-slate-300 mt-1 line-clamp-2 leading-relaxed">
                  {profile.bio}
                </p>
              )}

              {/* Clean Unboxed Metadata Line */}
              <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 mt-2 text-xs text-slate-400">
                <span>
                  <strong className="text-white font-semibold tabular-nums">
                    {(profile.postsCount || totalPosts).toLocaleString('tr-TR')}
                  </strong>{' '}
                  gönderi
                </span>
                <span aria-hidden="true">·</span>
                <span>
                  <strong className="text-white font-semibold tabular-nums">
                    {profile.followersCount >= 10000
                      ? `${(profile.followersCount / 1000).toLocaleString('tr-TR', {
                          maximumFractionDigits: 1,
                        })} B`
                      : profile.followersCount.toLocaleString('tr-TR')}
                  </strong>{' '}
                  takipçi
                </span>
                <span aria-hidden="true">·</span>
                <span className="text-emerald-400 font-medium tabular-nums">
                  {totalPosts} yüklü
                </span>
              </div>
            </div>
          </div>

          {/* Right: Streamlined Primary Actions + Secondary Overflow Menu */}
          <div className="flex items-center gap-2 w-full lg:w-auto justify-end shrink-0 pt-2 lg:pt-0 border-t lg:border-t-0 border-slate-800/60">
            {/* Primary 1: Scan / Cancel All Posts */}
            {onDeepScan && (
              isScanningDeep ? (
                <button
                  type="button"
                  onClick={onCancelDeepScan}
                  className="flex-1 sm:flex-none px-3.5 py-2.5 bg-rose-600 hover:bg-rose-500 text-white border border-rose-500/80 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all shadow-md cursor-pointer min-h-[42px] active:scale-95"
                  title="Derin taramayı anında durdurur ve tamamlanan verileri saklar"
                >
                  <XCircle className="w-4 h-4 shrink-0 text-white animate-pulse" />
                  <span className="truncate">Taramayı İptal Et</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => onDeepScan(profile.postsCount || 400)}
                  className="flex-1 sm:flex-none px-3.5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-100 border border-slate-700/80 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer min-h-[42px]"
                  title="Hesaptaki tüm gönderileri arka arkaya tarar"
                >
                  <Sparkles className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <span className="truncate">Tümünü Tara</span>
                </button>
              )
            )}

            {/* Primary 2: Bulk Download ZIP / PDF */}
            {onOpenBulkDownloadModal && totalPosts > 0 && (
              <button
                type="button"
                onClick={onOpenBulkDownloadModal}
                className="flex-1 sm:flex-none px-4 py-2.5 bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs rounded-xl flex items-center justify-center gap-1.5 transition-all shadow-sm active:scale-95 cursor-pointer min-h-[42px]"
              >
                <Download className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">Toplu İndir (ZIP / PDF)</span>
              </button>
            )}

            {/* Secondary Actions Dropdown (Eliminates 6-button clutter) */}
            <div className="relative" ref={actionsMenuRef}>
              <button
                type="button"
                onClick={() => setIsActionsMenuOpen((prev) => !prev)}
                className="p-2.5 bg-slate-800/90 hover:bg-slate-700 border border-slate-700/80 rounded-xl text-slate-200 flex items-center justify-center transition-colors cursor-pointer min-h-[42px] min-w-[42px]"
                title="Diğer Profil İşlemleri"
              >
                <MoreHorizontal className="w-4 h-4" />
              </button>

              {isActionsMenuOpen && (
                <div className="absolute right-0 mt-2 w-60 bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-1.5 z-50 space-y-1 animate-in fade-in zoom-in-95 duration-150">
                  <button
                    type="button"
                    onClick={() => {
                      setIsActionsMenuOpen(false);
                      onOpenPdfModal();
                    }}
                    className="w-full px-3 py-2.5 rounded-xl text-xs font-medium text-left flex items-center gap-2.5 text-slate-200 hover:bg-slate-800 transition-colors cursor-pointer"
                  >
                    <FileText className="w-4 h-4 text-rose-400 shrink-0" />
                    <span>Tümünü Tek PDF Yap</span>
                  </button>

                  {onExportCsvStandalone && (
                    <button
                      type="button"
                      onClick={() => {
                        setIsActionsMenuOpen(false);
                        onExportCsvStandalone();
                      }}
                      className="w-full px-3 py-2.5 rounded-xl text-xs font-medium text-left flex items-center gap-2.5 text-slate-200 hover:bg-slate-800 transition-colors cursor-pointer"
                    >
                      <Table className="w-4 h-4 text-emerald-400 shrink-0" />
                      <span>Excel / CSV Tablosu İndir</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => {
                      onToggleSortOrder();
                      setIsActionsMenuOpen(false);
                    }}
                    className="w-full px-3 py-2.5 rounded-xl text-xs font-medium text-left flex items-center justify-between text-slate-200 hover:bg-slate-800 transition-colors cursor-pointer"
                  >
                    <span className="flex items-center gap-2.5">
                      <ArrowUpDown className="w-4 h-4 text-sky-400 shrink-0" />
                      <span>Tarih Sıralaması</span>
                    </span>
                    <span className="text-[11px] text-slate-400">
                      {sortOrder === 'desc' ? 'Yeni → Eski' : 'Eski → Yeni'}
                    </span>
                  </button>

                  {onToggleExcludeVideos && (
                    <button
                      type="button"
                      onClick={() => {
                        onToggleExcludeVideos();
                      }}
                      className="w-full px-3 py-2.5 rounded-xl text-xs font-medium text-left flex items-center justify-between text-slate-200 hover:bg-slate-800 transition-colors cursor-pointer"
                    >
                      <span className="flex items-center gap-2.5">
                        <Film className="w-4 h-4 text-purple-400 shrink-0" />
                        <span>Videolar & Reels</span>
                      </span>
                      <span
                        className={`text-[11px] font-semibold ${
                          excludeVideos ? 'text-rose-400' : 'text-emerald-400'
                        }`}
                      >
                        {excludeVideos ? 'Gizli' : 'Gösteriliyor'}
                      </span>
                    </button>
                  )}

                  {onOpenSessionModal && (
                    <button
                      type="button"
                      onClick={() => {
                        setIsActionsMenuOpen(false);
                        onOpenSessionModal();
                      }}
                      className="w-full px-3 py-2.5 rounded-xl text-xs font-medium text-left flex items-center justify-between text-slate-200 hover:bg-slate-800 transition-colors cursor-pointer border-t border-slate-800/80"
                    >
                      <span className="flex items-center gap-2.5">
                        <Key className="w-4 h-4 text-amber-400 shrink-0" />
                        <span>Session ID Ayarla</span>
                      </span>
                      <span className="text-[10px] text-slate-400">
                        {sessionId ? 'Aktif' : 'Yok'}
                      </span>
                    </button>
                  )}

                  {onOpenExtensionModal && (
                    <button
                      type="button"
                      onClick={() => {
                        setIsActionsMenuOpen(false);
                        onOpenExtensionModal();
                      }}
                      className="w-full px-3 py-2.5 rounded-xl text-xs font-medium text-left flex items-center gap-2.5 text-slate-200 hover:bg-slate-800 transition-colors cursor-pointer"
                    >
                      <Puzzle className="w-4 h-4 text-indigo-400 shrink-0" />
                      <span>Chrome Eklentisi İndir</span>
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
