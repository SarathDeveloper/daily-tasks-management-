import React from 'react';
import { Flame, CheckCircle, Clock, Zap, TrendingUp, Calendar } from 'lucide-react';
import { Task } from '../types';

interface StatsViewProps {
  tasks: Task[];
}

export const StatsView: React.FC<StatsViewProps> = ({ tasks }) => {
  const totalTasks = tasks.length;
  const completedTasks = tasks.filter((t) => t.completed);
  const completedCount = completedTasks.length;
  const completionRate = totalTasks > 0 ? Math.round((completedCount / totalTasks) * 100) : 0;

  // Total estimated focus time completed
  const totalFocusMinutes = completedTasks.reduce(
    (acc, t) => acc + (t.estimatedMinutes || 20),
    0
  );

  // Calculate streak (consecutive days with completed tasks)
  const calculateStreak = (): number => {
    const dates = Array.from(new Set(completedTasks.map((t) => t.date))).sort().reverse();
    if (dates.length === 0) return 0;

    let streak = 0;
    const todayStr = new Date().toISOString().split('T')[0];
    let checkDate = new Date();

    // Check if today or yesterday has a completed task
    if (!dates.includes(todayStr)) {
      checkDate.setDate(checkDate.getDate() - 1);
      const yesterdayStr = checkDate.toISOString().split('T')[0];
      if (!dates.includes(yesterdayStr)) {
        return 0;
      }
    }

    while (true) {
      const dStr = checkDate.toISOString().split('T')[0];
      if (dates.includes(dStr)) {
        streak++;
        checkDate.setDate(checkDate.getDate() - 1);
      } else {
        break;
      }
    }

    return streak;
  };

  const streakDays = calculateStreak();

  // Weekly Completion Bar Chart Data (last 7 days)
  const last7Days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    const dateStr = d.toISOString().split('T')[0];
    const dayTasks = tasks.filter((t) => t.date === dateStr);
    const dayDone = dayTasks.filter((t) => t.completed).length;

    return {
      dateStr,
      dayLabel: d.toLocaleDateString('en-US', { weekday: 'short' }),
      total: dayTasks.length,
      done: dayDone,
    };
  });

  return (
    <div className="max-w-4xl lg:max-w-6xl mx-auto space-y-6 pb-20 lg:pb-8">
      <div>
        <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
          <span>Productivity & Streak Stats</span>
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400">Track your task completion rates and habits</p>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {/* Streak */}
        <div className="bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700/80 rounded-2xl p-4 flex flex-col justify-between shadow-sm transition-colors">
          <div className="flex items-center justify-between text-amber-600 dark:text-amber-400">
            <span className="text-xs font-semibold">Daily Streak</span>
            <Flame className="w-5 h-5 fill-amber-500 text-amber-500 animate-bounce" />
          </div>
          <div className="mt-2">
            <span className="text-3xl font-black text-slate-900 dark:text-white">{streakDays}</span>
            <span className="text-xs text-slate-500 dark:text-slate-400 block">days active</span>
          </div>
        </div>

        {/* Completion Rate */}
        <div className="bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700/80 rounded-2xl p-4 flex flex-col justify-between shadow-sm transition-colors">
          <div className="flex items-center justify-between text-emerald-600 dark:text-emerald-400">
            <span className="text-xs font-semibold">Done Rate</span>
            <CheckCircle className="w-5 h-5" />
          </div>
          <div className="mt-2">
            <span className="text-3xl font-black text-slate-900 dark:text-white">{completionRate}%</span>
            <span className="text-xs text-slate-500 dark:text-slate-400 block">
              {completedCount} of {totalTasks} tasks
            </span>
          </div>
        </div>

        {/* Total Time Invested */}
        <div className="bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700/80 rounded-2xl p-4 flex flex-col justify-between shadow-sm transition-colors">
          <div className="flex items-center justify-between text-indigo-600 dark:text-indigo-400">
            <span className="text-xs font-semibold">Focus Time</span>
            <Clock className="w-5 h-5" />
          </div>
          <div className="mt-2">
            <span className="text-3xl font-black text-slate-900 dark:text-white">
              {Math.floor(totalFocusMinutes / 60)}h {totalFocusMinutes % 60}m
            </span>
            <span className="text-xs text-slate-500 dark:text-slate-400 block">time invested</span>
          </div>
        </div>

        {/* Total Active Tasks */}
        <div className="bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700/80 rounded-2xl p-4 flex flex-col justify-between shadow-sm transition-colors">
          <div className="flex items-center justify-between text-sky-600 dark:text-sky-400">
            <span className="text-xs font-semibold">Total Logs</span>
            <Zap className="w-5 h-5" />
          </div>
          <div className="mt-2">
            <span className="text-3xl font-black text-slate-900 dark:text-white">{totalTasks}</span>
            <span className="text-xs text-slate-500 dark:text-slate-400 block">recorded tasks</span>
          </div>
        </div>
      </div>

      {/* 7-Day Completion Bar Chart */}
      <div className="bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 rounded-2xl p-5 shadow-sm transition-colors">
        <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
          <Calendar className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
          <span>Last 7 Days Activity</span>
        </h3>

        <div className="flex items-end justify-between gap-2 h-40 pt-6">
          {last7Days.map((d) => {
            const maxVal = Math.max(...last7Days.map((x) => x.total), 1);
            const heightPercent = (d.total / maxVal) * 100;
            const doneHeightPercent = d.total > 0 ? (d.done / d.total) * 100 : 0;

            return (
              <div key={d.dateStr} className="flex-1 flex flex-col items-center gap-2 h-full justify-end">
                <span className="text-[10px] font-mono text-slate-500 dark:text-slate-400 font-bold">
                  {d.done}/{d.total}
                </span>

                <div className="w-full max-w-[32px] bg-slate-100 dark:bg-slate-900 rounded-t-lg overflow-hidden flex flex-col justify-end h-full border border-slate-200 dark:border-slate-800">
                  <div
                    className="w-full bg-slate-300 dark:bg-slate-700/60 rounded-t-lg transition-all duration-300 relative"
                    style={{ height: `${heightPercent}%` }}
                  >
                    <div
                      className="w-full bg-indigo-600 dark:bg-indigo-500 rounded-t-lg transition-all duration-300 absolute bottom-0 left-0 right-0"
                      style={{ height: `${doneHeightPercent}%` }}
                    />
                  </div>
                </div>

                <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-300 uppercase">
                  {d.dayLabel}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
