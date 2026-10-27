import React, { useEffect, useState } from 'react';
import { Check, Flame, Pencil, Plus, Repeat, Target, Trash2 } from 'lucide-react';
import type { Goal, Habit, HabitCheckIn } from '../types';
import {
  habitStreak,
  isDueToday,
  recentSchedule,
  todayDateString,
} from '../lib/habits';
import { Button } from './ui/Button';
import { Card } from './ui/Card';
import { HabitModal } from './HabitModal';

interface HabitsViewProps {
  goals: Goal[];
  habits: Habit[];
  checkIns: HabitCheckIn[];
  onToggleCheckIn: (habitId: string, date: string) => void;
  onSaveHabit: (habit: Partial<Habit>) => void;
  onDeleteHabit: (id: string) => void;
  onOpenGoals: () => void;
  onRegisterClose: (close: (() => void) | null) => void;
}

const byTitle = (a: Habit, b: Habit) => a.title.localeCompare(b.title);

export const HabitsView: React.FC<HabitsViewProps> = ({
  goals,
  habits,
  checkIns,
  onToggleCheckIn,
  onSaveHabit,
  onDeleteHabit,
  onOpenGoals,
  onRegisterClose,
}) => {
  const today = todayDateString();
  const [editing, setEditing] = useState<Habit | null>(null);
  const [creating, setCreating] = useState(false);
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

  const due = habits.filter((habit) => isDueToday(habit, today, goals)).sort(byTitle);
  const pausedGoalIds = new Set(goals.filter((goal) => goal.status === 'paused').map((goal) => goal.id));
  const paused = habits
    .filter((habit) => !habit.archived && habit.goalId && pausedGoalIds.has(habit.goalId))
    .sort(byTitle);
  const later = habits
    .filter(
      (habit) =>
        !habit.archived &&
        !isDueToday(habit, today, goals) &&
        !(habit.goalId && pausedGoalIds.has(habit.goalId))
    )
    .sort(byTitle);
  const archived = habits.filter((habit) => habit.archived).sort(byTitle);
  const goalName = (goalId?: string) => goals.find((goal) => goal.id === goalId)?.title;

  const closeModal = () => {
    setCreating(false);
    setEditing(null);
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
            Check today&apos;s habits. Linked ones fill their goal.
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

      {due.length > 0 && (
        <section className="space-y-2">
          <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Due today
          </h3>
          {due.map((habit) => (
            <HabitRow
              key={habit.id}
              habit={habit}
              today={today}
              checkIns={checkIns}
              goalName={goalName(habit.goalId)}
              showCheck
              onToggleCheckIn={onToggleCheckIn}
              onEdit={() => {
                setCreating(false);
                setEditing(habit);
              }}
              onDelete={() => {
                if (!window.confirm(`Delete habit "${habit.title}"?`)) return;
                onDeleteHabit(habit.id);
              }}
            />
          ))}
        </section>
      )}

      {habits.length > 0 && due.length === 0 && later.length === 0 && paused.length === 0 && (
        <Card className="p-4">
          <p className="text-sm text-slate-600 dark:text-slate-300">Nothing is due today.</p>
        </Card>
      )}

      {paused.length > 0 && (
        <section className="space-y-2">
          <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Paused with their goal
          </h3>
          {paused.map((habit) => (
            <HabitRow
              key={habit.id}
              habit={habit}
              today={today}
              checkIns={checkIns}
              goalName={goalName(habit.goalId)}
              showCheck={false}
              onToggleCheckIn={onToggleCheckIn}
              onEdit={() => {
                setCreating(false);
                setEditing(habit);
              }}
              onDelete={() => {
                if (!window.confirm(`Delete habit "${habit.title}"?`)) return;
                onDeleteHabit(habit.id);
              }}
            />
          ))}
        </section>
      )}

      {later.length > 0 && (
        <section className="space-y-2">
          <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Not scheduled today
          </h3>
          {later.map((habit) => (
            <HabitRow
              key={habit.id}
              habit={habit}
              today={today}
              checkIns={checkIns}
              goalName={goalName(habit.goalId)}
              showCheck={false}
              onToggleCheckIn={onToggleCheckIn}
              onEdit={() => {
                setCreating(false);
                setEditing(habit);
              }}
              onDelete={() => {
                if (!window.confirm(`Delete habit "${habit.title}"?`)) return;
                onDeleteHabit(habit.id);
              }}
            />
          ))}
        </section>
      )}

      {archived.length > 0 && (
        <section className="space-y-2">
          <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Archived
          </h3>
          {archived.map((habit) => (
            <HabitRow
              key={habit.id}
              habit={habit}
              today={today}
              checkIns={checkIns}
              goalName={goalName(habit.goalId)}
              showCheck={false}
              onToggleCheckIn={onToggleCheckIn}
              onEdit={() => {
                setCreating(false);
                setEditing(habit);
              }}
              onDelete={() => {
                if (!window.confirm(`Delete habit "${habit.title}"?`)) return;
                onDeleteHabit(habit.id);
              }}
            />
          ))}
        </section>
      )}

      <HabitModal
        isOpen={modalOpen}
        onClose={closeModal}
        onSave={onSaveHabit}
        initialHabit={editing}
        goals={goals}
      />
    </div>
  );
};

interface HabitRowProps {
  habit: Habit;
  today: string;
  checkIns: HabitCheckIn[];
  goalName?: string;
  showCheck: boolean;
  onToggleCheckIn: (habitId: string, date: string) => void;
  onEdit: () => void;
  onDelete: () => void;
}

const HabitRow: React.FC<HabitRowProps> = ({
  habit,
  today,
  checkIns,
  goalName,
  showCheck,
  onToggleCheckIn,
  onEdit,
  onDelete,
}) => {
  const streak = habitStreak(habit, checkIns, today);
  const days = recentSchedule(habit, checkIns, today);
  const checkedToday = days.some((day) => day.date === today && day.checked);

  return (
    <Card className="p-3.5">
      <div className="flex items-start gap-3">
        {showCheck ? (
          <button
            type="button"
            onClick={() => onToggleCheckIn(habit.id, today)}
            aria-label={checkedToday ? `Uncheck ${habit.title}` : `Check ${habit.title}`}
            className={`w-11 h-11 shrink-0 rounded-full flex items-center justify-center transition-colors ${
              checkedToday
                ? 'bg-indigo-600 text-white'
                : 'border-2 border-slate-300 dark:border-slate-600 text-transparent hover:border-indigo-400'
            }`}
          >
            <Check className="w-5 h-5" />
          </button>
        ) : (
          <div className="w-11 h-11 shrink-0 rounded-full bg-slate-100 dark:bg-slate-800" />
        )}

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="font-bold text-sm text-slate-900 dark:text-white truncate">{habit.title}</p>
              <div className="mt-1 flex flex-wrap items-center gap-1.5">
                {goalName && (
                  <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-violet-50 dark:bg-violet-950/40 text-violet-700 dark:text-violet-300">
                    {goalName}
                  </span>
                )}
                {streak > 0 && (
                  <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-600 dark:text-amber-400">
                    <Flame className="w-3.5 h-3.5" />
                    {streak}d
                  </span>
                )}
                {habit.archived && (
                  <span className="text-[11px] font-semibold text-slate-500">Archived</span>
                )}
              </div>
            </div>
            <div className="flex items-center shrink-0">
              <button
                type="button"
                onClick={onEdit}
                aria-label={`Edit ${habit.title}`}
                className="w-9 h-9 flex items-center justify-center rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <Pencil className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={onDelete}
                aria-label={`Delete ${habit.title}`}
                className="w-9 h-9 flex items-center justify-center rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="mt-2 flex gap-1.5">
            {days.map((day) => {
              const letter = new Date(`${day.date}T00:00:00`).toLocaleDateString('en-US', {
                weekday: 'narrow',
              });
              const className = !day.scheduled
                ? 'bg-slate-100 dark:bg-slate-800 text-slate-300 dark:text-slate-600'
                : day.checked
                  ? 'bg-indigo-600 text-white'
                  : 'bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 text-slate-500';
              const lockedToday = !showCheck && day.date === today;
              if (!day.scheduled || lockedToday) {
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
                  onClick={() => onToggleCheckIn(habit.id, day.date)}
                  className={`w-7 h-7 rounded-full text-[10px] font-bold flex items-center justify-center ${className}`}
                >
                  {letter}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </Card>
  );
};
