import React from 'react';
import { UserCheck, Download, FileText, Cloud } from 'lucide-react';

interface BottomTabBarProps {
  activeTab: 'profile' | 'quick' | 'pdf' | 'cloud';
  setActiveTab: (tab: 'profile' | 'quick' | 'pdf' | 'cloud') => void;
  historyCount: number;
}

export const BottomTabBar: React.FC<BottomTabBarProps> = ({
  activeTab,
  setActiveTab,
  historyCount,
}) => {
  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-slate-950/95 backdrop-blur-md border-t border-slate-800/80 pb-[env(safe-area-inset-bottom,0px)]">
      <div className="grid grid-cols-4 items-center h-16 max-w-md mx-auto">
        {/* Tab 1: Profile & Dates */}
        <button
          onClick={() => setActiveTab('profile')}
          className={`min-h-[44px] flex flex-col items-center justify-center transition-colors cursor-pointer ${
            activeTab === 'profile' ? 'text-rose-400' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <UserCheck className="w-5 h-5" />
          <span className="text-[11px] font-medium tracking-tight mt-1">Kullanıcı</span>
        </button>

        {/* Tab 2: Quick Download */}
        <button
          onClick={() => setActiveTab('quick')}
          className={`min-h-[44px] flex flex-col items-center justify-center transition-colors cursor-pointer ${
            activeTab === 'quick' ? 'text-rose-400' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Download className="w-5 h-5" />
          <span className="text-[11px] font-medium tracking-tight mt-1">Hızlı İndir</span>
        </button>

        {/* Tab 3: PDF Compilation */}
        <button
          onClick={() => setActiveTab('pdf')}
          className={`min-h-[44px] flex flex-col items-center justify-center transition-colors cursor-pointer ${
            activeTab === 'pdf' ? 'text-rose-400' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <FileText className="w-5 h-5" />
          <span className="text-[11px] font-medium tracking-tight mt-1">Tek PDF</span>
        </button>

        {/* Tab 4: Cloud & History */}
        <button
          onClick={() => setActiveTab('cloud')}
          className={`min-h-[44px] flex flex-col items-center justify-center relative transition-colors cursor-pointer ${
            activeTab === 'cloud' ? 'text-rose-400' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <div className="relative">
            <Cloud className="w-5 h-5" />
            {historyCount > 0 && (
              <span className="absolute -top-1 -right-2 bg-rose-600 text-white text-[9px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                {historyCount > 9 ? '9+' : historyCount}
              </span>
            )}
          </div>
          <span className="text-[11px] font-medium tracking-tight mt-1">Bulut</span>
        </button>
      </div>
    </nav>
  );
};
