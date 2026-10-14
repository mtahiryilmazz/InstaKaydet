import React, { useState, useEffect } from 'react';
import { X, Calendar, Clock, Download, CheckCircle, AlertCircle, Play, Trash2, ShieldCheck, FileSpreadsheet } from 'lucide-react';
import { ScheduledDownloadJob, InstagramPost } from '../types';

interface ScheduledDownloadModalProps {
  isOpen: boolean;
  onClose: () => void;
  jobs: ScheduledDownloadJob[];
  posts: InstagramPost[];
  username: string;
  onAddJob: (job: Omit<ScheduledDownloadJob, 'id' | 'createdAt' | 'status' | 'progress'>) => void;
  onCancelJob: (jobId: string) => void;
  onRunNow: (jobId: string) => void;
  onDeleteJob: (jobId: string) => void;
  isProcessing: boolean;
}

export const ScheduledDownloadModal: React.FC<ScheduledDownloadModalProps> = ({
  isOpen,
  onClose,
  jobs,
  posts,
  username,
  onAddJob,
  onCancelJob,
  onRunNow,
  onDeleteJob,
  isProcessing,
}) => {
  const [activeTab, setActiveTab] = useState<'create' | 'queue'>('create');
  const [scheduleMode, setScheduleMode] = useState<'preset' | 'custom'>('preset');
  const [presetMinutes, setPresetMinutes] = useState<number>(60);
  const [customDateTime, setCustomDateTime] = useState<string>(() => {
    const d = new Date();
    d.setHours(d.getHours() + 2);
    return d.toISOString().slice(0, 16);
  });

  const [includeCsv, setIncludeCsv] = useState<boolean>(true);
  const [folderByDate, setFolderByDate] = useState<boolean>(true);
  const [isDataSaver, setIsDataSaver] = useState<boolean>(false);
  const [enhanceResolution, setEnhanceResolution] = useState<boolean>(true);

  // Time remaining calculator helper
  const [now, setNow] = useState<number>(Date.now());
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  if (!isOpen) return null;

  const handleCreateSchedule = () => {
    let targetDate: Date;
    let label = '';

    if (scheduleMode === 'preset') {
      targetDate = new Date(Date.now() + presetMinutes * 60 * 1000);
      if (presetMinutes === 0) {
        label = 'Hemen Başlatılacak';
      } else if (presetMinutes === 30) {
        label = '30 Dakika Sonra';
      } else if (presetMinutes === 60) {
        label = '1 Saat Sonra';
      } else if (presetMinutes === 120) {
        label = '2 Saat Sonra';
      } else if (presetMinutes === 360) {
        label = 'Bu Gece (6 Saat Sonra)';
      } else {
        label = `${presetMinutes} dk sonra`;
      }
    } else {
      targetDate = new Date(customDateTime);
      label = targetDate.toLocaleString('tr-TR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
    }

    onAddJob({
      scheduledTime: targetDate.toISOString(),
      scheduledDisplay: label,
      username,
      totalPosts: posts.length,
      postIds: posts.map((p) => p.id),
      options: {
        includeCsv,
        folderByDate,
        isDataSaver,
        enhanceResolution,
      },
    });

    setActiveTab('queue');
  };

  const formatRemaining = (scheduledIso: string) => {
    const diffMs = new Date(scheduledIso).getTime() - now;
    if (diffMs <= 0) return 'Zamanı geldi (Başlatılıyor...)';

    const totalSecs = Math.floor(diffMs / 1000);
    const hours = Math.floor(totalSecs / 3600);
    const mins = Math.floor((totalSecs % 3600) / 60);
    const secs = totalSecs % 60;

    if (hours > 0) {
      return `${hours} sa ${mins} dk ${secs} sn kaldı`;
    }
    return `${mins} dk ${secs} sn kaldı`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-2xl w-full shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="px-6 py-5 border-b border-slate-800 flex items-center justify-between bg-slate-900/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400 flex items-center justify-center">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
                <span>Zamanlanmış İndirme Kuyruğu</span>
                <span className="text-xs font-normal text-purple-400 font-mono">
                  (@{username} · {posts.length} Gönderi)
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                400+ gönderilik büyük arşivleri gece veya belirlenen saatte otomatik indirin
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-2 rounded-xl hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Selector */}
        <div className="px-6 pt-4 border-b border-slate-800 flex gap-4 text-xs font-semibold">
          <button
            onClick={() => setActiveTab('create')}
            className={`pb-3 transition-colors cursor-pointer border-b-2 flex items-center gap-1.5 ${
              activeTab === 'create'
                ? 'border-purple-500 text-purple-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Calendar className="w-4 h-4" />
            <span>Yeni Zamanlama Oluştur</span>
          </button>
          <button
            onClick={() => setActiveTab('queue')}
            className={`pb-3 transition-colors cursor-pointer border-b-2 flex items-center gap-1.5 ${
              activeTab === 'queue'
                ? 'border-purple-500 text-purple-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Clock className="w-4 h-4" />
            <span>Bekleyen Kuyruk ({jobs.length})</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1">
          {activeTab === 'create' ? (
            <>
              {/* Scope Card */}
              <div className="p-4 bg-slate-950/60 border border-slate-800 rounded-2xl flex items-center justify-between">
                <div>
                  <div className="text-xs font-semibold text-white">İndirilecek İçerik Kapsamı:</div>
                  <div className="text-xs text-slate-400 mt-0.5">
                    Mevcut listedeki <span className="text-white font-bold">{posts.length} gönderi</span> (~{(posts.length * 1.8).toFixed(0)} medya dosyası)
                  </div>
                </div>
                <div className="text-xs font-mono text-purple-400 px-3 py-1 bg-purple-950/40 border border-purple-800/40 rounded-xl">
                  Tam Paket
                </div>
              </div>

              {/* Timing Options */}
              <div className="space-y-3">
                <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                  <Clock className="w-4 h-4 text-sky-400" />
                  <span>Ne Zaman İndirilsin?</span>
                </label>

                {/* Preset Timing Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    { label: 'Hemen (Kuyruğa Al)', val: 0 },
                    { label: '30 Dakika Sonra', val: 30 },
                    { label: '1 Saat Sonra', val: 60 },
                    { label: 'Bu Gece (02:00)', val: 360 },
                  ].map((p) => (
                    <button
                      key={p.val}
                      onClick={() => {
                        setPresetMinutes(p.val);
                        setScheduleMode('preset');
                      }}
                      className={`p-3 rounded-xl border text-xs font-medium transition-all cursor-pointer text-center ${
                        scheduleMode === 'preset' && presetMinutes === p.val
                          ? 'bg-purple-900/40 border-purple-500 text-purple-200 shadow-md shadow-purple-950'
                          : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white hover:border-slate-700'
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>

                {/* Custom Time Option */}
                <div className="pt-2">
                  <label className="flex items-center gap-2 cursor-pointer mb-2">
                    <input
                      type="radio"
                      name="scheduleMode"
                      checked={scheduleMode === 'custom'}
                      onChange={() => setScheduleMode('custom')}
                      className="text-purple-600 focus:ring-purple-500"
                    />
                    <span className="text-xs font-medium text-slate-300">Özel Tarih ve Saat Belirle</span>
                  </label>

                  {scheduleMode === 'custom' && (
                    <input
                      type="datetime-local"
                      value={customDateTime}
                      onChange={(e) => setCustomDateTime(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-purple-500"
                    />
                  )}
                </div>
              </div>

              {/* Archive Options */}
              <div className="p-4 bg-slate-950/60 border border-slate-800 rounded-2xl space-y-3">
                <div className="text-xs font-bold text-slate-300">Paketleme Tercihleri:</div>

                <label className="flex items-center justify-between cursor-pointer">
                  <span className="text-xs text-slate-300 flex items-center gap-2">
                    <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
                    <span>Excel / CSV Gönderi Tablosu Dahil Et</span>
                  </span>
                  <input
                    type="checkbox"
                    checked={includeCsv}
                    onChange={(e) => setIncludeCsv(e.target.checked)}
                    className="w-4 h-4 rounded text-purple-600 focus:ring-purple-500"
                  />
                </label>

                <label className="flex items-center justify-between cursor-pointer">
                  <span className="text-xs text-slate-300 flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-sky-400" />
                    <span>Gönderileri Tarihe Göre Klasörle</span>
                  </span>
                  <input
                    type="checkbox"
                    checked={folderByDate}
                    onChange={(e) => setFolderByDate(e.target.checked)}
                    className="w-4 h-4 rounded text-purple-600 focus:ring-purple-500"
                  />
                </label>

                <label className="flex items-center justify-between cursor-pointer">
                  <span className="text-xs text-slate-300 flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-amber-400" />
                    <span>1080p HD Yüksek Kaliteyi Koru</span>
                  </span>
                  <input
                    type="checkbox"
                    checked={enhanceResolution}
                    onChange={(e) => setEnhanceResolution(e.target.checked)}
                    className="w-4 h-4 rounded text-purple-600 focus:ring-purple-500"
                  />
                </label>
              </div>

              {/* Submit Button */}
              <button
                onClick={handleCreateSchedule}
                disabled={posts.length === 0}
                className="w-full py-3.5 bg-gradient-to-r from-purple-600 via-indigo-600 to-rose-600 hover:from-purple-500 hover:to-rose-500 text-white font-bold text-xs sm:text-sm rounded-xl shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <Calendar className="w-4 h-4" />
                <span>Zamanlanmış İndirmeyi Kuyruğa Ekle</span>
              </button>
            </>
          ) : (
            /* Queue List Tab */
            <div className="space-y-3">
              {jobs.length === 0 ? (
                <div className="text-center py-12 text-slate-500 text-xs">
                  <Clock className="w-8 h-8 mx-auto mb-2 opacity-40" />
                  <span>Kuyrukta bekleyen zamanlanmış indirme görevi yok.</span>
                </div>
              ) : (
                jobs.map((job) => (
                  <div
                    key={job.id}
                    className="p-4 bg-slate-950/70 border border-slate-800 rounded-2xl space-y-2 hover:border-slate-700 transition-colors"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        {job.status === 'completed' ? (
                          <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
                        ) : job.status === 'running' ? (
                          <div className="w-4 h-4 border-2 border-purple-500 border-t-transparent rounded-full animate-spin shrink-0" />
                        ) : (
                          <Clock className="w-4 h-4 text-amber-400 shrink-0" />
                        )}
                        <span className="text-xs font-semibold text-white truncate">
                          @{job.username} · {job.totalPosts} Gönderi
                        </span>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {job.status === 'pending' && (
                          <button
                            onClick={() => onRunNow(job.id)}
                            disabled={isProcessing}
                            className="px-2.5 py-1 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-[11px] font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                          >
                            <Play className="w-3 h-3" />
                            <span>Şimdi İndir</span>
                          </button>
                        )}
                        <button
                          onClick={() => onDeleteJob(job.id)}
                          className="p-1 text-slate-400 hover:text-rose-400 transition-colors cursor-pointer"
                          title="Görevi Sil"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Progress Bar (if running) */}
                    {job.status === 'running' && (
                      <div className="space-y-1">
                        <div className="flex justify-between text-[10px] text-slate-400">
                          <span>{job.statusMessage || 'İndiriliyor ve paketleniyor...'}</span>
                          <span className="font-mono">{job.progress}%</span>
                        </div>
                        <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-purple-500 transition-all duration-300"
                            style={{ width: `${job.progress}%` }}
                          />
                        </div>
                      </div>
                    )}

                    {/* Meta info & Countdown */}
                    <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1 border-t border-slate-900 font-mono">
                      <span>Zaman: {job.scheduledDisplay}</span>
                      {job.status === 'pending' && (
                        <span className="text-amber-400 font-semibold">
                          {formatRemaining(job.scheduledTime)}
                        </span>
                      )}
                      {job.status === 'completed' && (
                        <span className="text-emerald-400 font-semibold">✓ Tamamlandı</span>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
