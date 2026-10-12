import React, { useState } from 'react';
import { UserProfile } from '../types';
import { Search, CheckCircle2, FileText, ArrowUpDown, Sparkles, Loader2, Plus, X } from 'lucide-react';

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
  sessionId?: string;
  isDataSaver?: boolean;
  onToggleDataSaver?: () => void;
}

export const UserProfileHeader: React.FC<UserProfileHeaderProps> = ({
  profile,
  totalPosts,
  totalMedia,
  onSearchUsername,
  isLoading,
  onOpenPdfModal,
  sortOrder,
  onToggleSortOrder,
  selectedCount = 0,
  onSelectAllPosts,
  onClearSelection,
  onExportSelectedPdf,
  onOpenSessionModal,
  sessionId = '',
  isDataSaver = false,
  onToggleDataSaver,
}) => {
  const [searchInput, setSearchInput] = useState(profile.username || 'mtahiryilmazz');
  const [isDebouncing, setIsDebouncing] = useState(false);
  const [isFocused, setIsFocused] = useState(false);

  // Requirement: "hızlı seç kısmını boş bırak kullanıcı kendisi ekleyip çıkarsın"
  const [savedAccounts, setSavedAccounts] = useState<string[]>(() => {
    try {
      const stored = localStorage.getItem('instaflow_saved_quick_accounts');
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });
  const [isAddingAccount, setIsAddingAccount] = useState(false);
  const [newAccountInput, setNewAccountInput] = useState('');

  const lastSearchedRef = React.useRef(profile.username || '');

  // Synchronize input ONLY when user is not actively typing inside the field
  React.useEffect(() => {
    if (!isFocused && profile.username && profile.username !== searchInput) {
      lastSearchedRef.current = profile.username;
      setSearchInput(profile.username);
    }
  }, [profile.username, isFocused]);

  // Clean username helper (strips URL, @, spaces)
  const cleanInput = (val: string) => {
    return val
      .replace(/^https?:\/\/(www\.)?instagram\.com\//, '')
      .replace(/^@/, '')
      .replace(/\/.*$/, '')
      .trim()
      .toLowerCase();
  };

  // Add account to quick select
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

  // Remove account from quick select
  const handleRemoveAccount = (e: React.MouseEvent, accountToRemove: string) => {
    e.stopPropagation();
    const updated = savedAccounts.filter(a => a !== accountToRemove);
    setSavedAccounts(updated);
    try {
      localStorage.setItem('instaflow_saved_quick_accounts', JSON.stringify(updated));
    } catch {}
  };

  // Automatic Debounced Search on typing - triggers automatically as user types username
  React.useEffect(() => {
    const cleaned = cleanInput(searchInput);
    if (!cleaned || cleaned.length < 3) {
      setIsDebouncing(false);
      return;
    }

    // If already loaded this exact username with real data, skip
    if (cleaned === profile.username && profile.isRealInstagramData) {
      setIsDebouncing(false);
      return;
    }

    // Don't search again if already in flight or searched
    if (cleaned === lastSearchedRef.current) {
      setIsDebouncing(false);
      return;
    }

    setIsDebouncing(true);
    const timer = setTimeout(() => {
      setIsDebouncing(false);
      lastSearchedRef.current = cleaned;
      onSearchUsername(cleaned, true); // ALWAYS LIVE FIRST!
    }, 450);

    return () => clearTimeout(timer);
  }, [searchInput, profile.username, profile.isRealInstagramData]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = cleanInput(searchInput);
    if (cleaned) {
      lastSearchedRef.current = cleaned;
      onSearchUsername(cleaned, true); // ALWAYS LIVE FIRST!
    }
  };

  const handleForceRefresh = () => {
    const cleaned = cleanInput(searchInput) || profile.username;
    if (cleaned) {
      lastSearchedRef.current = cleaned;
      onSearchUsername(cleaned, true);
    }
  };

  return (
    <div className="bg-slate-900/60 border border-slate-800 rounded-3xl p-5 sm:p-6 space-y-5 mb-6 backdrop-blur-sm shadow-xl">
      {/* Search Bar Section */}
      <div>
        <form onSubmit={handleSearchSubmit} className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
          <div className="relative flex-1">
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
              placeholder="Instagram kullanıcı adı veya profil linki (örn: mtahiryilmazz)"
              className="w-full pl-10 pr-10 py-3 sm:py-2.5 bg-slate-950/80 border border-slate-700/80 rounded-2xl text-xs sm:text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-rose-500 focus:ring-1 focus:ring-rose-500 transition-all shadow-inner"
            />
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />

            {/* Debounce spinner inside input */}
            {isDebouncing && (
              <div className="absolute right-3.5 top-1/2 -translate-y-1/2 flex items-center">
                <Loader2 className="w-3.5 h-3.5 text-rose-400 animate-spin" />
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="submit"
              disabled={isLoading || !cleanInput(searchInput)}
              className="flex-1 sm:flex-none px-4 py-2.5 bg-rose-600 hover:bg-rose-500 text-white font-medium text-xs sm:text-sm rounded-xl transition-all shadow-md active:scale-95 disabled:opacity-50 flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap min-h-[44px]"
            >
              {isLoading ? <Loader2 className="w-4 h-4 animate-spin text-white" /> : <Search className="w-4 h-4" />}
              <span>{isLoading ? 'Canlı Çekiliyor...' : 'Canlı Çek'}</span>
            </button>

            {profile.username && (
              <button
                type="button"
                onClick={handleForceRefresh}
                disabled={isLoading}
                className="p-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700/60 rounded-xl transition-all cursor-pointer min-h-[44px] min-w-[44px] flex items-center justify-center shrink-0"
                title="Canlı Veriyi Yeniden Tara"
              >
                <Sparkles className="w-4 h-4 text-amber-400" />
              </button>
            )}
          </div>
        </form>

        {isLoading && (
          <div className="mt-2.5 p-2.5 bg-rose-500/10 border border-rose-500/20 rounded-xl flex items-center gap-2 text-xs text-rose-300 animate-pulse">
            <Loader2 className="w-3.5 h-3.5 animate-spin text-rose-400 shrink-0" />
            <span>Instagram'dan @{cleanInput(searchInput) || profile.username} verileri çekiliyor ve tarihe göre gruplanıyor...</span>
          </div>
        )}

        {/* Suggestion Chips (User managed: add/remove) & Session ID settings */}
        <div className="flex items-center justify-between gap-2 mt-3 text-xs text-slate-400 flex-wrap">
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 max-w-full">
            <span className="text-slate-500 shrink-0 text-[11px] font-semibold">Hızlı Seç:</span>
            {savedAccounts.length === 0 ? (
              <span className="text-slate-500 text-[11px] italic shrink-0">
                (Kullanıcı eklemedi - boş)
              </span>
            ) : (
              savedAccounts.map((acc) => (
                <div
                  key={acc}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-lg transition-colors whitespace-nowrap border text-[11px] ${
                    profile.username === acc
                      ? 'bg-rose-600/20 text-rose-300 border-rose-500/40 font-semibold'
                      : 'bg-slate-800/80 hover:bg-slate-700/90 text-slate-300 hover:text-white border-slate-700/50'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => {
                      setSearchInput(acc);
                      onSearchUsername(acc, true);
                    }}
                    className="cursor-pointer hover:underline"
                  >
                    @{acc}
                  </button>
                  <button
                    type="button"
                    onClick={(e) => handleRemoveAccount(e, acc)}
                    className="text-slate-400 hover:text-rose-400 p-0.5 rounded cursor-pointer ml-0.5"
                    title={`@${acc} hesabını hızlı seçimden kaldır`}
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))
            )}

            {/* Quick action to add current viewed profile */}
            {profile.username && !savedAccounts.includes(profile.username) && (
              <button
                type="button"
                onClick={() => handleAddAccount(profile.username)}
                className="px-2 py-0.5 text-[11px] text-rose-400 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 rounded-lg flex items-center gap-1 cursor-pointer shrink-0 font-medium"
                title="Şu anki profili hızlı seçime kaydet"
              >
                <Plus className="w-3 h-3" />
                <span>+ @{profile.username}'i Ekle</span>
              </button>
            )}

            {/* Add custom account prompt */}
            {isAddingAccount ? (
              <div className="flex items-center gap-1 shrink-0">
                <input
                  type="text"
                  value={newAccountInput}
                  onChange={(e) => setNewAccountInput(e.target.value)}
                  placeholder="kullanıcı adı"
                  className="px-2 py-0.5 text-[11px] bg-slate-900 border border-slate-700 rounded-lg text-white w-28 focus:outline-none focus:border-rose-500"
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
                  className="px-2 py-0.5 bg-rose-600 text-white text-[11px] rounded-lg cursor-pointer"
                >
                  Ekle
                </button>
                <button
                  type="button"
                  onClick={() => setIsAddingAccount(false)}
                  className="text-slate-400 hover:text-white text-[11px] p-0.5 cursor-pointer"
                >
                  ✕
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setIsAddingAccount(true)}
                className="px-2 py-0.5 text-[11px] text-slate-400 hover:text-white bg-slate-800/60 hover:bg-slate-800 border border-slate-700/60 rounded-lg flex items-center gap-1 cursor-pointer shrink-0"
                title="Hızlı seçime yeni hesap ekle"
              >
                <Plus className="w-3 h-3" />
                <span>Hesap Ekle</span>
              </button>
            )}
          </div>

          {onOpenSessionModal && (
            <button
              onClick={onOpenSessionModal}
              className="text-[11px] text-slate-400 hover:text-rose-400 transition-colors flex items-center gap-1 cursor-pointer ml-auto shrink-0"
              title="Instagram hız sınırını aşmak için çerez ekle"
            >
              <span>{sessionId ? '🟢 Oturum Aktif' : '🔑 Instagram Session ID Ekle'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Profile Card */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pt-4 border-t border-slate-800/80">
        <div className="flex items-center gap-4">
          <div className="relative shrink-0">
            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full p-0.5 bg-gradient-to-tr from-amber-500 via-rose-500 to-purple-600">
              {profile.avatarUrl ? (
                <img
                  src={profile.avatarUrl}
                  alt={profile.username}
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover rounded-full bg-slate-950"
                />
              ) : (
                <div className="w-full h-full rounded-full bg-slate-900 border border-slate-700/60 flex items-center justify-center font-bold text-white text-lg tracking-wider">
                  {profile.username?.slice(0, 2).toUpperCase() || 'IG'}
                </div>
              )}
            </div>
            {profile.isVerified && (
              <CheckCircle2 className="w-5 h-5 text-sky-400 bg-slate-950 rounded-full absolute bottom-0 right-0" />
            )}
          </div>

          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg sm:text-xl font-bold text-white tracking-tight">
                @{profile.username}
              </h2>
              {profile.isRealInstagramData ? (
                <span className="text-[10px] font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                  Canlı Instagram Verisi
                </span>
              ) : (
                <span className="text-[10px] font-semibold text-sky-400 bg-sky-500/10 border border-sky-500/20 px-2 py-0.5 rounded-full flex items-center gap-1">
                  Instagram Hesabı
                </span>
              )}
            </div>
            <p className="text-xs sm:text-sm text-slate-400 font-medium">
              {profile.fullName || `@${profile.username}`}
            </p>

            {profile.bio && (
              <p className="text-xs text-slate-300 mt-1.5 whitespace-pre-line line-clamp-2">
                {profile.bio}
              </p>
            )}

            {/* Unboxed Metadata metrics with separators */}
            <div className="flex items-center gap-2 mt-2 text-xs text-slate-300 font-medium">
              <span className="font-semibold text-white tabular-nums">{totalPosts}</span>
              <span className="text-slate-400">gönderi</span>
              <span aria-hidden="true" className="text-slate-600">·</span>
              <span className="font-semibold text-white tabular-nums">{totalMedia}</span>
              <span className="text-slate-400">medya</span>
              <span aria-hidden="true" className="text-slate-600">·</span>
              <span className="font-semibold text-white tabular-nums">
                {profile.followersCount.toLocaleString('tr-TR')}
              </span>
              <span className="text-slate-400">takipçi</span>
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="grid grid-cols-2 sm:flex sm:flex-row items-center gap-2 w-full sm:w-auto justify-end">
          {/* Data Saver Mode Toggle Button */}
          {onToggleDataSaver && (
            <button
              type="button"
              onClick={onToggleDataSaver}
              className={`px-3 py-2.5 sm:py-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer border min-h-[42px] ${
                isDataSaver
                  ? 'bg-emerald-950/70 border-emerald-500/50 text-emerald-300 shadow-sm'
                  : 'bg-slate-800 hover:bg-slate-700/80 border-slate-700/60 text-slate-300'
              }`}
              title={
                isDataSaver
                  ? 'Veri Tasarrufu Modu Aktif: Orta Çözünürlük ve ~%60 Daha Az Mobil Kota Harcar'
                  : 'Veri Tasarrufu Kapalı: Orijinal HD Çözünürlük'
              }
            >
              <span className={`w-2 h-2 rounded-full shrink-0 ${isDataSaver ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'}`} />
              <span className="truncate">Tasarruf: {isDataSaver ? 'Açık' : 'Kapalı'}</span>
            </button>
          )}

          <button
            type="button"
            onClick={onToggleSortOrder}
            className="px-3 py-2.5 sm:py-2 bg-slate-800 hover:bg-slate-700/80 border border-slate-700/60 rounded-xl text-xs font-medium text-slate-300 flex items-center justify-center gap-1.5 transition-colors cursor-pointer min-h-[42px]"
            title="Tarih sıralamasını değiştir"
          >
            <ArrowUpDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span className="truncate">{sortOrder === 'desc' ? 'Yeniden Eskiye' : 'Eskiden Yeniye'}</span>
          </button>

          {selectedCount && selectedCount > 0 ? (
            <button
              type="button"
              onClick={onExportSelectedPdf}
              className="col-span-2 sm:col-span-1 px-3.5 py-2.5 sm:py-2 bg-emerald-600 hover:bg-emerald-500 border border-emerald-500/50 rounded-xl text-xs font-semibold text-white flex items-center justify-center gap-1.5 transition-all shadow-md active:scale-95 cursor-pointer min-h-[42px]"
              title="Seçilen çoklu gönderileri tek PDF olarak derle"
            >
              <FileText className="w-3.5 h-3.5 shrink-0" />
              <span>Seçilen {selectedCount} Gönderiyi Tek PDF Yap</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={onOpenPdfModal}
              className="col-span-2 sm:col-span-1 px-3.5 py-2.5 sm:py-2 bg-rose-600/90 hover:bg-rose-600 border border-rose-500/50 rounded-xl text-xs font-semibold text-white flex items-center justify-center gap-1.5 transition-all shadow-sm active:scale-95 cursor-pointer min-h-[42px]"
              title="Tüm profili tek dosya PDF olarak derle"
            >
              <FileText className="w-3.5 h-3.5 shrink-0" />
              <span>Tümünü Tek PDF Yap</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
