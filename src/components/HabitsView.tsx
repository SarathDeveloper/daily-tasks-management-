import React, { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, Flame, MoreHorizontal, Pencil, Plus, Repeat, Target, Trash2 } from 'lucide-react';
import type { Goal, Habit, HabitCheckIn, HabitCheckInPatch } from '../types';
import {
  addDays,
  checkInOn,
  goalProgress,
  habitBlockReason,
  habitCompletion,
  habitStreak,
  isComplete,
  isDueToday,
  longestStreak,
  monthHeatmap,
  recentSchedule,
  scheduleForDates,
  scheduleLabel,
  todayDateString,
  weekDates,
  weekStartMonday,
} from '../lib/habits';
import { habitColor, heatCellClass } from '../lib/habitStyle';
import { Button } from './ui/Button';
import { Card } from './ui/Card';
import { HabitCheckControl, HabitSkipButton } from './HabitCheckControl';
import { HabitIcon } from './HabitIcon';
import { HabitModal } from './HabitModal';

interface HabitsViewProps {
  goals: Goal[];
  habits: Habit[];
  checkIns: HabitCheckIn[];
  onSetCheckIn: (habitId: string, date: string, patch: HabitCheckInPatch | null) => void;
  onSaveHabit: (habit: Partial<Habit>) => void;
  onDeleteHabit: (id: string) => void;
  onOpenGoals: () => void;
  onRegisterClose: (close: (() => void) | null) => void;
  localMusicName?: string;
}

type HabitPane = 'today' | 'week' | 'progress';

const PANES: { id: HabitPane; label: string }[] = [
  { id: 'today', label: 'Today' },
  { id: 'week', label: 'Week' },
  { id: 'progress', label: 'Progress' },
];

const WEEKDAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const byTitle = (a: Habit, b: Habit) => a.title.localeCompare(b.title);

function formatShort(date: string): string {
  return new Date(`${date}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export const HabitsView: React.FC<HabitsViewProps> = ({
  goals,
  habits,
  checkIns,
  onSetCheckIn,
  onSaveHabit,
  onDeleteHabit,
  onOpenGoals,
  onRegisterClose,
  localMusicName,
}) => {
  const today = todayDateString();
  const [pane, setPane] = useState<HabitPane>('today');
  const [editing, setEditing] = useState<Habit | null>(null);
  const [creating, setCreating] = useState(false);
  const [weekOffset, setWeekOffset] = useState(0);
  const [monthOffset, setMonthOffset] = useState(0);
  const modalOpen = creating || editing !== null;

  useEffect(() => {
    if (!modalOpen) {
      onRegisterClose(null);
      return;
    }
    onRegisterClose(() => {
      setCreating(false);
      setEditing(null);
    });
    return () => onRegisterClose(null);
  }, [modalOpen, onRegisterClose]);

  const due = habits
    .filter((habit) => isDueToday(habit, today, goals, checkIns))
    .sort((a, b) => {
      const rank = (habit: Habit) => {
        const entry = checkInOn(habit.id, checkIns, today);
        if (isComplete(habit, entry)) return 2;
        if (entry?.skipped) return 1;
        return 0;
      };
      return rank(a) - rank(b) || byTitle(a, b);
    });
  const doneCount = due.filter((habit) => isComplete(habit, checkInOn(habit.id, checkIns, today))).length;
  const score = due.length === 0 ? 0 : Math.round((doneCount / due.length) * 100);

  const pausedGoalIds = new Set(goals.filter((goal) => goal.status === 'paused').map((goal) => goal.id));
  const paused = habits
    .filter((habit) => !habit.archived && habit.goalId && pausedGoalIds.has(habit.goalId))
    .sort(byTitle);
  const archived = habits.filter((habit) => habit.archived).sort(byTitle);
  const progressHabits = habits
    .filter((habit) => !habit.archived && !(habit.goalId && pausedGoalIds.has(habit.goalId)))
    .sort(byTitle);
  const weekHabits = habits.filter((habit) => !habit.archived).sort(byTitle);

  const monday = addDays(weekStartMonday(today), weekOffset * 7);
  const week = weekDates(monday);
  const monthDate = new Date();
  monthDate.setDate(1);
  monthDate.setMonth(monthDate.getMonth() + monthOffset);
  const heatYear = monthDate.getFullYear();
  const heatMonth = monthDate.getMonth() + 1;
  const monthLabel = monthDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  const monthStart = `${heatYear}-${String(heatMonth).padStart(2, '0')}-01`;
  const monthEndDate = new Date(heatYear, heatMonth, 0);
  const monthEnd = `${heatYear}-${String(heatMonth).padStart(2, '0')}-${String(monthEndDate.getDate()).padStart(2, '0')}`;
  const monthThrough = monthEnd < today ? monthEnd : today;

  const goalName = (goalId?: string) => goals.find((goal) => goal.id === goalId)?.title;
  const closeModal = () => {
    setCreating(false);
    setEditing(null);
  };
  const editHabit = (habit: Habit) => {
    setCreating(false);
    setEditing(habit);
  };
  const deleteHabit = (habit: Habit) => {
    if (!window.confirm(`Delete habit "${habit.title}"?`)) return;
    onDeleteHabit(habit.id);
  };

  return (
    <div className="max-w-4xl lg:max-w-6xl mx-auto space-y-5 pb-24 lg:pb-8">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Repeat className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            Habits
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Check today, scan the week, and see what fills each goal.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button variant="secondary" size="sm" onClick={onOpenGoals}>
            <Target className="w-4 h-4" />
            Goals
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={() => {
              setEditing(null);
              setCreating(true);
            }}
          >
            <Plus className="w-4 h-4" />
            Add
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2" role="tablist" aria-label="Habit views">
        {PANES.map((option) => (
          <button
            key={option.id}
            type="button"
            role="tab"
            aria-selected={pane === option.id}
            onClick={() => setPane(option.id)}
            className={`px-2 py-2 rounded-xl text-xs font-bold border min-h-[40px] ${
              pane === option.id
                ? 'bg-indigo-600 text-white border-indigo-500'
                : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700'
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>

      {habits.length === 0 && (
        <Card className="p-8 text-center">
          <Repeat className="w-10 h-10 text-slate-400 dark:text-slate-600 mx-auto mb-3" />
          <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">No habits yet</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-xs mx-auto">
            Add a daily habit and link it to a goal. Each check moves that goal forward.
          </p>
          <div className="mt-4">
            <Button variant="primary" size="sm" onClick={() => setCreating(true)}>
              <Plus className="w-4 h-4" />
              Add a habit
            </Button>
          </div>
        </Card>
      )}

      {habits.length > 0 && pane === 'today' && (
        <section className="space-y-3">
          <Card className="p-4">
            <div className="flex items-end justify-between gap-3">
              <div>
                <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">Due today</p>
                <p className="text-2xl font-black text-slate-900 dark:text-white leading-none mt-1">
                  {doneCount} of {due.length} done
                </p>
              </div>
              <p className="text-sm font-bold text-indigo-600 dark:text-indigo-400">{score}%</p>
            </div>
            <div className="mt-3 h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
              <div className="h-full bg-indigo-600 rounded-full" style={{ width: `${score}%` }} />
            </div>
          </Card>
          {due.length === 0 && (
            <Card className="p-4">
              <p className="text-sm text-slate-600 dark:text-slate-300">Nothing is due today.</p>
            </Card>
          )}
          {due.map((habit) => (
            <HabitDayRow
              key={habit.id}
              habit={habit}
              date={today}
              checkIns={checkIns}
              goalName={goalName(habit.goalId)}
              onSetCheckIn={onSetCheckIn}
              onEdit={() => editHabit(habit)}
              onDelete={() => deleteHabit(habit)}
            />
          ))}
        </section>
      )}

      {habits.length > 0 && pane === 'week' && (
        <section className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              aria-label="Previous week"
              onClick={() => setWeekOffset((value) => value - 1)}
              className="w-10 h-10 rounded-xl flex items-center justify-center text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <div className="text-center">
              <p className="text-sm font-bold text-slate-900 dark:text-white">
                {formatShort(week[0])} – {formatShort(week[6])}
              </p>
              {weekOffset !== 0 && (
                <button
                  type="button"
                  onClick={() => setWeekOffset(0)}
                  className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400"
                >
                  Back to this week
                </button>
              )}
            </div>
            <button
              type="button"
              aria-label="Next week"
              onClick={() => setWeekOffset((value) => value + 1)}
              className="w-10 h-10 rounded-xl flex items-center justify-center text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
          <Card className="p-3 overflow-x-auto">
            <div className="min-w-[320px]">
              <div className="grid grid-cols-[minmax(0,1fr)_repeat(7,2rem)] gap-1 items-center mb-1">
                <span />
                {week.map((date, index) => (
                  <span
                    key={date}
                    className={`text-center text-[10px] font-bold ${
                      date === today ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-400'
                    }`}
                  >
                    {WEEKDAYS[index]}
                  </span>
                ))}
              </div>
              {weekHabits.map((habit) => {
                const blocked = Boolean(habitBlockReason(habit, goals));
                const days = scheduleForDates(habit, checkIns, week);
                return (
                  <div
                    key={habit.id}
                    className="grid grid-cols-[minmax(0,1fr)_repeat(7,2rem)] gap-1 items-center py-1.5"
                  >
                    <button type="button" onClick={() => editHabit(habit)} className="min-w-0 text-left">
                      <span className="flex items-center gap-1.5 min-w-0">
                        <HabitIcon name={habit.icon} className={`w-3.5 h-3.5 shrink-0 ${habitColor(habit.color).text}`} />
                        <span className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate">{habit.title}</span>
                      </span>
                    </button>
                    {days.map((day) => {
                      const future = day.date > today;
                      const disabled = !day.scheduled || future || blocked;
                      const className = !day.scheduled
                        ? 'bg-slate-100 dark:bg-slate-800'
                        : day.checked
                          ? habitColor(habit.color).dot
                          : day.skipped
                            ? 'bg-amber-400'
                            : day.value > 0
                              ? 'bg-white border-2 border-indigo-400 text-indigo-700 dark:bg-slate-900 dark:text-indigo-300'
                              : future
                                ? 'bg-white border border-dashed border-slate-200 dark:bg-slate-900 dark:border-slate-700'
                                : 'bg-white border border-slate-300 dark:bg-slate-900 dark:border-slate-600';
                      return (
                        <button
                          key={day.date}
                          type="button"
                          disabled={disabled}
                          title={day.date}
                          aria-label={`${habit.title} ${day.date}`}
                          onClick={() => {
                            const target = Math.max(1, habit.targetCount ?? 1);
                            if (day.checked) onSetCheckIn(habit.id, day.date, null);
                            else onSetCheckIn(habit.id, day.date, { skipped: false, value: target });
                          }}
                          className={`w-8 h-8 mx-auto rounded-full text-[10px] font-bold text-white flex items-center justify-center disabled:cursor-default ${className}`}
                        >
                          {day.checked || day.value <= 0 ? '' : day.value}
                        </button>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </Card>
        </section>
      )}

      {habits.length > 0 && pane === 'progress' && (
        <section className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              aria-label="Previous month"
              onClick={() => setMonthOffset((value) => value - 1)}
              className="w-10 h-10 rounded-xl flex items-center justify-center text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <p className="text-sm font-bold text-slate-900 dark:text-white">{monthLabel}</p>
            <button
              type="button"
              aria-label="Next month"
              disabled={monthOffset >= 0}
              onClick={() => setMonthOffset((value) => Math.min(0, value + 1))}
              className="w-10 h-10 rounded-xl flex items-center justify-center text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
          {progressHabits.map((habit) => {
            const through = monthThrough < monthStart ? monthStart : monthThrough;
            const completion = habitCompletion(habit, checkIns, monthStart, through);
            const streak = habitStreak(habit, checkIns, today);
            const longest = longestStreak(habit, checkIns, today);
            const cells = monthHeatmap(habit, checkIns, heatYear, heatMonth, today);
            const linked = habit.goalId ? goals.find((goal) => goal.id === habit.goalId) : undefined;
            const linkedProgress = linked ? goalProgress(linked, habits, checkIns, today) : undefined;
            const unit = habit.schedule.type === 'times_per_week' ? 'w' : 'd';
            return (
              <Card key={habit.id} className="p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-1.5">
                      <HabitIcon name={habit.icon} className={`w-4 h-4 ${habitColor(habit.color).text}`} />
                      <span className="truncate">{habit.title}</span>
                    </p>
                    <p className="text-[11px] text-slate-500 mt-0.5">{scheduleLabel(habit)}</p>
                  </div>
                  <div className="flex items-center shrink-0">
                    <button
                      type="button"
                      aria-label={`Edit ${habit.title}`}
                      onClick={() => editHabit(habit)}
                      className="w-9 h-9 flex items-center justify-center rounded-xl text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      aria-label={`Delete ${habit.title}`}
                      onClick={() => deleteHabit(habit)}
                      className="w-9 h-9 flex items-center justify-center rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <Stat label="This month" value={`${completion.percent}%`} />
                  <Stat label="Streak" value={streak > 0 ? `${streak}${unit}` : '—'} />
                  <Stat label="Longest" value={longest > 0 ? `${longest}${unit}` : '—'} />
                </div>
                <div>
                  <div className="grid grid-cols-7 gap-1 mb-1">
                    {WEEKDAYS.map((label, index) => (
                      <span key={`${label}-${index}`} className="text-center text-[10px] font-bold text-slate-400">
                        {label}
                      </span>
                    ))}
                  </div>
                  <div className="grid grid-cols-7 gap-1">
                    {cells.map((cell) => (
                      <span
                        key={cell.date}
                        title={cell.inMonth ? `${cell.date} ${cell.state}` : undefined}
                        className={`mx-auto w-3.5 h-3.5 rounded-sm ${
                          cell.inMonth ? heatCellClass(cell.state, habit.color) : 'bg-transparent'
                        }`}
                      />
                    ))}
                  </div>
                  <p className="mt-2 text-[10px] text-slate-400">
                    {completion.done} done · {completion.skipped} skipped · {completion.scheduled} expected
                  </p>
                </div>
                {linked && linkedProgress && (
                  <p className="text-[11px] font-semibold text-violet-700 dark:text-violet-300">
                    {linked.title} · {linkedProgress.percent}%
                  </p>
                )}
              </Card>
            );
          })}
          {paused.length > 0 && (
            <QuietList title="Paused with their goal" habits={paused} onEdit={editHabit} onDelete={deleteHabit} />
          )}
          {archived.length > 0 && (
            <QuietList title="Archived" habits={archived} onEdit={editHabit} onDelete={deleteHabit} />
          )}
        </section>
      )}

      <HabitModal isOpen={modalOpen} onClose={closeModal} onSave={onSaveHabit} initialHabit={editing} goals={goals} localMusicName={localMusicName} />
    </div>
  );
};

const Stat: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="rounded-xl bg-slate-50 dark:bg-slate-800/70 px-2 py-2">
    <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{label}</p>
    <p className="text-sm font-black text-slate-900 dark:text-white">{value}</p>
  </div>
);

const QuietList: React.FC<{
  title: string;
  habits: Habit[];
  onEdit: (habit: Habit) => void;
  onDelete: (habit: Habit) => void;
}> = ({ title, habits, onEdit, onDelete }) => (
  <section className="space-y-2">
    <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">{title}</h3>
    {habits.map((habit) => (
      <Card key={habit.id} className="p-3 flex items-center justify-between gap-2">
        <p className="text-sm font-bold text-slate-700 dark:text-slate-200 truncate">{habit.title}</p>
        <div className="flex items-center shrink-0">
          <button
            type="button"
            aria-label={`Edit ${habit.title}`}
            onClick={() => onEdit(habit)}
            className="w-9 h-9 flex items-center justify-center rounded-xl text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <Pencil className="w-4 h-4" />
          </button>
          <button
            type="button"
            aria-label={`Delete ${habit.title}`}
            onClick={() => onDelete(habit)}
            className="w-9 h-9 flex items-center justify-center rounded-xl text-slate-400 hover:text-rose-600"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </Card>
    ))}
  </section>
);

interface HabitDayRowProps {
  habit: Habit;
  date: string;
  checkIns: HabitCheckIn[];
  goalName?: string;
  disabled?: boolean;
  compact?: boolean;
  onSetCheckIn: (habitId: string, date: string, patch: HabitCheckInPatch | null) => void;
  onEdit: () => void;
  onDelete: () => void;
}

export const HabitDayRow: React.FC<HabitDayRowProps> = ({
  habit,
  date,
  checkIns,
  goalName,
  disabled,
  compact = false,
  onSetCheckIn,
  onEdit,
  onDelete,
}) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const [noting, setNoting] = useState(false);
  const entry = checkInOn(habit.id, checkIns, date);
  const [note, setNote] = useState(entry?.note ?? '');
  const streak = habitStreak(habit, checkIns, date);
  const days = recentSchedule(habit, checkIns, date);
  const unit = habit.schedule.type === 'times_per_week' ? 'w' : 'd';
  const targetLabel = (habit.targetCount ?? 1) > 1 ? `${habit.targetCount} ${habit.unit || ''}`.trim() : null;

  useEffect(() => {
    setNote(entry?.note ?? '');
  }, [entry?.note]);

  const saveNote = () => {
    const trimmed = note.trim();
    setNoting(false);
    if (!trimmed && !entry) return;
    if (!trimmed && entry && !isComplete(habit, entry) && !entry.skipped) {
      onSetCheckIn(habit.id, date, null);
      return;
    }
    onSetCheckIn(habit.id, date, {
      skipped: Boolean(entry?.skipped) && !isComplete(habit, entry),
      value: entry?.skipped ? undefined : (entry?.value ?? (isComplete(habit, entry) ? 1 : 0)),
      note: trimmed || undefined,
    });
  };

  return (
    <Card className={compact ? 'p-3' : 'p-3.5'}>
      <div className="flex items-start gap-3">
        <HabitCheckControl
          habit={habit}
          entry={entry}
          disabled={disabled}
          onChange={(patch) => onSetCheckIn(habit.id, date, patch)}
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="font-bold text-sm text-slate-900 dark:text-white truncate flex items-center gap-1.5">
                <HabitIcon name={habit.icon} className={`w-3.5 h-3.5 shrink-0 ${habitColor(habit.color).text}`} />
                <span className="truncate">{habit.title}</span>
              </p>
              <div className="mt-1 flex flex-wrap items-center gap-1.5">
                {goalName && (
                  <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-violet-50 dark:bg-violet-950/40 text-violet-700 dark:text-violet-300">
                    {goalName}
                  </span>
                )}
                {targetLabel && <span className="text-[11px] font-semibold text-slate-500">{targetLabel}</span>}
                {streak > 0 && (
                  <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-600 dark:text-amber-400">
                    <Flame className="w-3.5 h-3.5" />
                    {streak}
                    {unit}
                  </span>
                )}
                <HabitSkipButton
                  habit={habit}
                  entry={entry}
                  disabled={disabled}
                  onChange={(patch) => onSetCheckIn(habit.id, date, patch)}
                />
              </div>
            </div>
            <div className="relative shrink-0">
              <button
                type="button"
                aria-label={`Actions for ${habit.title}`}
                aria-expanded={menuOpen}
                onClick={() => setMenuOpen((open) => !open)}
                className="w-9 h-9 flex items-center justify-center rounded-xl text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <MoreHorizontal className="w-4 h-4" />
              </button>
              {menuOpen && (
                <div className="absolute right-0 top-9 z-10 w-36 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-lg py-1">
                  <button
                    type="button"
                    onClick={() => {
                      setMenuOpen(false);
                      onEdit();
                    }}
                    className="w-full text-left px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setMenuOpen(false);
                      setNoting(true);
                    }}
                    className="w-full text-left px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
                  >
                    Note
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setMenuOpen(false);
                      onDelete();
                    }}
                    className="w-full text-left px-3 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                  >
                    Delete
                  </button>
                </div>
              )}
            </div>
          </div>

          {!compact && (
            <div className="mt-2 flex gap-1.5">
              {days.map((day) => {
                const letter = new Date(`${day.date}T00:00:00`).toLocaleDateString('en-US', { weekday: 'narrow' });
                const className = !day.scheduled
                  ? 'bg-slate-100 dark:bg-slate-800 text-slate-300 dark:text-slate-600'
                  : day.checked
                    ? habitColor(habit.color).solid
                    : day.skipped
                      ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300'
                      : 'bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 text-slate-500';
                const locked = !day.scheduled || day.date > date || disabled;
                if (locked) {
                  return (
                    <span
                      key={day.date}
                      title={day.date}
                      className={`w-7 h-7 rounded-full text-[10px] font-bold flex items-center justify-center ${className}`}
                    >
                      {letter}
                    </span>
                  );
                }
                return (
                  <button
                    key={day.date}
                    type="button"
                    title={day.date}
                    onClick={() => {
                      const target = Math.max(1, habit.targetCount ?? 1);
                      if (day.checked) onSetCheckIn(habit.id, day.date, null);
                      else onSetCheckIn(habit.id, day.date, { skipped: false, value: target });
                    }}
                    className={`w-7 h-7 rounded-full text-[10px] font-bold flex items-center justify-center ${className}`}
                  >
                    {letter}
                  </button>
                );
              })}
            </div>
          )}

          {entry?.note && !noting && <p className="mt-2 text-[11px] text-slate-500 dark:text-slate-400">{entry.note}</p>}
          {noting && (
            <input
              autoFocus
              value={note}
              onChange={(event) => setNote(event.target.value)}
              onBlur={saveNote}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  saveNote();
                }
              }}
              placeholder="Add a note"
              aria-label={`Note for ${habit.title}`}
              className="mt-2 w-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-1.5 text-xs text-slate-900 dark:text-white"
            />
          )}
        </div>
      </div>
    </Card>
  );
};
