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
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    valid: boolean;
    message: string;
    user?: string;
  } | null>(null);

  React.useEffect(() => {
    setSessionId(currentSessionId);
    setTestResult(null);
  }, [currentSessionId, isOpen]);

  if (!isOpen) return null;

  const handleTestSession = async () => {
    const cleaned = sessionId.trim().replace(/^cookie:\s*/i, '');
    if (!cleaned) {
      setTestResult({
        valid: false,
        message: 'Lütfen test etmek için önce bir sessionid değeri girin.',
      });
      return;
    }

    setIsTesting(true);
    setTestResult(null);

    try {
      const res = await fetch('/api/instagram/test-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: cleaned }),
      });
      const data = await res.json();
      setTestResult({
        valid: !!data.valid,
        message: data.message || (data.valid ? 'Oturum aktif.' : 'Oturum geçersiz.'),
        user: data.user,
      });
    } catch (err: any) {
      setTestResult({
        valid: false,
        message: 'Sunucuyla bağlantı hatası oluştu: ' + err.message,
      });
    } finally {
      setIsTesting(false);
    }
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    let cleaned = sessionId.trim().replace(/^cookie:\s*/i, '');
    onSaveSessionId(cleaned);
    onClose();
  };

  const handleClear = () => {
    setSessionId('');
    setTestResult(null);
    onSaveSessionId('');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg shadow-2xl p-6 relative max-h-[90vh] overflow-y-auto">
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
          Instagram, doğrudan sunucu sorgularına hız sınırı ve oturum zorunluluğu uygulayabilir. Kendi tarayıcınızdaki <strong className="text-rose-400">sessionid</strong> çerezinizi ekleyerek dilediğiniz herkese açık profilin güncel verilerini kesintisiz çekebilirsiniz.
        </p>

        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-semibold text-slate-300">
                sessionid Değeri:
              </label>
              <button
                type="button"
                onClick={handleTestSession}
                disabled={isTesting || !sessionId.trim()}
                className="text-[11px] font-medium text-sky-400 hover:text-sky-300 flex items-center gap-1 cursor-pointer disabled:opacity-40"
              >
                {isTesting ? (
                  <span>Test Ediliyor...</span>
                ) : (
                  <span>🔍 Oturumu Test Et</span>
                )}
              </button>
            </div>
            <input
              type="text"
              value={sessionId}
              onChange={(e) => {
                setSessionId(e.target.value);
                if (testResult) setTestResult(null);
              }}
              placeholder="Örn: 62947183921%3AmN49z... (Tarayıcı çerezlerinizden)"
              className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:border-rose-500 font-mono"
            />
          </div>

          {/* Test Result Alert Box */}
          {testResult && (
            <div
              className={`p-3 rounded-xl border text-xs flex items-start gap-2.5 animate-in fade-in ${
                testResult.valid
                  ? 'bg-emerald-950/60 border-emerald-500/50 text-emerald-200'
                  : 'bg-rose-950/60 border-rose-500/50 text-rose-200'
              }`}
            >
              <ShieldCheck className={`w-4 h-4 shrink-0 mt-0.5 ${testResult.valid ? 'text-emerald-400' : 'text-rose-400'}`} />
              <div className="leading-relaxed">
                <span className="font-bold block">
                  {testResult.valid ? '✓ Oturum Doğrulandı!' : '✕ Oturum Doğrulanamadı'}
                </span>
                <span>{testResult.message}</span>
              </div>
            </div>
          )}

          <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-3.5 text-xs text-slate-400 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <span className="font-semibold text-slate-200 flex items-center gap-1.5">
                <HelpCircle className="w-4 h-4 text-sky-400" />
                Nasıl Alınır? (Bilgisayar & Mobil Rehberi)
              </span>
              <button
                type="button"
                onClick={() => setShowHelp(!showHelp)}
                className="text-rose-400 hover:text-rose-300 font-medium text-[11px] cursor-pointer"
              >
                {showHelp ? 'Kılavuzu Kapat' : 'Rehberi Aç'}
              </button>
            </div>

            {showHelp && (
              <div className="space-y-3 pt-1 text-[11px] text-slate-300">
                {/* Mobile Specific Guide */}
                <div className="p-2.5 rounded-lg bg-sky-950/40 border border-sky-800/40 space-y-2">
                  <span className="font-bold text-sky-300 flex items-center gap-1.5 text-xs">
                    📱 Mobilden Girenler İçin En Kolay Yöntem:
                  </span>
                  <p className="text-slate-300 leading-relaxed">
                    Mobilde Safari veya Chrome'da <kbd className="px-1 py-0.5 bg-slate-800 rounded">F12</kbd> geliştirici konsolu doğrudan bulunmaz. Mobilde kullanmanın <strong>en pratik 2 yolu</strong>:
                  </p>
                  <ul className="list-disc list-inside space-y-1.5 pl-1 text-slate-300">
                    <li>
                      <strong>1. WhatsApp / Notlar ile Kendine Gönder (1 Kez):</strong> Bilgisayarınızdan aldığınız sessionid değerini WhatsApp veya kendinize e-posta ile atın. Mobilde bu kutuya bir defa yapıştırıp "Kaydet"e basın. Telefondaki tarayıcı hafızasına kalıcı kaydedilir ve bir daha sormaz!
                    </li>
                    <li>
                      <strong>2. Bulut Yedekleme ile Çapraz Kullanım:</strong> Bilgisayarda profili tarayıp <em>"Buluta Yedekle"</em> butonuna basın. Mobilde siteyi açıp <em>"Buluttan Yükle"</em> dediğinizde 522 gönderinin tamamı anında telefonunuza yüklenir!
                    </li>
                  </ul>
                </div>

                {/* PC Guide */}
                <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 space-y-1.5">
                  <span className="font-bold text-white flex items-center gap-1.5 text-xs">
                    💻 Bilgisayardan Alma Adımları (30 Saniye):
                  </span>
                  <ol className="list-decimal list-inside space-y-1 text-slate-300">
                    <li>Bilgisayarda <strong>instagram.com</strong>'a giriş yapın.</li>
                    <li>Klavyeden <kbd className="px-1 py-0.5 bg-slate-800 rounded text-slate-200">F12</kbd> tuşuna basın.</li>
                    <li><strong>Application</strong> (Uygulama) &rarr; <strong>Cookies</strong> &rarr; <strong>instagram.com</strong> yolunu izleyin.</li>
                    <li><strong>sessionid</strong> satırındaki değeri çift tıklayıp kopyalayın.</li>
                  </ol>
                </div>
              </div>
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
