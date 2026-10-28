import React, { useEffect, useState } from 'react';
import {
  AlarmClock,
  BookOpen,
  Calendar,
  CalendarDays,
  Clock,
  Folder,
  MoreHorizontal,
  Plus,
  Repeat,
  Settings,
  Target,
  TrendingUp,
  UserRound,
  Wallet,
  Zap,
} from 'lucide-react';
import { ActiveTab } from '../types';

interface BottomNavProps {
  activeTab: ActiveTab;
  onChangeTab: (tab: ActiveTab) => void;
  onOpenQuickAdd: () => void;
  onOpenSettings: () => void;
  onOpenProfile: () => void;
}

export const BottomNav: React.FC<BottomNavProps> = ({
  activeTab,
  onChangeTab,
  onOpenQuickAdd,
  onOpenSettings,
  onOpenProfile,
}) => {
  const [isMoreOpen, setIsMoreOpen] = useState(false);
  const tabs = [
    { id: 'today', label: 'Today', icon: Calendar },
    { id: 'habits', label: 'Habits', icon: Repeat },
    { id: 'finance', label: 'Money', icon: Wallet },
    { id: 'stats', label: 'Streak', icon: TrendingUp },
  ];
  const moreTabs = [
    { id: 'calendar', label: 'Calendar', icon: CalendarDays },
    { id: 'timeline', label: 'Timeline', icon: Clock },
    { id: 'focus', label: 'Focus', icon: Zap },
    { id: 'goals', label: 'Goals', icon: Target },
    { id: 'alarms', label: 'Alarms', icon: AlarmClock },
    { id: 'diary', label: 'Diary', icon: BookOpen },
    { id: 'categories', label: 'Categories', icon: Folder },
  ] as const;
  const isMoreTabActive = moreTabs.some((tab) => tab.id === activeTab);

  useEffect(() => {
    if (!isMoreOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsMoreOpen(false);
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [isMoreOpen]);

  return (
    <>
      {/* Floating Action Button for Mobile / Desktop Quick Add */}
      <button
        onClick={onOpenQuickAdd}
        className="fixed right-4 bottom-[calc(4.8rem+env(safe-area-inset-bottom,0px))] sm:bottom-8 z-40 w-14 h-14 min-h-[56px] min-w-[56px] rounded-full bg-gradient-to-tr from-indigo-600 to-violet-500 text-white flex items-center justify-center shadow-xl shadow-indigo-600/40 hover:scale-105 active:scale-95 transition-all focus:outline-none lg:hidden"
        title={
          activeTab === 'today' || activeTab === 'finance'
            ? 'Add Expense or Income'
            : activeTab === 'diary'
              ? 'New note'
              : 'Quick Add Task'
        }
      >
        <Plus className="w-7 h-7" />
      </button>

      {/* Fixed Bottom Navigation Bar */}
      <nav className="fixed bottom-0 left-0 right-0 z-30 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 px-1 py-1 pb-[calc(0.35rem+env(safe-area-inset-bottom,0px))] transition-colors select-none lg:hidden">
        <div className="max-w-lg mx-auto grid grid-cols-5">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;

            return (
              <button
                key={tab.id}
                onClick={() => {
                  setIsMoreOpen(false);
                  onChangeTab(tab.id as ActiveTab);
                }}
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
          <button
            type="button"
            onClick={() => setIsMoreOpen((open) => !open)}
            aria-expanded={isMoreOpen}
            aria-controls="mobile-more-menu"
            className={`flex flex-col items-center justify-center min-h-[44px] w-full min-w-0 py-1 px-0.5 rounded-xl transition-all active:scale-95 touch-manipulation ${
              isMoreOpen || isMoreTabActive
                ? 'text-indigo-600 dark:text-indigo-400 font-bold'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 font-medium'
            }`}
          >
            <MoreHorizontal className={`w-4 h-4 ${isMoreOpen || isMoreTabActive ? 'stroke-[2.5px]' : 'stroke-2'}`} />
            <span className="text-[9px] mt-0.5 tracking-tight leading-none">More</span>
          </button>
        </div>
      </nav>

      {isMoreOpen && (
        <>
          <button
            type="button"
            aria-label="Close more menu"
            onClick={() => setIsMoreOpen(false)}
            className="fixed inset-0 z-40 bg-slate-950/20 lg:hidden"
          />
          <div
            id="mobile-more-menu"
            aria-label="More navigation"
            className="fixed bottom-[calc(4.5rem+env(safe-area-inset-bottom,0px))] left-3 right-3 z-50 mx-auto max-w-lg rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-3 shadow-2xl lg:hidden"
          >
            <div className="grid grid-cols-2 gap-2">
              {moreTabs.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => {
                      onChangeTab(tab.id);
                      setIsMoreOpen(false);
                    }}
                    className={`flex min-h-12 items-center gap-3 rounded-xl px-3 text-sm font-semibold transition-colors ${
                      isActive
                        ? 'bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300'
                        : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    <Icon className="h-5 w-5 shrink-0" />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
              <button
                type="button"
                onClick={() => {
                  setIsMoreOpen(false);
                  onOpenSettings();
                }}
                className="col-span-2 flex min-h-12 items-center gap-3 rounded-xl px-3 text-sm font-semibold text-slate-600 dark:text-slate-300 transition-colors hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <Settings className="h-5 w-5 shrink-0" />
                <span>Settings</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsMoreOpen(false);
                  onOpenProfile();
                }}
                className="col-span-2 flex min-h-12 items-center gap-3 rounded-xl px-3 text-sm font-semibold text-slate-600 dark:text-slate-300 transition-colors hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <UserRound className="h-5 w-5 shrink-0" />
                <span>Profile</span>
              </button>
            </div>
          </div>
        </>
      )}
    </>
  );
};
