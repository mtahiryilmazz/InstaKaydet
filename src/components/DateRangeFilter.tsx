import React from 'react';
import { Calendar, X, RotateCcw, Filter } from 'lucide-react';

interface DateRangeFilterProps {
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
  onStartDateChange: (date: string) => void;
  onEndDateChange: (date: string) => void;
  onClear: () => void;
  totalCount: number;
  filteredCount: number;
  label?: string;
}

export const DateRangeFilter: React.FC<DateRangeFilterProps> = ({
  startDate,
  endDate,
  onStartDateChange,
  onEndDateChange,
  onClear,
  totalCount,
  filteredCount,
  label = 'Tarih Aralığı Filtresi',
}) => {
  const isFiltered = Boolean(startDate || endDate);

  // Helper presets
  const applyPresetDays = (days: number) => {
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - days);

    const format = (d: Date) => {
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };

    onStartDateChange(format(start));
    onEndDateChange(format(end));
  };

  const applyThisMonth = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const firstDay = `${year}-${month}-01`;
    const lastDay = new Date(year, now.getMonth() + 1, 0);
    const lastDayFormatted = `${year}-${month}-${String(lastDay.getDate()).padStart(2, '0')}`;

    onStartDateChange(firstDay);
    onEndDateChange(lastDayFormatted);
  };

  return (
    <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-3.5 sm:p-4 mb-5 transition-all">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-rose-500/10 border border-rose-500/20 flex items-center justify-center shrink-0">
            <Filter className="w-3.5 h-3.5 text-rose-400" />
          </div>
          <span className="text-xs font-bold text-white tracking-tight">
            {label}
          </span>
          {isFiltered && (
            <span className="text-[11px] text-rose-400 font-semibold bg-rose-500/10 px-2 py-0.5 rounded-md border border-rose-500/20">
              {filteredCount} / {totalCount} Gösteriliyor
            </span>
          )}
        </div>

        {/* Preset quick buttons */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
          <button
            type="button"
            onClick={() => applyPresetDays(7)}
            className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg text-[11px] font-medium transition-colors cursor-pointer border border-slate-700/50 whitespace-nowrap"
          >
            Son 7 Gün
          </button>
          <button
            type="button"
            onClick={() => applyPresetDays(30)}
            className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg text-[11px] font-medium transition-colors cursor-pointer border border-slate-700/50 whitespace-nowrap"
          >
            Son 30 Gün
          </button>
          <button
            type="button"
            onClick={applyThisMonth}
            className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg text-[11px] font-medium transition-colors cursor-pointer border border-slate-700/50 whitespace-nowrap"
          >
            Bu Ay
          </button>
          {isFiltered && (
            <button
              type="button"
              onClick={onClear}
              className="px-2 py-1 bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 rounded-lg text-[11px] font-medium transition-colors cursor-pointer border border-rose-800/50 flex items-center gap-1 whitespace-nowrap"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Tümünü Göster</span>
            </button>
          )}
        </div>
      </div>

      {/* Date Input Controls */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-2.5 items-center">
        {/* Start Date */}
        <div className="lg:col-span-5 relative">
          <label className="block text-[11px] text-slate-400 mb-1 font-medium">
            Başlangıç Tarihi
          </label>
          <div className="relative">
            <input
              type="date"
              value={startDate}
              onChange={(e) => onStartDateChange(e.target.value)}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-700/80 rounded-xl text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-rose-500 focus:ring-1 focus:ring-rose-500 transition-colors [color-scheme:dark]"
            />
          </div>
        </div>

        {/* End Date */}
        <div className="lg:col-span-5 relative">
          <label className="block text-[11px] text-slate-400 mb-1 font-medium">
            Bitiş Tarihi
          </label>
          <div className="relative">
            <input
              type="date"
              value={endDate}
              onChange={(e) => onEndDateChange(e.target.value)}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-700/80 rounded-xl text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-rose-500 focus:ring-1 focus:ring-rose-500 transition-colors [color-scheme:dark]"
            />
          </div>
        </div>

        {/* Clear Action Button */}
        <div className="lg:col-span-2 flex items-end h-full pt-4 sm:pt-0">
          <button
            type="button"
            onClick={onClear}
            disabled={!isFiltered}
            className="w-full py-2 px-3 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white disabled:opacity-40 rounded-xl text-xs font-medium transition-colors flex items-center justify-center gap-1.5 cursor-pointer border border-slate-700/50 min-h-[38px]"
            title="Tarih filtresini kaldır, tüm gönderileri göster"
          >
            <RotateCcw className="w-3.5 h-3.5 text-slate-400" />
            <span>Sıfırla</span>
          </button>
        </div>
      </div>
    </div>
  );
};
