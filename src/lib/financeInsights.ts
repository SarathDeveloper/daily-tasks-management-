import type { FinanceTransaction } from '../types';

const toISODate = (d: Date) => d.toISOString().split('T')[0];

export interface DayData {
  dateStr: string;
  dayLabel: string;
  expense: number;
  income: number;
}

/**
 * Last 7 days (including today) expense/income per day, oldest first.
 */
export function getLast7DaysData(transactions: FinanceTransaction[]): DayData[] {
  const days: DayData[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateStr = toISODate(d);
    const dayTx = transactions.filter((t) => t.date === dateStr);
    const expense = dayTx
      .filter((t) => t.type === 'expense')
      .reduce((s, t) => s + t.amount, 0);
    const income = dayTx
      .filter((t) => t.type === 'income')
      .reduce((s, t) => s + t.amount, 0);
    days.push({
      dateStr,
      dayLabel: d.toLocaleDateString('en-IN', { weekday: 'short' }),
      expense,
      income,
    });
  }
  return days;
}

/**
 * Previous 7 days (days 7-13 ago) totals for comparison.
 */
export function getPrev7DaysTotals(transactions: FinanceTransaction[]): {
  expense: number;
  income: number;
} {
  let expense = 0;
  let income = 0;
  for (let i = 7; i <= 13; i++) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateStr = toISODate(d);
    const dayTx = transactions.filter((t) => t.date === dateStr);
    expense += dayTx
      .filter((t) => t.type === 'expense')
      .reduce((s, t) => s + t.amount, 0);
    income += dayTx
      .filter((t) => t.type === 'income')
      .reduce((s, t) => s + t.amount, 0);
  }
  return { expense, income };
}

export interface DailySpendForMonth {
  date: string; // YYYY-MM-DD
  day: number;
  amount: number;
}

/**
 * Daily expense totals for each day in the given month.
 */
export function getDailySpendForMonth(
  transactions: FinanceTransaction[],
  month: string
): DailySpendForMonth[] {
  const [y, m] = month.split('-').map(Number);
  const daysInMonth = new Date(y, m, 0).getDate();
  const result: DailySpendForMonth[] = [];
  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = `${month}-${String(day).padStart(2, '0')}`;
    const amount = transactions
      .filter((t) => t.date === dateStr && t.type === 'expense')
      .reduce((s, t) => s + t.amount, 0);
    result.push({ date: dateStr, day, amount });
  }
  return result;
}

export interface CategoryCompare {
  category: string;
  current: number;
  prev: number;
  pctChange: number | null; // null when prev is 0
}

export interface MonthOverMonthCompare {
  overall: {
    current: number;
    prev: number;
    pctChange: number | null;
  };
  byCategory: CategoryCompare[];
}

/**
 * Compare current month expenses vs previous month, overall + per category.
 */
export function getMonthOverMonthCompare(
  transactions: FinanceTransaction[],
  currentMonth: string,
  prevMonth: string
): MonthOverMonthCompare {
  const currentTx = transactions.filter(
    (t) => t.date.startsWith(currentMonth) && t.type === 'expense'
  );
  const prevTx = transactions.filter(
    (t) => t.date.startsWith(prevMonth) && t.type === 'expense'
  );

  const sumBy = (list: FinanceTransaction[]) =>
    list.reduce((s, t) => s + t.amount, 0);

  const current = sumBy(currentTx);
  const prev = sumBy(prevTx);
  const pctChange =
    prev > 0 ? Math.round(((current - prev) / prev) * 100) : null;

  const allCategories = Array.from(
    new Set([
      ...currentTx.map((t) => t.category),
      ...prevTx.map((t) => t.category),
    ])
  );

  const byCategory: CategoryCompare[] = allCategories
    .map((category) => {
      const c = sumBy(currentTx.filter((t) => t.category === category));
      const p = sumBy(prevTx.filter((t) => t.category === category));
      return {
        category,
        current: c,
        prev: p,
        pctChange: p > 0 ? Math.round(((c - p) / p) * 100) : null,
      };
    })
    .filter((c) => c.current > 0 || c.prev > 0)
    .sort((a, b) => {
      const aDelta = Math.abs((a.current - a.prev));
      const bDelta = Math.abs((b.current - b.prev));
      return bDelta - aDelta;
    });

  return { overall: { current, prev, pctChange }, byCategory };
}

export interface SavingsProgress {
  saved: number;
  target: number;
  pct: number;
  met: boolean;
}

/**
 * Savings progress for a month: saved = max(0, net), pct = saved / target.
 */
export function getSavingsProgress(
  monthlyNet: number,
  target: number
): SavingsProgress {
  const saved = Math.max(0, monthlyNet);
  const pct = target > 0 ? Math.min(100, Math.round((saved / target) * 100)) : 0;
  return { saved, target, pct, met: target > 0 && saved >= target };
}
