import type { HabitColor } from '../types';

export const HABIT_COLOR_IDS: HabitColor[] = ['indigo', 'emerald', 'amber', 'rose', 'sky', 'violet'];

export interface HabitColorClasses {
  solid: string;
  dot: string;
  soft: string;
  text: string;
  swatch: string;
}

export const HABIT_COLOR_CLASS: Record<HabitColor, HabitColorClasses> = {
  indigo: {
    solid: 'bg-indigo-600 text-white',
    dot: 'bg-indigo-600',
    soft: 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300',
    text: 'text-indigo-600 dark:text-indigo-400',
    swatch: 'bg-indigo-600',
  },
  emerald: {
    solid: 'bg-emerald-600 text-white',
    dot: 'bg-emerald-600',
    soft: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300',
    text: 'text-emerald-600 dark:text-emerald-400',
    swatch: 'bg-emerald-600',
  },
  amber: {
    solid: 'bg-amber-500 text-white',
    dot: 'bg-amber-500',
    soft: 'bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300',
    text: 'text-amber-600 dark:text-amber-400',
    swatch: 'bg-amber-500',
  },
  rose: {
    solid: 'bg-rose-600 text-white',
    dot: 'bg-rose-600',
    soft: 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300',
    text: 'text-rose-600 dark:text-rose-400',
    swatch: 'bg-rose-600',
  },
  sky: {
    solid: 'bg-sky-600 text-white',
    dot: 'bg-sky-600',
    soft: 'bg-sky-50 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300',
    text: 'text-sky-600 dark:text-sky-400',
    swatch: 'bg-sky-600',
  },
  violet: {
    solid: 'bg-violet-600 text-white',
    dot: 'bg-violet-600',
    soft: 'bg-violet-50 text-violet-700 dark:bg-violet-950/40 dark:text-violet-300',
    text: 'text-violet-600 dark:text-violet-400',
    swatch: 'bg-violet-600',
  },
};

export function habitColor(color?: HabitColor): HabitColorClasses {
  return HABIT_COLOR_CLASS[color ?? 'indigo'];
}

export function heatCellClass(state: 'off' | 'done' | 'skipped' | 'missed' | 'pending', color?: HabitColor): string {
  if (state === 'done') return habitColor(color).dot;
  if (state === 'skipped') return 'bg-amber-400';
  if (state === 'missed') return 'bg-rose-300 dark:bg-rose-900';
  if (state === 'pending') return 'bg-white border border-slate-300 dark:bg-slate-900 dark:border-slate-600';
  return 'bg-slate-100 dark:bg-slate-800';
}
