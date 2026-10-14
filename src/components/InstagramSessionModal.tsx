import React, { useState, useEffect, useMemo } from 'react';
import { Key, ShieldCheck, ShieldAlert, X, HelpCircle, Smartphone, Loader2, CheckCircle2 } from 'lucide-react';
import { verifySessionProfileCheck, isMobileOrApkEnvironment } from '../services/instagramService';

interface InstagramSessionModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentSessionId: string;
  onSaveSessionId: (newSessionId: string) => void;
}

const SUPPORTED_F12_COOKIES = [
  'csrftoken',
  'datr',
  'dpr',
  'ds_user_id',
  'ig_did',
  'mid',
  'ps_l',
  'ps_n',
  'rur',
  'sessionid',
  'wd',
];

function extractDetectedCookieNames(raw: string): string[] {
  const trimmed = (raw || '').trim();
  if (!trimmed) return [];
  const found = new Set<string>();

  for (const line of trimmed.split(/\r?\n/)) {
    const parts = line.trim().split(/\t+/);
    if (parts.length >= 2) {
      const k = parts[0].trim().toLowerCase();
      if (SUPPORTED_F12_COOKIES.includes(k)) {
        found.add(k);
      }
    }
  }

  for (const key of SUPPORTED_F12_COOKIES) {
    const regex = new RegExp(`(?:^|[;\\s,])${key}\\s*=\\s*([^;\\s\\r\\n]+)`, 'i');
    if (regex.test(trimmed)) {
      found.add(key);
    }
  }

  if (found.size === 0 && !trimmed.includes('=') && trimmed.length >= 8) {
    found.add('sessionid');
  }

  return Array.from(found);
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
    statusCode?: number;
    message: string;
    user?: string;
    detectedCookies?: string[];
  } | null>(null);

  const isMobileOrApk = useMemo(() => isMobileOrApkEnvironment(), []);
  const detectedCookieNames = useMemo(() => extractDetectedCookieNames(sessionId), [sessionId]);

  useEffect(() => {
    setSessionId(currentSessionId);
    setTestResult(null);
  }, [currentSessionId, isOpen]);

  // 1-second background profile check when sessionId input changes
  useEffect(() => {
    if (!isOpen) return;
    const cleaned = sessionId.trim().replace(/^cookie:\s*/i, '');
    if (!cleaned) {
      setTestResult(null);
      setIsTesting(false);
      return;
    }

    const timer = setTimeout(async () => {
      setIsTesting(true);
      const res = await verifySessionProfileCheck(cleaned, 'instagram');
      setTestResult({
        valid: res.valid,
        statusCode: res.statusCode,
        message: res.valid ? res.message : 'Oturum bilgisi geçersiz veya süresi dolmuş',
        user: res.user,
        detectedCookies: res.detectedCookies,
      });
      setIsTesting(false);
    }, 1000);

    return () => clearTimeout(timer);
  }, [sessionId, isOpen]);

  if (!isOpen) return null;

  const handleTestSession = async () => {
    const cleaned = sessionId.trim().replace(/^cookie:\s*/i, '');
    if (!cleaned) {
      setTestResult({
        valid: false,
        statusCode: 401,
        message: 'Oturum bilgisi geçersiz veya süresi dolmuş',
      });
      return;
    }

    setIsTesting(true);
    setTestResult(null);

    const res = await verifySessionProfileCheck(cleaned, 'instagram');
    setTestResult({
      valid: res.valid,
      statusCode: res.statusCode,
      message: res.valid ? res.message : 'Oturum bilgisi geçersiz veya süresi dolmuş',
      user: res.user,
      detectedCookies: res.detectedCookies,
    });
    setIsTesting(false);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = sessionId.trim().replace(/^cookie:\s*/i, '');
    if (!cleaned) {
      // Saving empty switches to Cookie-Free Mobile/APK Mode
      onSaveSessionId('');
      onClose();
      return;
    }

    // Always save detected/entered cookies immediately without blocking on remote HTTP 401/429 IP mismatch
    onSaveSessionId(cleaned);
    onClose();
  };

  const handleContinueCookieFree = () => {
    setSessionId('');
    setTestResult(null);
    onSaveSessionId('');
    onClose();
  };

  // Never disable the Save button when cookies are entered or detected
  const isSaveDisabled = false;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg shadow-2xl p-5 sm:p-6 relative max-h-[90vh] overflow-y-auto">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400 shrink-0">
            <Key className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white">
              İsteğe Bağlı Çerez Doğrulayıcı & Mobil/APK Modu
            </h3>
            <p className="text-xs text-slate-400">
              Mobil ve APK kullanıcıları için çerez zorunluluğu yoktur
            </p>
          </div>
        </div>

        {/* Mobile / APK Zero-Cookie Banner */}
        <div className="mb-4 p-3.5 rounded-xl bg-emerald-950/50 border border-emerald-500/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start gap-2.5">
            <Smartphone className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <div className="text-xs text-emerald-100 leading-relaxed">
              <span className="font-bold text-emerald-300 block">
                {isMobileOrApk ? '📱 Mobil / APK Cihaz Algılandı — Çerez Zorunlu Değil!' : '📱 Mobil & APK Çerezsiz Çalışma Modu Aktif'}
              </span>
              <span>
                Mobilden veya APK uygulamasından giriyorsanız Session ID girmenize gerek yoktur. Açık profilleri çerezsiz doğrudan çekebilirsiniz.
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={handleContinueCookieFree}
            className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs rounded-xl transition-colors cursor-pointer shrink-0 whitespace-nowrap shadow-sm"
          >
            Çerezsiz Devam Et
          </button>
        </div>

        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-semibold text-slate-300">
                Tekli <code className="text-rose-400">sessionid</code> veya Tam F12 Çerez Listesi (İsteğe Bağlı):
              </label>
              <button
                type="button"
                onClick={handleTestSession}
                disabled={isTesting || !sessionId.trim()}
                className="text-[11px] font-medium text-sky-400 hover:text-sky-300 flex items-center gap-1 cursor-pointer disabled:opacity-40"
              >
                {isTesting ? (
                  <>
                    <Loader2 className="w-3 h-3 animate-spin" />
                    <span>Doğrulanıyor (1sn)...</span>
                  </>
                ) : (
                  <span>🔍 Şimdi Doğrula</span>
                )}
              </button>
            </div>

            <textarea
              rows={3}
              value={sessionId}
              onChange={(e) => {
                setSessionId(e.target.value);
              }}
              placeholder="Tekli sessionid VEYA F12'deki csrftoken, datr, ds_user_id, ig_did, mid, rur, sessionid çerezlerinin tamamını buraya yapıştırabilirsiniz..."
              className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:border-rose-500 font-mono resize-y"
            />

            {/* Detected F12 Cookie Keys */}
            {detectedCookieNames.length > 0 && (
              <div className="flex items-center gap-1.5 flex-wrap mt-2">
                <span className="text-[10px] text-slate-400">Algılanan çerezler:</span>
                {detectedCookieNames.map((k) => (
                  <span
                    key={k}
                    className="px-2 py-0.5 rounded-md bg-slate-800 border border-slate-700 text-[10px] font-mono text-emerald-300 flex items-center gap-1"
                  >
                    <CheckCircle2 className="w-2.5 h-2.5 text-emerald-400" />
                    {k}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* 1-Second Live Verification Result Alert Box */}
          {testResult && (
            <div
              className={`p-3.5 rounded-xl border text-xs flex items-start gap-2.5 animate-in fade-in ${
                testResult.valid
                  ? 'bg-emerald-950/60 border-emerald-500/50 text-emerald-200'
                  : 'bg-rose-950/60 border-rose-500/50 text-rose-200'
              }`}
            >
              {testResult.valid ? (
                <ShieldCheck className="w-4 h-4 shrink-0 mt-0.5 text-emerald-400" />
              ) : (
                <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
              )}
              <div className="leading-relaxed">
                <span className="font-bold block">
                  {testResult.valid
                    ? `✓ Oturum Doğrulandı (${testResult.user ? `@${testResult.user}` : 'HTTP 200 OK'})`
                    : '✕ Oturum bilgisi geçersiz veya süresi dolmuş'}
                </span>
                <span className="text-[11px] opacity-90">
                  {testResult.valid
                    ? testResult.message
                    : `GET /api/user-profile-check yanıtı: HTTP ${testResult.statusCode || 401}. Lütfen geçerli bir çerez girin veya Çerezsiz Modda devam edin.`}
                </span>
              </div>
            </div>
          )}

          <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-3.5 text-xs text-slate-400 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <span className="font-semibold text-slate-200 flex items-center gap-1.5">
                <HelpCircle className="w-4 h-4 text-sky-400" />
                F12 Çerez Listesi Nasıl Kopyalanır? (Sadece Masaüstü İçin)
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
              <div className="space-y-2.5 pt-1 text-[11px] text-slate-300">
                <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 space-y-1.5">
                  <span className="font-bold text-white flex items-center gap-1.5 text-xs">
                    💻 Bilgisayarda F12 Çerezlerini Yapıştırma:
                  </span>
                  <ol className="list-decimal list-inside space-y-1 text-slate-300">
                    <li>Bilgisayarda <strong>instagram.com</strong>'a giriş yapıp <kbd className="px-1 py-0.5 bg-slate-800 rounded text-slate-200">F12</kbd> tuşuna basın.</li>
                    <li><strong>Application</strong> &rarr; <strong>Cookies</strong> &rarr; <strong>https://www.instagram.com</strong> sekmesini açın.</li>
                    <li>İster sadece <strong>sessionid</strong> değerini, ister tablodaki <code>csrftoken</code>, <code>datr</code>, <code>ds_user_id</code>, <code>ig_did</code>, <code>mid</code>, <code>sessionid</code> satırlarını kopyalayıp yukarıdaki kutuya yapıştırın.</li>
                  </ol>
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center justify-between pt-2 gap-2 flex-wrap">
            {currentSessionId ? (
              <button
                type="button"
                onClick={handleContinueCookieFree}
                className="text-xs text-rose-400 hover:text-rose-300 cursor-pointer font-medium"
              >
                Çerezi Kaldır (Çerezsiz Moda Geç)
              </button>
            ) : (
              <span className="text-[11px] text-emerald-400 font-medium">
                🟢 Şu an Çerezsiz Mobil/APK Modundasınız
              </span>
            )}

            <div className="flex items-center gap-2 ml-auto">
              <button
                type="button"
                onClick={onClose}
                className="px-3.5 py-2 text-xs font-medium text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors cursor-pointer"
              >
                Kapat
              </button>
              <button
                type="submit"
                disabled={isSaveDisabled}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-500 disabled:bg-slate-800 disabled:text-slate-500 disabled:cursor-not-allowed text-white text-xs font-semibold rounded-xl transition-colors cursor-pointer shadow-md"
              >
                {isTesting ? 'Doğrulanıyor...' : 'Kaydet & Uygula'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

