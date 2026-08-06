import React from 'react';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight } from 'lucide-react';
import { Task } from '../types';

interface DateBarProps {
  selectedDate: string; // YYYY-MM-DD
  onSelectDate: (dateStr: string) => void;
  tasks: Task[];
}

export const DateBar: React.FC<DateBarProps> = ({ selectedDate, onSelectDate, tasks }) => {
  const todayStr = new Date().toISOString().split('T')[0];

  // Generate 7 days centered around selectedDate or today
  const baseDate = new Date(selectedDate + 'T00:00:00');
  const days = [];

  for (let i = -3; i <= 3; i++) {
    const d = new Date(baseDate);
    d.setDate(d.getDate() + i);
    const dateStr = d.toISOString().split('T')[0];
    const isToday = dateStr === todayStr;

    // Count tasks for this date
    const dateTasks = tasks.filter((t) => t.date === dateStr);
    const completedCount = dateTasks.filter((t) => t.completed).length;

    days.push({
      dateStr,
      dayName: d.toLocaleDateString('en-US', { weekday: 'short' }),
      dayNumber: d.getDate(),
      monthShort: d.toLocaleDateString('en-US', { month: 'short' }),
      isToday,
      totalTasks: dateTasks.length,
      completedCount,
    });
  }

  const navigateDays = (offset: number) => {
    const d = new Date(selectedDate + 'T00:00:00');
    d.setDate(d.getDate() + offset);
    onSelectDate(d.toISOString().split('T')[0]);
  };

  const isSelectedToday = selectedDate === todayStr;

  return (
    <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-2 py-2 sm:px-6 transition-colors select-none">
      <div className="max-w-5xl mx-auto flex items-center justify-between gap-1.5 sm:gap-2">
        {/* Left Arrow */}
        <button
          onClick={() => navigateDays(-1)}
          className="w-10 h-10 min-w-[40px] min-h-[40px] rounded-xl flex items-center justify-center text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors active:scale-95"
          title="Previous Day"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>

        {/* Date Selector Strip */}
        <div className="flex-1 flex items-center justify-start sm:justify-center gap-1 sm:gap-1.5 overflow-x-auto no-scrollbar py-1 pr-2 snap-x snap-mandatory touch-pan-x">
          {days.map((day) => {
            const isSelected = day.dateStr === selectedDate;
            return (
              <button
                key={day.dateStr}
                onClick={() => onSelectDate(day.dateStr)}
                className={`snap-center shrink-0 relative flex flex-col items-center justify-center min-w-[44px] sm:min-w-[62px] min-h-[48px] sm:min-h-[52px] py-1.5 sm:py-2 px-1.5 sm:px-2 rounded-xl transition-all active:scale-95 ${
                  isSelected
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30 scale-105 font-bold'
                    : day.isToday
                    ? 'bg-indigo-50 dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-500/40 font-semibold'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                <span className="text-[9px] sm:text-[10px] uppercase tracking-wider opacity-80">
                  {day.dayName}
                </span>
                <span className="text-xs sm:text-base font-extrabold leading-tight">
                  {day.dayNumber}
                </span>

                {/* Task progress dot */}
                {day.totalTasks > 0 && (
                  <div className="mt-0.5 flex items-center gap-0.5">
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${
                        day.completedCount === day.totalTasks
                          ? 'bg-emerald-500'
                          : isSelected
                          ? 'bg-white'
                          : 'bg-indigo-500 dark:bg-indigo-400'
                      }`}
                    />
                    <span className="text-[8px] sm:text-[9px] opacity-80">
                      {day.completedCount}/{day.totalTasks}
                    </span>
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {/* Right Arrow & Today Jump */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => navigateDays(1)}
            className="w-10 h-10 min-w-[40px] min-h-[40px] rounded-xl flex items-center justify-center text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors active:scale-95"
            title="Next Day"
          >
            <ChevronRight className="w-5 h-5" />
          </button>

          {!isSelectedToday && (
            <button
              onClick={() => onSelectDate(todayStr)}
              className="min-h-[40px] px-2.5 rounded-xl bg-indigo-50 dark:bg-slate-800 hover:bg-indigo-100 dark:hover:bg-slate-700 text-xs font-semibold text-indigo-600 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-500/30 flex items-center gap-1 transition-colors whitespace-nowrap active:scale-95"
            >
              <CalendarIcon className="w-3.5 h-3.5" />
              <span className="hidden xs:inline">Today</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
