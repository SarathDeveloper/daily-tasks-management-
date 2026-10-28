import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowDownCircle,
  ArrowLeftRight,
  ArrowUpCircle,
  Check,
  ChevronLeft,
  ChevronRight,
  Circle,
  Plus,
} from 'lucide-react';
import {
  DiaryEntry,
  FinanceTransaction,
  Goal,
  Habit,
  HabitCheckIn,
  HabitCheckInPatch,
  Task,
} from '../types';
import { formatClockTime } from '../lib/dateFormat';
import { diaryPreview, sanitizeDiaryImages, sortDiaryEntries } from '../lib/diary';
import { habitBlockReason, isComplete, isScheduledOn } from '../lib/habits';
import { habitColor } from '../lib/habitStyle';
import { formatRupees } from '../lib/money';
import { DiaryMoodChip } from './DiaryView';
import { Button } from './ui/Button';
import { Card } from './ui/Card';

interface CalendarViewProps {
  selectedDate: string;
  onSelectDate: (date: string) => void;
  tasks: Task[];
  goals: Goal[];
  habits: Habit[];
  checkIns: HabitCheckIn[];
  transactions: FinanceTransaction[];
  diaryEntries: DiaryEntry[];
  onToggleTask: (taskId: string) => void;
  onEditTask: (task: Task) => void;
  onSetCheckIn: (habitId: string, date: string, patch: HabitCheckInPatch | null) => void;
  onAddTask: () => void;
  onAddFinance: (type: 'income' | 'expense') => void;
  onAddNote: () => void;
  onEditNote: (entry: DiaryEntry) => void;
}

const dateKey = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const parseDate = (date: string) => new Date(`${date}T00:00:00`);

const formatDate = (date: string, options: Intl.DateTimeFormatOptions) =>
  parseDate(date).toLocaleDateString('en-US', options);

export const CalendarView: React.FC<CalendarViewProps> = ({
  selectedDate,
  onSelectDate,
  tasks,
  goals,
  habits,
  checkIns,
  transactions,
  diaryEntries,
  onToggleTask,
  onEditTask,
  onSetCheckIn,
  onAddTask,
  onAddFinance,
  onAddNote,
  onEditNote,
}) => {
  const [visibleMonth, setVisibleMonth] = useState(() => {
    const date = parseDate(selectedDate);
    return new Date(date.getFullYear(), date.getMonth(), 1);
  });

  useEffect(() => {
    const selected = parseDate(selectedDate);
    setVisibleMonth(new Date(selected.getFullYear(), selected.getMonth(), 1));
  }, [selectedDate]);

  const days = useMemo(() => {
    const first = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth(), 1);
    const gridStart = new Date(first);
    gridStart.setDate(first.getDate() - first.getDay());
    return Array.from({ length: 42 }, (_, index) => {
      const date = new Date(gridStart);
      date.setDate(gridStart.getDate() + index);
      return dateKey(date);
    });
  }, [visibleMonth]);

  const selectedTasks = useMemo(
    () => tasks.filter((task) => task.date === selectedDate).sort((a, b) => (a.time || '23:59').localeCompare(b.time || '23:59')),
    [tasks, selectedDate]
  );
  const selectedHabits = useMemo(
    () =>
      habits.filter(
        (habit) => !habitBlockReason(habit, goals) && isScheduledOn(habit, selectedDate)
      ),
    [goals, habits, selectedDate]
  );
  const isFutureDate = selectedDate > dateKey(new Date());
  const selectedTransactions = useMemo(
    () => transactions.filter((entry) => entry.date === selectedDate).sort((a, b) => (a.time || '').localeCompare(b.time || '')),
    [transactions, selectedDate]
  );
  const selectedNotes = useMemo(
    () => sortDiaryEntries(diaryEntries.filter((entry) => entry.date === selectedDate)),
    [diaryEntries, selectedDate]
  );
  const tasksByDate = useMemo(() => {
    const counts = new Map<string, number>();
    for (const task of tasks) counts.set(task.date, (counts.get(task.date) || 0) + 1);
    return counts;
  }, [tasks]);
  const habitsByDate = useMemo(() => {
    const counts = new Map<string, number>();
    for (const date of days) {
      counts.set(date, habits.filter((habit) => !habitBlockReason(habit, goals) && isScheduledOn(habit, date)).length);
    }
    return counts;
  }, [days, goals, habits]);
  const transactionsByDate = useMemo(() => {
    const counts = new Map<string, number>();
    for (const entry of transactions) counts.set(entry.date, (counts.get(entry.date) || 0) + 1);
    return counts;
  }, [transactions]);
  const notesByDate = useMemo(() => {
    const counts = new Map<string, number>();
    for (const entry of diaryEntries) counts.set(entry.date, (counts.get(entry.date) || 0) + 1);
    return counts;
  }, [diaryEntries]);

  const shiftMonth = (amount: number) => {
    const nextMonth = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() + amount, 1);
    const selectedDay = parseDate(selectedDate).getDate();
    const lastDay = new Date(nextMonth.getFullYear(), nextMonth.getMonth() + 1, 0).getDate();
    const nextSelected = new Date(nextMonth.getFullYear(), nextMonth.getMonth(), Math.min(selectedDay, lastDay));
    setVisibleMonth(nextMonth);
    onSelectDate(dateKey(nextSelected));
  };

  const monthLabel = visibleMonth.toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  });

  return (
    <div className="space-y-4">
      <Card className="p-3 sm:p-5">
        <div className="mb-3 flex items-center justify-between gap-2">
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">Calendar</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">Tasks, habits, notes, and money</p>
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => shiftMonth(-1)}
              className="flex h-10 w-10 items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
              aria-label="Previous month"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <span className="min-w-[130px] text-center text-sm font-bold text-slate-800 dark:text-slate-100">
              {monthLabel}
            </span>
            <button
              type="button"
              onClick={() => shiftMonth(1)}
              className="flex h-10 w-10 items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
              aria-label="Next month"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-7">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
            <div key={day} className="py-2 text-center text-[10px] font-bold uppercase tracking-wide text-slate-400 sm:text-xs">
              {day}
            </div>
          ))}
          {days.map((date) => {
            const parsed = parseDate(date);
            const isCurrentMonth = parsed.getMonth() === visibleMonth.getMonth();
            const isSelected = date === selectedDate;
            const taskCount = tasksByDate.get(date) || 0;
            const habitCount = habitsByDate.get(date) || 0;
            const transactionCount = transactionsByDate.get(date) || 0;
            const diaryCount = notesByDate.get(date) || 0;
            const hasItems = taskCount + habitCount + transactionCount + diaryCount > 0;
            const isToday = date === dateKey(new Date());
            return (
              <button
                key={date}
                type="button"
                onClick={() => onSelectDate(date)}
                aria-pressed={isSelected}
                aria-label={`${formatDate(date, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}${taskCount ? `, ${taskCount} tasks` : ''}${habitCount ? `, ${habitCount} habits scheduled` : ''}${diaryCount ? `, ${diaryCount} notes` : ''}${transactionCount ? `, ${transactionCount} money entries` : ''}`}
                className={`relative mx-0.5 my-0.5 flex min-h-12 flex-col items-center justify-center rounded-xl py-1 text-sm transition-colors sm:min-h-[68px] ${
                  isSelected
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : isCurrentMonth
                      ? 'text-slate-800 hover:bg-slate-100 dark:text-slate-100 dark:hover:bg-slate-800'
                      : 'text-slate-300 hover:bg-slate-50 dark:text-slate-600 dark:hover:bg-slate-800/50'
                }`}
              >
                <span className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold sm:h-8 sm:w-8 sm:text-sm ${
                  isToday && !isSelected ? 'border border-indigo-500 text-indigo-600 dark:text-indigo-300' : ''
                }`}>
                  {parsed.getDate()}
                </span>
                {hasItems && (
                  <span className="mt-1 flex items-center gap-1" aria-hidden="true">
                    {taskCount > 0 && <span className={`h-1.5 w-1.5 rounded-full ${isSelected ? 'bg-white' : 'bg-indigo-500'}`} />}
                    {habitCount > 0 && <span className={`h-1.5 w-1.5 rounded-full ${isSelected ? 'bg-emerald-100' : 'bg-emerald-500'}`} />}
                    {diaryCount > 0 && <span className={`h-1.5 w-1.5 rounded-full ${isSelected ? 'bg-violet-100' : 'bg-violet-500'}`} />}
                    {transactionCount > 0 && <span className={`h-1.5 w-1.5 rounded-full ${isSelected ? 'bg-amber-100' : 'bg-amber-500'}`} />}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 border-t border-slate-100 pt-3 text-[10px] font-medium text-slate-500 dark:border-slate-800 dark:text-slate-400">
          <span className="inline-flex items-center gap-1.5"><i className="h-2 w-2 rounded-full bg-indigo-500" /> Tasks</span>
          <span className="inline-flex items-center gap-1.5"><i className="h-2 w-2 rounded-full bg-emerald-500" /> Scheduled habits</span>
          <span className="inline-flex items-center gap-1.5"><i className="h-2 w-2 rounded-full bg-violet-500" /> Notes</span>
          <span className="inline-flex items-center gap-1.5"><i className="h-2 w-2 rounded-full bg-amber-500" /> Money entries</span>
        </div>
      </Card>

      <Card className="p-4 sm:p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              {formatDate(selectedDate, { weekday: 'long', month: 'long', day: 'numeric' })}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {selectedTasks.length} {selectedTasks.length === 1 ? 'task' : 'tasks'} · {selectedHabits.length} {selectedHabits.length === 1 ? 'habit' : 'habits'} · {selectedNotes.length} {selectedNotes.length === 1 ? 'note' : 'notes'} · {selectedTransactions.length} {selectedTransactions.length === 1 ? 'money entry' : 'money entries'}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="secondary" onClick={onAddTask}>
              <Plus className="mr-1 h-3.5 w-3.5" /> Task
            </Button>
            <Button size="sm" variant="secondary" onClick={() => onAddFinance('expense')}>
              <ArrowDownCircle className="mr-1 h-3.5 w-3.5" /> Expense
            </Button>
            <Button size="sm" variant="secondary" onClick={() => onAddFinance('income')}>
              <ArrowUpCircle className="mr-1 h-3.5 w-3.5" /> Income
            </Button>
            <Button size="sm" variant="secondary" onClick={onAddNote}>
              <Plus className="mr-1 h-3.5 w-3.5" /> Note
            </Button>
          </div>
        </div>

        <div className="space-y-5">
          <section>
            <h4 className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">Tasks</h4>
            {selectedTasks.length ? (
              <div className="space-y-1">
                {selectedTasks.map((task) => (
                  <div key={task.id} className="flex items-center gap-2 rounded-xl px-2 py-1.5 hover:bg-slate-50 dark:hover:bg-slate-800/60">
                    <button
                      type="button"
                      onClick={() => onToggleTask(task.id)}
                      aria-label={task.completed ? `Mark ${task.title} incomplete` : `Complete ${task.title}`}
                      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                        task.completed
                          ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300'
                          : 'text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'
                      }`}
                    >
                      {task.completed ? <Check className="h-4 w-4" /> : <Circle className="h-4 w-4" />}
                    </button>
                    <button
                      type="button"
                      onClick={() => onEditTask(task)}
                      className={`min-w-0 flex-1 text-left text-sm font-medium ${
                        task.completed ? 'text-slate-400 line-through' : 'text-slate-800 dark:text-slate-100'
                      }`}
                    >
                      <span className="block truncate">{task.title}</span>
                    </button>
                    <span className="shrink-0 text-xs text-slate-400">{task.time || ''}</span>
                  </div>
                ))}
              </div>
            ) : <p className="text-sm text-slate-400">No tasks planned.</p>}
          </section>

          <section>
            <h4 className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">Habits</h4>
            {selectedHabits.length ? (
              <div className="space-y-1">
                {selectedHabits.map((habit) => {
                  const entry = checkIns.find((item) => item.habitId === habit.id && item.date === selectedDate);
                  const checked = isComplete(habit, entry);
                  return (
                    <button
                      key={habit.id}
                      type="button"
                      onClick={() => {
                        const target = Math.max(1, habit.targetCount ?? 1);
                        if (checked) onSetCheckIn(habit.id, selectedDate, null);
                        else onSetCheckIn(habit.id, selectedDate, { skipped: false, value: target });
                      }}
                      disabled={isFutureDate}
                      title={isFutureDate ? 'Future habits cannot be checked in yet.' : undefined}
                      className="flex min-h-10 w-full items-center gap-3 rounded-xl px-2 text-left text-sm text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 dark:text-slate-200 dark:hover:bg-slate-800/60"
                    >
                      <span className={`flex h-6 w-6 items-center justify-center rounded-full ${
                        checked
                          ? habitColor(habit.color).solid
                          : entry?.skipped
                            ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300'
                            : 'border border-slate-300 text-transparent dark:border-slate-600'
                      }`}>
                        {checked && <Check className="h-3.5 w-3.5" />}
                      </span>
                      <span>{habit.title}</span>
                    </button>
                  );
                })}
              </div>
            ) : <p className="text-sm text-slate-400">No habits scheduled.</p>}
          </section>

          <section>
            <h4 className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">Notes</h4>
            {selectedNotes.length ? (
              <div className="space-y-1">
                {selectedNotes.map((note) => {
                  const photo = sanitizeDiaryImages(note.images)[0];
                  return (
                  <button
                    key={note.id}
                    type="button"
                    onClick={() => onEditNote(note)}
                    className="flex min-h-10 w-full items-center gap-2 rounded-xl px-2 text-left hover:bg-slate-50 dark:hover:bg-slate-800/60"
                  >
                    <DiaryMoodChip mood={note.mood} />
                    {photo && (
                      <img
                        src={photo.dataUrl}
                        alt=""
                        className="h-8 w-8 shrink-0 rounded-lg object-cover"
                      />
                    )}
                    <span className="min-w-0 flex-1 truncate text-sm text-slate-800 dark:text-slate-100">
                      {diaryPreview(note.body) || (photo ? 'Photo' : '')}
                    </span>
                    <span className="shrink-0 text-xs text-slate-400">{formatClockTime(note.time)}</span>
                  </button>
                  );
                })}
              </div>
            ) : <p className="text-sm text-slate-400">No notes yet.</p>}
          </section>

          <section>
            <h4 className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">Income &amp; expenses</h4>
            {selectedTransactions.length ? (
              <div className="space-y-1">
                {selectedTransactions.map((entry) => {
                  const isIncome = entry.type === 'income';
                  const isTransfer = entry.type === 'transfer';
                  const Icon = isIncome ? ArrowUpCircle : isTransfer ? ArrowLeftRight : ArrowDownCircle;
                  return (
                    <div key={entry.id} className="flex items-center gap-3 rounded-xl px-2 py-2">
                      <Icon className={`h-5 w-5 shrink-0 ${
                        isIncome ? 'text-emerald-500' : isTransfer ? 'text-slate-400' : 'text-rose-500'
                      }`} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-slate-800 dark:text-slate-100">{entry.category}</p>
                        {entry.note && <p className="truncate text-xs text-slate-500 dark:text-slate-400">{entry.note}</p>}
                      </div>
                      <span className={`shrink-0 text-sm font-bold ${
                        isIncome ? 'text-emerald-600 dark:text-emerald-400' : isTransfer ? 'text-slate-500' : 'text-rose-600 dark:text-rose-400'
                      }`}>
                        {isIncome ? '+' : isTransfer ? '' : '−'}{formatRupees(entry.amount)}
                      </span>
                    </div>
                  );
                })}
              </div>
            ) : <p className="text-sm text-slate-400">No money entries recorded.</p>}
          </section>
        </div>
      </Card>
    </div>
  );
};
