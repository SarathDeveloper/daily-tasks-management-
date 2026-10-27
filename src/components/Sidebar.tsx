import React from 'react';
import { Calendar, Clock, Zap, Folder, TrendingUp, Wallet, Plus, Target, Repeat } from 'lucide-react';
import { ActiveTab } from '../types';

interface SidebarProps {
  activeTab: ActiveTab;
  onChangeTab: (tab: ActiveTab) => void;
  onOpenQuickAdd: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onChangeTab,
  onOpenQuickAdd,
}) => {
  const tabs = [
    { id: 'today', label: 'Today', icon: Calendar },
    { id: 'timeline', label: 'Timeline', icon: Clock },
    { id: 'focus', label: 'Focus', icon: Zap },
    { id: 'goals', label: 'Goals', icon: Target },
    { id: 'habits', label: 'Habits', icon: Repeat },
    { id: 'categories', label: 'Categories', icon: Folder },
    { id: 'finance', label: 'Finance', icon: Wallet },
    { id: 'stats', label: 'Stats', icon: TrendingUp },
  ];

  const todayFormatted = new Date().toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });

  return (
    <aside className="hidden lg:flex fixed left-0 top-0 bottom-0 w-64 z-30 flex-col overflow-hidden bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 px-4 py-5 select-none">
      {/* Brand */}
      <div className="flex items-center gap-3 px-1 mb-6 shrink-0">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center text-white shadow-md shadow-indigo-500/20 shrink-0">
          <span className="font-bold text-lg leading-none">✓</span>
        </div>
        <div>
          <h1 className="font-bold text-base tracking-tight leading-none text-slate-900 dark:text-white">
            Daily Tasks
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            {todayFormatted}
          </p>
        </div>
      </div>

      {/* Nav items */}
      <nav className="flex flex-col gap-1 flex-1 min-h-0 overflow-y-auto">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onChangeTab(tab.id as ActiveTab)}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-colors ${
                isActive
                  ? 'bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              <Icon
                className={`w-5 h-5 shrink-0 ${isActive ? 'stroke-[2.5px]' : 'stroke-2'}`}
              />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </nav>

      {/* New Task / Finance entry button (replaces FAB on desktop) */}
      <button
        onClick={onOpenQuickAdd}
        className="mt-4 w-full shrink-0 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 text-white font-bold text-sm shadow-lg shadow-indigo-600/30 hover:opacity-90 active:scale-95 transition-all"
        title={activeTab === 'finance' ? 'Add Transaction' : 'Quick Add Task'}
      >
        <Plus className="w-4 h-4" />
        <span>{activeTab === 'finance' ? 'New Entry' : 'New Task'}</span>
      </button>
    </aside>
  );
};
