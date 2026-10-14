import React, { useState, useEffect } from 'react';
import { Play, Pause, RefreshCw, Clock } from 'lucide-react';

interface LiveTimerControlProps {
  onRefresh: () => void;
  isLoading: boolean;
  username: string;
}

export const LiveTimerControl: React.FC<LiveTimerControlProps> = ({
  onRefresh,
  isLoading,
  username,
}) => {
  const [secondsLeft, setSecondsLeft] = useState<number>(30);
  const [isPaused, setIsPaused] = useState<boolean>(true); // Default paused to satisfy user: "sürekli otomatik canlı çek yapmasın"
  const [lastUpdated, setLastUpdated] = useState<string>('Az önce');

  useEffect(() => {
    if (isPaused || isLoading) return;

    const interval = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          // Trigger refresh when countdown completes
          onRefresh();
          setLastUpdated(new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
          return 30;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isPaused, isLoading, onRefresh]);

  const handleTogglePause = () => {
    setIsPaused((prev) => !prev);
  };

  const handleManualRefresh = () => {
    setSecondsLeft(30);
    setLastUpdated(new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    onRefresh();
  };

  const progressPercent = ((30 - secondsLeft) / 30) * 100;

  return (
    <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-900 border border-slate-800 rounded-xl text-xs select-none">
      {/* Icon & Label */}
      <div className="flex items-center gap-1.5 text-slate-400 shrink-0">
        <Clock className="w-3.5 h-3.5 text-sky-400" />
        <span className="hidden sm:inline font-medium text-slate-300">Canlı Sayaç:</span>
      </div>

      {/* Countdown Display with tabular numbers */}
      <div className="flex items-center gap-1.5 font-mono tabular-nums">
        <span className={`font-semibold ${isPaused ? 'text-amber-400' : 'text-emerald-400'}`}>
          {String(secondsLeft).padStart(2, '0')}s
        </span>
        <span className="text-[11px] text-slate-500 hidden md:inline">
          {isPaused ? '(Durduruldu)' : '(Canlı)'}
        </span>
      </div>

      {/* Mini Progress Bar */}
      <div className="w-12 h-1.5 bg-slate-800 rounded-full overflow-hidden hidden sm:block">
        <div
          className={`h-full transition-all duration-1000 ${
            isPaused ? 'bg-amber-500/60' : 'bg-emerald-500'
          }`}
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      {/* Pause / Play Toggle Button */}
      <button
        onClick={handleTogglePause}
        className={`px-2 py-1 rounded-lg flex items-center gap-1 font-medium transition-colors cursor-pointer ${
          isPaused
            ? 'bg-amber-500/10 text-amber-300 hover:bg-amber-500/20 border border-amber-500/30'
            : 'bg-slate-800 text-slate-300 hover:text-white border border-slate-700/60'
        }`}
        title={isPaused ? 'Otomatik canlı yenilemeyi başlat' : 'Canlı yenilemeyi durdur'}
      >
        {isPaused ? (
          <>
            <Play className="w-3 h-3 text-amber-400 fill-amber-400" />
            <span className="text-[11px]">Başlat</span>
          </>
        ) : (
          <>
            <Pause className="w-3 h-3 text-emerald-400" />
            <span className="text-[11px]">Durdur</span>
          </>
        )}
      </button>

      {/* Manual Instant Fetch Button */}
      <button
        onClick={handleManualRefresh}
        disabled={isLoading}
        className="px-2.5 py-1 bg-sky-600 hover:bg-sky-500 text-white rounded-lg flex items-center gap-1 font-semibold transition-all shadow-sm active:scale-95 cursor-pointer disabled:opacity-50"
        title={`@${username} için canlı veriyi hemen çek`}
      >
        <RefreshCw className={`w-3 h-3 ${isLoading ? 'animate-spin' : ''}`} />
        <span className="text-[11px]">Şimdi Çek</span>
      </button>
    </div>
  );
};
