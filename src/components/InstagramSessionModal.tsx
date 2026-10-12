import React, { useState } from 'react';
import { Key, ShieldCheck, X, HelpCircle, ExternalLink } from 'lucide-react';

interface InstagramSessionModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentSessionId: string;
  onSaveSessionId: (newSessionId: string) => void;
}

export const InstagramSessionModal: React.FC<InstagramSessionModalProps> = ({
  isOpen,
  onClose,
  currentSessionId,
  onSaveSessionId,
}) => {
  const [sessionId, setSessionId] = useState(currentSessionId);
  const [showHelp, setShowHelp] = useState(false);

  if (!isOpen) return null;

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    onSaveSessionId(sessionId.trim());
    onClose();
  };

  const handleClear = () => {
    setSessionId('');
    onSaveSessionId('');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg shadow-2xl p-6 relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400">
            <Key className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white">Instagram Oturum Çerezi (sessionid)</h3>
            <p className="text-xs text-slate-400">Instagram hız sınırını ve 401 kısıtlamalarını aşın</p>
          </div>
        </div>

        <p className="text-xs text-slate-300 leading-relaxed mb-4">
          Instagram, doğrudan sunucu veya bot aramalarına hız sınırı ve oturum zorunluluğu uygulayabilir. Kendi tarayıcınızdaki <strong className="text-rose-400">sessionid</strong> çerezinizi ekleyerek dilediğiniz herkese açık profilin güncel verilerini kesintisiz çekebilirsiniz.
        </p>

        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              sessionid Değeri:
            </label>
            <input
              type="text"
              value={sessionId}
              onChange={(e) => setSessionId(e.target.value)}
              placeholder="Örn: 62947183921%3AmN49z... (Tarayıcı çerezlerinizden)"
              className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:border-rose-500 font-mono"
            />
          </div>

          <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-3 text-[11px] text-slate-400 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-slate-300 flex items-center gap-1">
                <HelpCircle className="w-3.5 h-3.5 text-sky-400" />
                Nasıl Alınır? (1 Dakika)
              </span>
              <button
                type="button"
                onClick={() => setShowHelp(!showHelp)}
                className="text-rose-400 hover:underline cursor-pointer"
              >
                {showHelp ? 'Gizle' : 'Adımları Göster'}
              </button>
            </div>
            {showHelp && (
              <ol className="list-decimal list-inside space-y-1 pt-1.5 text-slate-400">
                <li>Bilgisayar tarayıcınızda <strong>instagram.com</strong>'a giriş yapın.</li>
                <li>Klavyeden <kbd className="px-1 py-0.5 bg-slate-800 rounded text-slate-200">F12</kbd> (Geliştirici Araçları) tuşuna basın.</li>
                <li><strong>Application</strong> (Uygulama) sekmesine gidin &rarr; <strong>Cookies</strong> &rarr; <strong>https://www.instagram.com</strong> seçin.</li>
                <li><strong>sessionid</strong> adındaki çerezin değerini kopyalayıp buraya yapıştırın.</li>
              </ol>
            )}
          </div>

          <div className="flex items-center justify-between pt-2">
            {currentSessionId ? (
              <button
                type="button"
                onClick={handleClear}
                className="text-xs text-rose-400 hover:text-rose-300 cursor-pointer font-medium"
              >
                Çerezi Kaldır
              </button>
            ) : <div />}

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-3.5 py-2 text-xs font-medium text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors cursor-pointer"
              >
                İptal
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold rounded-xl transition-colors cursor-pointer shadow-md"
              >
                Kaydet & Uygula
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
