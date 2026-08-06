import React from 'react';
import { Calendar, Clock, Zap, Folder, Wallet, TrendingUp, Plus } from 'lucide-react';
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
    { id: 'categories', label: 'Cats', icon: Folder },
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
      <nav className="fixed bottom-0 left-0 right-0 z-30 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 px-2 py-1.5 pb-[calc(0.5rem+env(safe-area-inset-bottom,0px))] sm:px-6 transition-colors select-none lg:hidden">
        <div className="max-w-md mx-auto flex items-center justify-around">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;

            return (
              <button
                key={tab.id}
                onClick={() => onChangeTab(tab.id as ActiveTab)}
                className={`flex flex-col items-center justify-center min-h-[44px] min-w-[40px] py-1 px-1 rounded-xl transition-all active:scale-95 ${
                  isActive
                    ? 'text-indigo-600 dark:text-indigo-400 font-bold scale-105'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 font-medium'
                }`}
              >
                <Icon className={`w-5 h-5 ${isActive ? 'stroke-[2.5px]' : 'stroke-2'}`} />
                <span className="text-[9px] mt-0.5 tracking-tight">{tab.label}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </>
  );
};
