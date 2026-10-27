import React from 'react';
import { Calendar, Clock, Zap, Folder, Wallet, TrendingUp, Plus, Repeat } from 'lucide-react';
import { ActiveTab } from '../types';

interface BottomNavProps {
  activeTab: ActiveTab;
  onChangeTab: (tab: ActiveTab) => void;
  onOpenQuickAdd: () => void;
}

export const BottomNav: React.FC<BottomNavProps> = ({
  activeTab,
  onChangeTab,
  onOpenQuickAdd,
}) => {
  const tabs = [
    { id: 'today', label: 'Today', icon: Calendar },
    { id: 'timeline', label: 'Time', icon: Clock },
    { id: 'focus', label: 'Focus', icon: Zap },
    { id: 'habits', label: 'Habits', icon: Repeat },
    { id: 'categories', label: 'Lists', icon: Folder },
    { id: 'finance', label: 'Money', icon: Wallet },
    { id: 'stats', label: 'Stats', icon: TrendingUp },
  ];

  return (
    <>
      {/* Floating Action Button for Mobile / Desktop Quick Add */}
      <button
        onClick={onOpenQuickAdd}
        className="fixed right-4 bottom-[calc(4.8rem+env(safe-area-inset-bottom,0px))] sm:bottom-8 z-40 w-14 h-14 min-h-[56px] min-w-[56px] rounded-full bg-gradient-to-tr from-indigo-600 to-violet-500 text-white flex items-center justify-center shadow-xl shadow-indigo-600/40 hover:scale-105 active:scale-95 transition-all focus:outline-none lg:hidden"
        title={activeTab === 'finance' ? 'Add Transaction' : 'Quick Add Task'}
      >
        <Plus className="w-7 h-7" />
      </button>

      {/* Fixed Bottom Navigation Bar */}
      <nav className="fixed bottom-0 left-0 right-0 z-30 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 px-1 py-1 pb-[calc(0.35rem+env(safe-area-inset-bottom,0px))] transition-colors select-none lg:hidden">
        <div className="max-w-lg mx-auto grid grid-cols-7">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;

            return (
              <button
                key={tab.id}
                onClick={() => onChangeTab(tab.id as ActiveTab)}
                className={`flex flex-col items-center justify-center min-h-[44px] w-full min-w-0 py-1 px-0.5 rounded-xl transition-all active:scale-95 touch-manipulation ${
                  isActive
                    ? 'text-indigo-600 dark:text-indigo-400 font-bold'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 font-medium'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'stroke-[2.5px]' : 'stroke-2'}`} />
                <span className="text-[9px] mt-0.5 tracking-tight leading-none">{tab.label}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </>
  );
};
