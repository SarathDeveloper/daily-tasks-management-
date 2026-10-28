import React from 'react';
import { Check, Minus, Plus } from 'lucide-react';
import type { Habit, HabitCheckIn, HabitCheckInPatch } from '../types';
import { isComplete, isSkipped } from '../lib/habits';
import { habitColor } from '../lib/habitStyle';

interface HabitCheckControlProps {
  habit: Habit;
  entry?: HabitCheckIn;
  disabled?: boolean;
  onChange: (patch: HabitCheckInPatch | null) => void;
  size?: 'md' | 'sm';
}

export const HabitCheckControl: React.FC<HabitCheckControlProps> = ({
  habit,
  entry,
  disabled,
  onChange,
  size = 'md',
}) => {
  const target = Math.max(1, habit.targetCount ?? 1);
  const complete = isComplete(habit, entry);
  const skipped = isSkipped(entry);
  const value = entry?.skipped ? 0 : (entry?.value ?? (complete ? target : 0));
  const note = entry?.note;

  if (target > 1) {
    return (
      <div className={`inline-flex items-center gap-1 shrink-0 ${disabled ? 'opacity-60' : ''}`}>
        <button
          type="button"
          disabled={disabled || value <= 0}
          aria-label={`Decrease ${habit.title}`}
          onClick={() => {
            if (value <= 1) onChange(null);
            else onChange({ skipped: false, note, value: value - 1 });
          }}
          className="w-8 h-8 rounded-full border border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 flex items-center justify-center disabled:opacity-40"
        >
          <Minus className="w-3.5 h-3.5" />
        </button>
        <span className="min-w-[3.2rem] text-center text-xs font-bold text-slate-700 dark:text-slate-200">
          {Math.min(value, target)}/{target}
        </span>
        <button
          type="button"
          disabled={disabled || value >= target}
          aria-label={`Increase ${habit.title}`}
          onClick={() => onChange({ skipped: false, note, value: value + 1 })}
          className={`w-8 h-8 rounded-full flex items-center justify-center disabled:opacity-40 ${habitColor(habit.color).solid}`}
        >
          <Plus className="w-3.5 h-3.5" />
        </button>
      </div>
    );
  }

  const box = size === 'sm' ? 'w-8 h-8' : 'w-11 h-11';
  const className = complete
    ? habitColor(habit.color).solid
    : skipped
      ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300'
      : 'border-2 border-slate-300 dark:border-slate-600 text-transparent hover:border-indigo-400';

  return (
    <button
      type="button"
      disabled={disabled}
      aria-label={complete ? `Uncheck ${habit.title}` : `Check ${habit.title}`}
      aria-pressed={complete}
      onClick={() => {
        if (complete) onChange(null);
        else onChange({ skipped: false, note, value: 1 });
      }}
      className={`${box} shrink-0 rounded-full flex items-center justify-center transition-colors disabled:opacity-50 ${className}`}
    >
      <Check className={size === 'sm' ? 'w-4 h-4' : 'w-5 h-5'} />
    </button>
  );
};

export const HabitSkipButton: React.FC<{
  habit: Habit;
  entry?: HabitCheckIn;
  disabled?: boolean;
  onChange: (patch: HabitCheckInPatch | null) => void;
}> = ({ habit, entry, disabled, onChange }) => {
  if (isComplete(habit, entry)) return null;
  const skipped = isSkipped(entry);
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => {
        if (skipped) onChange(null);
        else onChange({ skipped: true, note: entry?.note });
      }}
      className={`text-[11px] font-bold px-2 py-0.5 rounded-full disabled:opacity-50 ${
        skipped
          ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300'
          : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'
      }`}
    >
      {skipped ? 'Skipped' : 'Skip'}
    </button>
  );
};
