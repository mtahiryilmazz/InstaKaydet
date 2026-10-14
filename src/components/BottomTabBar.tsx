import React from 'react';
import { UserCheck, Download, FileText, Cloud, Activity } from 'lucide-react';

interface BottomTabBarProps {
  activeTab: 'profile' | 'quick' | 'pdf' | 'logs' | 'cloud';
  setActiveTab: (tab: 'profile' | 'quick' | 'pdf' | 'logs' | 'cloud') => void;
  historyCount: number;
}

export const BottomTabBar: React.FC<BottomTabBarProps> = ({
  activeTab,
  setActiveTab,
  historyCount,
}) => {
  const tabs: Array<{
    id: 'profile' | 'quick' | 'pdf' | 'cloud' | 'logs';
    label: string;
    icon: React.FC<{ className?: string }>;
    badge?: number;
  }> = [
    { id: 'profile', label: 'Arşiv', icon: UserCheck },
    { id: 'quick', label: 'Hızlı İndir', icon: Download },
    { id: 'pdf', label: 'PDF Yap', icon: FileText },
    { id: 'cloud', label: 'Yedekler', icon: Cloud, badge: historyCount },
    { id: 'logs', label: 'Loglar', icon: Activity },
  ];

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-slate-950/95 backdrop-blur-xl border-t border-slate-800/90 pb-[env(safe-area-inset-bottom,0px)]">
      <div className="grid grid-cols-5 items-center h-16 max-w-lg mx-auto px-1.5">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`min-h-[48px] flex flex-col items-center justify-center rounded-xl transition-all cursor-pointer relative ${
                isActive
                  ? 'text-rose-400 font-semibold'
                  : 'text-slate-400 hover:text-slate-200 font-medium'
              }`}
            >
              <div
                className={`px-3 py-1 rounded-full transition-colors relative ${
                  isActive ? 'bg-rose-500/15' : ''
                }`}
              >
                <Icon className="w-4 h-4" />
                {typeof tab.badge === 'number' && tab.badge > 0 && (
                  <span className="absolute -top-1 -right-1 bg-rose-600 text-white text-[9px] font-bold rounded-full w-3.5 h-3.5 flex items-center justify-center">
                    {tab.badge > 9 ? '9+' : tab.badge}
                  </span>
                )}
              </div>
              <span className="text-[10px] tracking-tight mt-0.5">{tab.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
