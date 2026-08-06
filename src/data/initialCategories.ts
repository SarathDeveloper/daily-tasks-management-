import { Category } from '../types';

export const INITIAL_CATEGORIES: Category[] = [
  { id: 'cat-1', name: 'Work', color: 'bg-indigo-100 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-500/40', icon: 'Briefcase' },
  { id: 'cat-2', name: 'Personal', color: 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-500/40', icon: 'User' },
  { id: 'cat-3', name: 'Health & Fitness', color: 'bg-rose-100 dark:bg-rose-500/20 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-500/40', icon: 'Heart' },
  { id: 'cat-4', name: 'Study & Learning', color: 'bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-500/40', icon: 'BookOpen' },
  { id: 'cat-5', name: 'Focus & Habits', color: 'bg-sky-100 dark:bg-sky-500/20 text-sky-700 dark:text-sky-300 border-sky-200 dark:border-sky-500/40', icon: 'Zap' },
];
