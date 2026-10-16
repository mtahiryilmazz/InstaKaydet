import React, { useState, useEffect } from 'react';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Clock,
  RefreshCw,
  Trash2,
  ShieldAlert,
  Key,
  Info,
  Smartphone,
  ShieldCheck,
} from 'lucide-react';

export interface InstagramLogEntry {
  id: string;
  timestamp: string;
  timeFormatted: string;
  username: string;
  status: number | string;
  success: boolean;
  strategyUsed: string;
  hasSessionId: boolean;
  error?: string;
  diagnosis: string;
  suggestedAction: string;
  latencyMs?: number;
}

interface DiagnosticsData {
  success: boolean;
  logs: InstagramLogEntry[];
  recentFailedLogs?: InstagramLogEntry[];
  stats: {
    totalRequests: number;
    successCount: number;
    rateLimitedCount: number;
    notFoundCount: number;
    activeSessionIdPresent: boolean;
    serverRegion: string;
    gatewayStatus: string;
  };
}

interface ErrorLogViewerProps {
  onOpenSessionModal?: () => void;
  onRefreshFeed?: () => void;
}

export const ErrorLogViewer: React.FC<ErrorLogViewerProps> = ({
  onOpenSessionModal,
}) => {
  const [data, setData] = useState<DiagnosticsData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [filterType, setFilterType] = useState<'all' | 'error' | 'rateLimit' | 'success'>('all');
  const [autoRefresh, setAutoRefresh] = useState(true);

  const fetchLogs = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/instagram/diagnostics');
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch (err) {
      console.warn('Diagnostics fetch error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
    if (!autoRefresh) return;
    const interval = setInterval(fetchLogs, 5000);
    return () => clearInterval(interval);
  }, [autoRefresh]);

  const handleClearLogs = async () => {
    try {
      await fetch('/api/instagram/clear-logs', { method: 'POST' });
      fetchLogs();
    } catch {}
  };

  const logs = data?.logs || [];
  const stats = data?.stats;

  // Last 10 failed HTTP requests (429, 403, 401, 404, etc.)
  const last10FailedRequests = (
    data?.recentFailedLogs ||
    logs.filter((l) => !l.success && String(l.status) !== '200')
  ).slice(0, 10);

  const filteredLogs = logs.filter((log) => {
    const s = String(log.status);
    if (filterType === 'rateLimit') return s === '429';
    if (filterType === 'error') return s !== '200' && !log.success;
    if (filterType === 'success') return log.success || s === '200';
    return true;
  });

  const getStatusBadge = (status: number | string, success: boolean) => {
    const s = String(status);
    if (s === '200' || success) {
      return (
        <span className="px-2 py-0.5 rounded-md text-[11px] font-bold font-mono tabular-nums bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
          <CheckCircle2 className="w-3 h-3" />
          HTTP 200 OK
        </span>
      );
    }
    if (s === '429') {
      return (
        <span className="px-2 py-0.5 rounded-md text-[11px] font-bold font-mono tabular-nums bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-1 animate-pulse">
          <AlertTriangle className="w-3 h-3 text-amber-400" />
          HTTP 429 Hız Sınırı
        </span>
      );
    }
    if (s === '403') {
      return (
        <span className="px-2 py-0.5 rounded-md text-[11px] font-bold font-mono tabular-nums bg-rose-500/20 text-rose-300 border border-rose-500/30 flex items-center gap-1">
          <ShieldAlert className="w-3 h-3 text-rose-400" />
          HTTP 403 Erişim Engeli
        </span>
      );
    }
    if (s === '401') {
      return (
        <span className="px-2 py-0.5 rounded-md text-[11px] font-bold font-mono tabular-nums bg-rose-500/20 text-rose-300 border border-rose-500/30 flex items-center gap-1">
          <ShieldAlert className="w-3 h-3 text-rose-400" />
          HTTP 401 Geçersiz Oturum
        </span>
      );
    }
    if (s === '404') {
      return (
        <span className="px-2 py-0.5 rounded-md text-[11px] font-bold font-mono tabular-nums bg-orange-500/20 text-orange-400 border border-orange-500/30 flex items-center gap-1">
          <Info className="w-3 h-3" />
          HTTP 404 Bulunamadı
        </span>
      );
    }
    return (
      <span className="px-2 py-0.5 rounded-md text-[11px] font-bold font-mono tabular-nums bg-rose-500/20 text-rose-400 border border-rose-500/30 flex items-center gap-1">
        <ShieldAlert className="w-3 h-3" />
        HTTP {s || 'HATA'}
      </span>
    );
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Top Header Card */}
      <div className="bg-slate-900/70 border border-slate-800 rounded-3xl p-5 sm:p-6 backdrop-blur-md shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 shrink-0">
              <Activity className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-bold text-white tracking-tight flex items-center gap-2">
                Instagram İstek & Hata Günlüğü (Live Diagnostics)
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Son 10 başarısız HTTP isteğini (429, 403, 401, 404), deneme saatlerini ve canlı yanıtları izleyin.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => setAutoRefresh(!autoRefresh)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold border flex items-center gap-1.5 transition-colors cursor-pointer ${
                autoRefresh
                  ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-300'
                  : 'bg-slate-800 border-slate-700 text-slate-400'
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${autoRefresh ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'}`} />
              <span>{autoRefresh ? 'Canlı Dinleniyor (5s)' : 'Duraklatıldı'}</span>
            </button>

            <button
              onClick={fetchLogs}
              disabled={isLoading}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-medium flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              title="Günlüğü Yenile"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              <span>Yenile</span>
            </button>

            <button
              onClick={handleClearLogs}
              className="px-3.5 py-1.5 bg-rose-950/50 hover:bg-rose-900/60 text-rose-200 border border-rose-500/40 rounded-xl text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors"
              title="Tüm Logları Temizle"
            >
              <Trash2 className="w-3.5 h-3.5 text-rose-400" />
              <span>Tüm Logları Temizle</span>
            </button>
          </div>
        </div>

        {/* Diagnostic Metric Counters */}
        {stats && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5 pt-4 border-t border-slate-800">
            <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800/80">
              <span className="text-[11px] text-slate-400 block font-medium">Toplam İstek</span>
              <span className="text-xl font-bold text-white font-mono tabular-nums">{stats.totalRequests}</span>
            </div>

            <div className="bg-slate-950/60 p-3 rounded-xl border border-emerald-500/20">
              <span className="text-[11px] text-emerald-400 block font-medium">Başarılı (200 OK)</span>
              <span className="text-xl font-bold text-emerald-300 font-mono tabular-nums">{stats.successCount}</span>
            </div>

            <div className="bg-slate-950/60 p-3 rounded-xl border border-amber-500/20">
              <span className="text-[11px] text-amber-400 block font-medium">Hız Sınırı (429)</span>
              <span className="text-xl font-bold text-amber-300 font-mono tabular-nums">{stats.rateLimitedCount}</span>
            </div>

            <div className="bg-slate-950/60 p-3 rounded-xl border border-sky-500/20">
              <span className="text-[11px] text-sky-400 block font-medium">Çalışma Modu</span>
              <span className="text-xs font-bold text-sky-300 flex items-center gap-1 mt-1 truncate">
                <Smartphone className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span>{stats.activeSessionIdPresent ? 'Çerez + Mobil Mod' : 'Çerezsiz Mobil/APK'}</span>
              </span>
            </div>
          </div>
        )}

        {/* Dedicated Panel: Last 10 Failed HTTP Requests (429, 403, 401, 404) & Attempt Times */}
        <div className="mt-5 pt-4 border-t border-slate-800/90 space-y-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <h3 className="text-xs sm:text-sm font-bold text-rose-300 flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-rose-400" />
              <span>Son 10 Başarısız HTTP İsteği (429, 403, 401, 404 ve Deneme Saatleri)</span>
            </h3>
            <span className="text-[11px] font-mono tabular-nums text-slate-400">
              Gösterilen: {last10FailedRequests.length} / 10
            </span>
          </div>

          {last10FailedRequests.length === 0 ? (
            <div className="p-3.5 rounded-xl bg-emerald-950/20 border border-emerald-500/30 text-xs text-emerald-300 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>Harika! Kaydedilmiş başarısız bir HTTP isteği (429/403/401/404) bulunmuyor.</span>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-950/70">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-800 text-[11px] text-slate-400 bg-slate-900/80">
                    <th className="py-2 px-3 font-semibold">#</th>
                    <th className="py-2 px-3 font-semibold">HTTP Kodu</th>
                    <th className="py-2 px-3 font-semibold">Hedef Hesap</th>
                    <th className="py-2 px-3 font-semibold">Kanal / Strateji</th>
                    <th className="py-2 px-3 font-semibold">Deneme Zamanı</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {last10FailedRequests.map((item, idx) => (
                    <tr key={item.id} className="hover:bg-slate-900/40 transition-colors">
                      <td className="py-2 px-3 font-mono tabular-nums text-slate-500">{idx + 1}</td>
                      <td className="py-2 px-3">{getStatusBadge(item.status, false)}</td>
                      <td className="py-2 px-3 font-semibold text-white">@{item.username}</td>
                      <td className="py-2 px-3 text-slate-300 font-mono text-[11px]">{item.strategyUsed}</td>
                      <td className="py-2 px-3 font-mono tabular-nums text-amber-300 flex items-center gap-1.5">
                        <Clock className="w-3 h-3 text-slate-400" />
                        <span>{item.timeFormatted}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* 429 Bypass & Cookie-Free Advice Card */}
        <div className="mt-4 p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/25 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <div className="text-slate-300 text-[11px] leading-relaxed">
              <span className="font-bold text-amber-300">HTTP 429 Bypass & Mobil/APK Modu:</span> Mobil veya APK üzerinden giren kullanıcılar için çerez zorunluluğu yoktur. Hız sınırı oluştuğunda <span className="text-white font-semibold">30 saniyelik geri sayım sayacı</span> otomatik devreye girer.
            </div>
          </div>

          {onOpenSessionModal && (
            <button
              onClick={onOpenSessionModal}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg font-semibold text-[11px] shrink-0 flex items-center gap-1 cursor-pointer whitespace-nowrap shadow-sm"
            >
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span>Hesap Güvenliği Rehberi</span>
            </button>
          )}
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
        <button
          onClick={() => setFilterType('all')}
          className={`px-3 py-1.5 rounded-xl font-medium transition-colors cursor-pointer whitespace-nowrap ${
            filterType === 'all'
              ? 'bg-rose-600 text-white font-semibold shadow-sm'
              : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
          }`}
        >
          Tüm Kayıtlar ({logs.length})
        </button>

        <button
          onClick={() => setFilterType('rateLimit')}
          className={`px-3 py-1.5 rounded-xl font-medium transition-colors cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
            filterType === 'rateLimit'
              ? 'bg-amber-600 text-white font-semibold shadow-sm'
              : 'bg-slate-900 text-amber-400 hover:text-amber-300 border border-slate-800'
          }`}
        >
          <AlertTriangle className="w-3.5 h-3.5" />
          <span>429 Hız Sınırları ({logs.filter(l => String(l.status) === '429').length})</span>
        </button>

        <button
          onClick={() => setFilterType('error')}
          className={`px-3 py-1.5 rounded-xl font-medium transition-colors cursor-pointer whitespace-nowrap ${
            filterType === 'error'
              ? 'bg-rose-700 text-white font-semibold shadow-sm'
              : 'bg-slate-900 text-rose-400 hover:text-rose-300 border border-slate-800'
          }`}
        >
          Tüm Başarısızlar ({logs.filter(l => !l.success && String(l.status) !== '200').length})
        </button>

        <button
          onClick={() => setFilterType('success')}
          className={`px-3 py-1.5 rounded-xl font-medium transition-colors cursor-pointer whitespace-nowrap ${
            filterType === 'success'
              ? 'bg-emerald-600 text-white font-semibold shadow-sm'
              : 'bg-slate-900 text-emerald-400 hover:text-emerald-300 border border-slate-800'
          }`}
        >
          Başarılılar (200 OK) ({logs.filter(l => l.success || String(l.status) === '200').length})
        </button>
      </div>

      {/* Log Feed List */}
      <div className="space-y-3">
        {filteredLogs.length === 0 ? (
          <div className="bg-slate-900/40 border border-dashed border-slate-800 rounded-2xl p-8 text-center text-slate-400 text-xs">
            Bu kategoride henüz kaydedilmiş bir log bulunmuyor.
          </div>
        ) : (
          filteredLogs.map((log) => {
            const isRateLimit = String(log.status) === '429';
            const isSuccess = log.success || String(log.status) === '200';
            const is404 = String(log.status) === '404';

            return (
              <div
                key={log.id}
                className={`p-4 rounded-2xl border transition-all text-xs space-y-2 ${
                  isRateLimit
                    ? 'bg-amber-950/20 border-amber-500/40'
                    : isSuccess
                    ? 'bg-emerald-950/20 border-emerald-500/30'
                    : is404
                    ? 'bg-orange-950/20 border-orange-500/40'
                    : 'bg-rose-950/20 border-rose-500/40'
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    {getStatusBadge(log.status, log.success)}
                    <span className="font-bold text-white text-sm">
                      @{log.username}
                    </span>
                    <span className="text-[11px] text-slate-400 bg-slate-900 px-2 py-0.5 rounded-md border border-slate-800 font-mono">
                      {log.strategyUsed}
                    </span>
                    {log.hasSessionId ? (
                      <span className="text-[10px] text-emerald-300 bg-emerald-500/10 border border-emerald-500/30 px-1.5 py-0.5 rounded">
                        🔑 Çerezli Sorgu
                      </span>
                    ) : (
                      <span className="text-[10px] text-sky-300 bg-sky-500/10 border border-sky-500/30 px-1.5 py-0.5 rounded">
                        📱 Çerezsiz Mobil/APK
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5 text-slate-400 text-[11px] font-mono tabular-nums">
                    <Clock className="w-3 h-3 text-slate-500" />
                    <span>Deneme: {log.timeFormatted}</span>
                  </div>
                </div>

                {/* Diagnosis and Action */}
                <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800/80 space-y-1">
                  <p className="text-slate-300 font-medium">
                    {log.diagnosis}
                  </p>
                  {log.suggestedAction && (
                    <p className="text-[11px] text-slate-400 flex items-center gap-1">
                      <span className="font-semibold text-rose-300">Öneri:</span>
                      <span>{log.suggestedAction}</span>
                    </p>
                  )}
                  {log.error && (
                    <p className="text-[10px] text-rose-400/80 font-mono pt-0.5">
                      Hata Detayı: {log.error}
                    </p>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

