import React, { useEffect } from 'react';
import {
  ShieldCheck,
  AlertTriangle,
  Smartphone,
  Link as LinkIcon,
  Puzzle,
  Key,
  X,
  CheckCircle2,
  Lock,
  ArrowRight,
} from 'lucide-react';

interface AccountSafetyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenExtensionModal?: () => void;
  onFocusLinkInput?: () => void;
}

export const AccountSafetyModal: React.FC<AccountSafetyModalProps> = ({
  isOpen,
  onClose,
  onOpenExtensionModal,
  onFocusLinkInput,
}) => {
  // Safeguard: Automatically purge any hazardous session cookies stored in client storage
  useEffect(() => {
    try {
      if (localStorage.getItem('instaflow_session_id')) {
        localStorage.removeItem('instaflow_session_id');
      }
    } catch {}
  }, []);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-xl w-full p-5 sm:p-6 shadow-2xl space-y-5 text-slate-100 max-h-[92vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold text-white tracking-tight flex items-center gap-2">
                Instagram Hesap Güvenliği Rehberi
              </h3>
              <p className="text-xs text-slate-400">
                Session ID kaldırıldı · Hesabınız %100 güvende
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Why Instagram flags accounts - Transparent Explanation */}
        <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/25 space-y-2 text-xs">
          <div className="flex items-center gap-2 font-bold text-amber-300">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
            <span>Neden Session ID Hesabınızı Risk Altına Sokar?</span>
          </div>
          <p className="text-slate-300 leading-relaxed text-[11px]">
            Kendi ev bilgisayarınızdan veya telefonunuzdan giriş yaptığınız Instagram çerezini (sessionid) bulut sunucularına aktardığınızda, Instagram güvenlik sistemleri bu oturumun aniden yabancı bir veri merkezi IP'sinden kullanıldığını tespit eder. Instagram bunu <strong className="text-amber-200">oturum çalınması veya şüpheli giriş</strong> olarak algılayıp hesabınızı kilitler veya uyarı verir.
          </p>
          <div className="flex items-center gap-1.5 text-[11px] font-semibold text-emerald-300 pt-1">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span>Bu uygulamada Session ID zorunluluğu tamamen kaldırılmıştır; hesabınız %100 korunmaktadır.</span>
          </div>
        </div>

        {/* 4 Safe Alternative Methods */}
        <div className="space-y-3">
          <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
            <Lock className="w-3.5 h-3.5 text-emerald-400" />
            <span>Hesabınızı Tehlikeye Atmayan 4 Güvenli Alternatif:</span>
          </h4>

          {/* Alternative 1: Cookie-Free Mobile & APK Mode */}
          <div className="p-3.5 rounded-2xl bg-slate-950/80 border border-emerald-500/30 space-y-1.5 hover:border-emerald-500/50 transition-colors">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Smartphone className="w-4 h-4 text-emerald-400 shrink-0" />
                <span className="text-xs font-bold text-white">1. Çerezsiz Mobil & APK Modu (Varsayılan)</span>
              </div>
              <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-full font-bold">
                Aktif & %100 Güvenli
              </span>
            </div>
            <p className="text-[11px] text-slate-400 leading-normal">
              Hiçbir Instagram oturumu açmadan veya çerez paylaşmadan, Instagram'ın herkese açık açık uç noktaları (Embed ve Web API) üzerinden profilleri ve gönderileri çeker. Hesabınızla hiçbir bağlantı kurulmadığı için hesabınızın etkilenme riski sıfırdır.
            </p>
          </div>

          {/* Alternative 2: Direct Post/Reels Link Input */}
          <div className="p-3.5 rounded-2xl bg-slate-950/80 border border-sky-500/30 space-y-2 hover:border-sky-500/50 transition-colors">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <LinkIcon className="w-4 h-4 text-sky-400 shrink-0" />
                <span className="text-xs font-bold text-white">2. Gönderi / Reels Bağlantısı ile İndirme</span>
              </div>
              <span className="text-[10px] bg-sky-500/20 text-sky-300 px-2 py-0.5 rounded-full font-bold">
                Hızlı
              </span>
            </div>
            <p className="text-[11px] text-slate-400 leading-normal">
              Instagram uygulamasında beğendiğiniz herhangi bir gönderinin veya reel videosunun linkini kopyalayıp ana sayfadaki bağlantı kutusuna yapıştırarak anında tekil, karusel veya video olarak indirin.
            </p>
            {onFocusLinkInput && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onFocusLinkInput();
                }}
                className="px-3 py-1.5 bg-sky-600/30 hover:bg-sky-600/50 text-sky-200 border border-sky-500/40 rounded-xl text-[11px] font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <span>Bağlantı Giriş Alanına Git</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            )}
          </div>

          {/* Alternative 3: Chrome Extension / Local JSON Import */}
          <div className="p-3.5 rounded-2xl bg-slate-950/80 border border-purple-500/30 space-y-2 hover:border-purple-500/50 transition-colors">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Puzzle className="w-4 h-4 text-purple-400 shrink-0" />
                <span className="text-xs font-bold text-white">3. Chrome Eklentisi / Yerel JSON Aktarımı</span>
              </div>
              <span className="text-[10px] bg-purple-500/20 text-purple-300 px-2 py-0.5 rounded-full font-bold">
                Tüm Arşiv
              </span>
            </div>
            <p className="text-[11px] text-slate-400 leading-normal">
              Kendi bilgisayarınızın tarayıcısından (kendi ev IP'nizden) Instagram sayfasına girdiğinizde istekler yerel olarak yapılır. Çektiğiniz gönderi JSON dosyasını buraya aktardığınızda tüm albümleri tek seferde A4 PDF veya ZIP yapabilirsiniz.
            </p>
            {onOpenExtensionModal && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenExtensionModal();
                }}
                className="px-3 py-1.5 bg-purple-600/30 hover:bg-purple-600/50 text-purple-200 border border-purple-500/40 rounded-xl text-[11px] font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <span>Chrome Eklentisini & JSON Yükleyiciyi Aç</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            )}
          </div>

          {/* Alternative 4: Official Meta Instagram OAuth 2.0 */}
          <div className="p-3.5 rounded-2xl bg-slate-950/80 border border-indigo-500/30 space-y-1.5 hover:border-indigo-500/50 transition-colors">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Key className="w-4 h-4 text-indigo-400 shrink-0" />
                <span className="text-xs font-bold text-white">4. Resmi Meta Instagram OAuth 2.0</span>
              </div>
              <span className="text-[10px] bg-indigo-500/20 text-indigo-300 px-2 py-0.5 rounded-full font-bold">
                Resmi API
              </span>
            </div>
            <p className="text-[11px] text-slate-400 leading-normal">
              Meta Developer Portal üzerinden Client ID ve Client Secret yapılandırılarak resmi Graph API yetkilendirmesiyle güvenli kurumsal bağlantı sağlanır.
            </p>
          </div>
        </div>

        {/* Action Button */}
        <div className="pt-2">
          <button
            onClick={onClose}
            className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-white font-semibold text-xs rounded-xl border border-slate-700/80 transition-all cursor-pointer flex items-center justify-center gap-1.5"
          >
            <span>Anladım, Çerezsiz ve Güvenli Modda Devam Et</span>
          </button>
        </div>
      </div>
    </div>
  );
};
