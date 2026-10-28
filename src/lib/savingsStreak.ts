import type { SavingsStreakState } from '../types';
import { todayString } from './ledger';

/** A dated rupee amount. Savings entries and qualifying transfers both match. */
export interface SavingsAmount {
  date: string;
  amount: number;
}

const todayStr = () => todayString();

const addDays = (dateStr: string, days: number): string => {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(y, (m || 1) - 1, (d || 1) + days);
  const yy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, '0');
  const dd = String(dt.getDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
};

/**
 * Build a Set of unique dates that have at least one savings amount greater than 0.
 */
export function savedDates(entries: SavingsAmount[]): Set<string> {
  const set = new Set<string>();
  for (const e of entries) {
    if (e.amount > 0) set.add(e.date);
  }
  return set;
}

/**
 * Calculate the current consecutive-day savings streak ending today (or yesterday with grace).
 *
 * A day "counts" if there is at least one amount greater than 0 for that date.
 * If today is not saved, the streak still counts from yesterday so today stays open.
 */
export function calculateStreak(entries: SavingsAmount[]): number {
  const dates = savedDates(entries);
  const today = todayStr();
  const yesterday = addDays(today, -1);

  if (!dates.has(today) && !dates.has(yesterday)) return 0;

  let cursor = dates.has(today) ? today : yesterday;
  let streak = 0;
  let guard = 0;
  while (guard < 10000 && dates.has(cursor)) {
    streak += 1;
    cursor = addDays(cursor, -1);
    guard += 1;
  }
  return streak;
}

/**
 * Compute the longest streak ever achieved from the entries (consecutive days with savings).
 */
export function calculateLongestStreak(entries: SavingsAmount[]): number {
  const dates = savedDates(entries);
  if (dates.size === 0) return 0;
  const sorted = Array.from(dates).sort();
  let longest = 1;
  let run = 1;
  for (let i = 1; i < sorted.length; i++) {
    const prev = addDays(sorted[i], -1);
    if (prev === sorted[i - 1]) {
      run += 1;
    } else {
      run = 1;
    }
    if (run > longest) longest = run;
  }
  return longest;
}

/**
 * Derive the full streak state from entries (current + longest + last saved date).
 */
export function deriveStreakState(entries: SavingsAmount[]): SavingsStreakState {
  const dates = savedDates(entries);
  const sorted = Array.from(dates).sort();
  return {
    currentStreak: calculateStreak(entries),
    longestStreak: calculateLongestStreak(entries),
    lastSavedDate: sorted.length > 0 ? sorted[sorted.length - 1] : undefined,
  };
}

/**
 * Get the last N days (ending today) as a list of { date, amount, saved } entries
 * for heatmap rendering. Amount is the sum of all savings amounts for that date.
 */
export function getLastNDaysHeatmap(
  entries: SavingsAmount[],
  days = 30
): { date: string; amount: number; saved: boolean }[] {
  const today = todayStr();
  const byDate = new Map<string, number>();
  for (const e of entries) {
    if (e.amount <= 0) continue;
    byDate.set(e.date, (byDate.get(e.date) || 0) + e.amount);
  }
  const result: { date: string; amount: number; saved: boolean }[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const date = addDays(today, -i);
    const amount = byDate.get(date) || 0;
    result.push({ date, amount, saved: amount > 0 });
  }
  return result;
}

/**
 * Sum savings amounts for a given month (YYYY-MM).
 */
export function getMonthlySavingsTotal(entries: SavingsAmount[], month: string): number {
  return entries
    .filter((e) => e.date.startsWith(month) && e.amount > 0)
    .reduce((s, e) => s + e.amount, 0);
}

/**
 * Count distinct days with savings in a given month (YYYY-MM).
 */
export function getMonthlySavedDays(entries: SavingsAmount[], month: string): number {
  const days = new Set<string>();
  for (const e of entries) {
    if (e.date.startsWith(month) && e.amount > 0) days.add(e.date);
  }
  return days.size;
}

/**
 * Intensity bucket (0-4) for a given amount, used for heatmap coloring.
 */
export function heatmapIntensity(amount: number, max: number): number {
  if (amount <= 0 || max <= 0) return 0;
  const ratio = amount / max;
  if (ratio >= 0.75) return 4;
  if (ratio >= 0.5) return 3;
  if (ratio >= 0.25) return 2;
  return 1;
}
