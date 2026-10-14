import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  X,
  Key,
  ExternalLink,
  CheckCircle2,
  Sparkles,
  RefreshCw,
  LogOut,
  Smartphone,
  Lock,
  Instagram,
  UserCheck
} from 'lucide-react';

interface InstagramOAuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccessLogin?: (username: string) => void;
  onShowToast?: (msg: string) => void;
}

export const InstagramOAuthModal: React.FC<InstagramOAuthModalProps> = ({
  isOpen,
  onClose,
  onSuccessLogin,
  onShowToast,
}) => {
  const [oauthStatus, setOauthStatus] = useState<{
    isConnected: boolean;
    user?: any;
    accessToken?: string;
    connectedAt?: string;
  }>({ isConnected: false });
  const [isLoading, setIsLoading] = useState(false);
  const [customToken, setCustomToken] = useState('');
  const [customUsername, setCustomUsername] = useState('dkabcikpsslianne');

  useEffect(() => {
    if (isOpen) {
      checkOAuthStatus();
    }
  }, [isOpen]);

  const checkOAuthStatus = async () => {
    try {
      const res = await fetch('/api/auth/instagram/status');
      if (res.ok) {
        const data = await res.json();
        setOauthStatus(data);
      }
    } catch (e) {
      console.warn('OAuth status fetch failed:', e);
    }
  };

  if (!isOpen) return null;

  const handleOneClickOAuth = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/auth/instagram/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: customUsername || 'dkabcikpsslianne',
          accessToken: customToken || undefined
        })
      });

      const data = await res.json();
      if (data.success) {
        setOauthStatus(data.session);
        if (onShowToast) {
          onShowToast(`Instagram OAuth başarıyla bağlandı: @${data.session.user?.username}!`);
        }
        if (onSuccessLogin && data.session.user?.username) {
          onSuccessLogin(data.session.user.username);
        }
      } else {
        if (onShowToast) onShowToast(data.error || 'OAuth yetkilendirmesi başarısız');
      }
    } catch (err: any) {
      if (onShowToast) onShowToast('OAuth bağlantı hatası: ' + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDisconnect = async () => {
    setIsLoading(true);
    try {
      await fetch('/api/auth/instagram/disconnect', { method: 'POST' });
      setOauthStatus({ isConnected: false });
      if (onShowToast) {
        onShowToast('Instagram OAuth oturumu kapatıldı.');
      }
    } catch (e) {
      console.warn('Disconnect error:', e);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-rose-500 via-pink-500 to-amber-500 flex items-center justify-center shadow-lg shadow-rose-950/50">
              <Instagram className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold text-white">Instagram ile Giriş Yap (OAuth 2.0)</h3>
                <span className="bg-rose-500/20 text-rose-300 border border-rose-500/30 text-[10px] font-semibold px-2 py-0.5 rounded-full">
                  Meta Graph API
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Oturum duvarı (429) ve çerez gereksinimi olmadan resmi Instagram yetkilendirmesi.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6">
          {/* Active OAuth Status Card */}
          {oauthStatus.isConnected && oauthStatus.user ? (
            <div className="bg-emerald-950/40 border border-emerald-500/40 rounded-2xl p-4 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3.5">
                <img
                  src={oauthStatus.user.avatarUrl}
                  alt={oauthStatus.user.username}
                  className="w-12 h-12 rounded-xl object-cover border-2 border-emerald-500/50"
                  onError={(e) => {
                    (e.target as HTMLElement).style.display = 'none';
                  }}
                />
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-white font-bold text-sm">@{oauthStatus.user.username}</span>
                    <span className="bg-emerald-500/20 text-emerald-400 text-[10px] font-semibold px-2 py-0.5 rounded-md flex items-center gap-1">
                      <UserCheck className="w-3 h-3" /> OAuth Aktif
                    </span>
                  </div>
                  <div className="text-xs text-slate-300 mt-0.5">
                    {oauthStatus.user.fullName} · {oauthStatus.user.postsCount} Gönderi
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5">
                    İzinler: user_profile, user_media (Meta Graph API)
                  </div>
                </div>
              </div>
              <button
                onClick={handleDisconnect}
                disabled={isLoading}
                className="px-3 py-1.5 rounded-lg bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border border-rose-500/30 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Çıkış</span>
              </button>
            </div>
          ) : (
            <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  Neden Instagram OAuth (Giriş Yap)?
                </span>
                <span className="text-[10px] text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full font-medium">
                  Mobil Kullanıcılar İçin İdeal
                </span>
              </div>
              <ul className="text-xs text-slate-300 space-y-2">
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <span><strong>Çerez veya Session ID gerekmez:</strong> Telefondan F12 ile çerez kopyalama zahmetini tamamen bitirir.</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <span><strong>HTTP 429 Hız Sınırına Takılmaz:</strong> Meta doğrudan resmi API tokeni ile tüm gönderilerinizi anında sunar.</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <span><strong>Android Uygulamasında Doğrudan Çalışır:</strong> Android Studio projesinde Custom Tabs ile tek tıkla oturum açılır.</span>
                </li>
              </ul>
            </div>
          )}

          {/* Quick Connect Actions */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-rose-400" />
              Giriş / Yetkilendirme Seçenekleri:
            </h4>

            {/* Option 1: Fast One-Click Connect */}
            <div className="bg-slate-950/80 border border-rose-500/30 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h5 className="text-sm font-bold text-white flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-rose-500/20 text-rose-400 flex items-center justify-center text-xs">1</span>
                    Hızlı Instagram OAuth Girişi
                  </h5>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Hesabınızı doğrudan Meta Graph API protokolü ile bağlayın ve tüm gönderileri çekin.
                  </p>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-2">
                <div className="relative flex-1">
                  <span className="absolute left-3 top-2.5 text-xs text-slate-500 font-mono">@</span>
                  <input
                    type="text"
                    value={customUsername}
                    onChange={(e) => setCustomUsername(e.target.value)}
                    placeholder="kullanici_adi"
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl pl-7 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-rose-500"
                  />
                </div>
                <button
                  onClick={handleOneClickOAuth}
                  disabled={isLoading}
                  className="px-4 py-2 rounded-xl bg-gradient-to-r from-rose-500 to-pink-600 hover:from-rose-400 hover:to-pink-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-rose-950/40 transition-all cursor-pointer disabled:opacity-50"
                >
                  <Instagram className="w-4 h-4" />
                  <span>{isLoading ? 'Bağlanıyor...' : 'Instagram ile Giriş Yap'}</span>
                </button>
              </div>
            </div>

            {/* Option 2: Meta App Developer Token (Optional) */}
            <details className="bg-slate-950/60 border border-slate-800 rounded-xl p-3.5 text-xs group">
              <summary className="font-semibold text-slate-300 cursor-pointer flex items-center justify-between select-none">
                <span className="flex items-center gap-2">
                  <Key className="w-3.5 h-3.5 text-amber-400" />
                  Meta App Token veya Client ID Yapılandırma (Geliştiriciler İçin)
                </span>
                <span className="text-[10px] text-slate-500 group-open:rotate-180 transition-transform">▼</span>
              </summary>
              <div className="pt-3 space-y-2 text-slate-400 border-t border-slate-800/80 mt-2.5">
                <p>
                  Kendi Meta for Developers (developers.facebook.com) uygulamanız varsa, Instagram User Access Token'ınızı buraya yapıştırabilirsiniz:
                </p>
                <input
                  type="password"
                  value={customToken}
                  onChange={(e) => setCustomToken(e.target.value)}
                  placeholder="IGQVJ... (Meta Graph API User Token)"
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white font-mono placeholder-slate-600 focus:outline-none focus:border-amber-500"
                />
              </div>
            </details>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/70 flex items-center justify-between text-xs">
          <span className="text-slate-400 flex items-center gap-1.5">
            <Lock className="w-3.5 h-3.5 text-emerald-400" />
            Meta Resmi Güvenlik Standartları
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-medium transition-colors"
          >
            Kapat
          </button>
        </div>
      </div>
    </div>
  );
};
