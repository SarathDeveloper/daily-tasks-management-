import React from 'react';
import { Repeat } from 'lucide-react';
import type { Goal, Habit, HabitCheckIn, HabitCheckInPatch } from '../types';
import { checkInOn, habitBlockReason, isComplete, isDueToday, isScheduledOn, todayDateString } from '../lib/habits';
import { Card } from './ui/Card';
import { HabitDayRow } from './HabitsView';

interface TodayHabitsCardProps {
  date: string;
  goals: Goal[];
  habits: Habit[];
  checkIns: HabitCheckIn[];
  onSetCheckIn: (habitId: string, date: string, patch: HabitCheckInPatch | null) => void;
  onEditHabit: (habit: Habit) => void;
  onDeleteHabit: (id: string) => void;
  onOpenHabits: () => void;
}

export const TodayHabitsCard: React.FC<TodayHabitsCardProps> = ({
  date,
  goals,
  habits,
  checkIns,
  onSetCheckIn,
  onEditHabit,
  onDeleteHabit,
  onOpenHabits,
}) => {
  if (habits.length === 0) return null;
  const today = todayDateString();
  const future = date > today;
  const due = habits.filter((habit) => {
    if (habitBlockReason(habit, goals)) return false;
    if (date === today) return isDueToday(habit, date, goals, checkIns);
    return isScheduledOn(habit, date);
  });
  const doneCount = due.filter((habit) => isComplete(habit, checkInOn(habit.id, checkIns, date))).length;

  return (
    <section className="space-y-2" aria-label="Habits due">
      <div className="flex items-center justify-between gap-2 px-0.5">
        <p className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
          <Repeat className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
          Habits · {doneCount} of {due.length}
        </p>
        <button
          type="button"
          onClick={onOpenHabits}
          className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400"
        >
          Open
        </button>
      </div>
      {due.length === 0 ? (
        <Card className="p-3">
          <p className="text-sm text-slate-500 dark:text-slate-400">No habits due.</p>
        </Card>
      ) : (
        due.map((habit) => (
          <HabitDayRow
            key={habit.id}
            habit={habit}
            date={date}
            checkIns={checkIns}
            goalName={goals.find((goal) => goal.id === habit.goalId)?.title}
            disabled={future || Boolean(habitBlockReason(habit, goals))}
            compact
            onSetCheckIn={onSetCheckIn}
            onEdit={() => onEditHabit(habit)}
            onDelete={() => {
              if (!window.confirm(`Delete habit "${habit.title}"?`)) return;
              onDeleteHabit(habit.id);
            }}
          />
        ))
      )}
    </section>
  );
};
