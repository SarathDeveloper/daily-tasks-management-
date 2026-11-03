import type { FinanceTransaction, MonthlyBudget, Task } from '../types';
import { fromPaise, toPaise } from './money';

/** What the Android home-screen widgets render. Kept small: it is stored as one JSON string. */
export interface WidgetSnapshot {
  date: string; // YYYY-MM-DD the snapshot describes
  tasks: { title: string; time?: string; done: boolean }[];
  remaining: number;
  total: number;
  spentToday: number;
  spentMonth: number;
  monthBudget: number;
}

const MAX_TASKS = 5;

export function buildWidgetSnapshot(
  today: string,
  tasks: Pick<Task, 'title' | 'time' | 'completed' | 'date'>[],
  transactions: Pick<FinanceTransaction, 'type' | 'amount' | 'date'>[],
  budgets: Pick<MonthlyBudget, 'month' | 'limit'>[]
): WidgetSnapshot {
  const todays = tasks.filter((task) => task.date === today);
  // Open tasks first, by time; done tasks fill any leftover rows.
  const ordered = [...todays].sort(
    (a, b) =>
      Number(a.completed) - Number(b.completed) || (a.time || '99:99').localeCompare(b.time || '99:99')
  );
  const month = today.slice(0, 7);
  let todayPaise = 0;
  let monthPaise = 0;
  for (const tx of transactions) {
    if (tx.type !== 'expense' || !tx.date?.startsWith(month)) continue;
    const paise = toPaise(tx.amount);
    monthPaise += paise;
    if (tx.date === today) todayPaise += paise;
  }
  return {
    date: today,
    tasks: ordered.slice(0, MAX_TASKS).map((task) => ({
      title: task.title,
      time: task.time || undefined,
      done: task.completed,
    })),
    remaining: todays.filter((task) => !task.completed).length,
    total: todays.length,
    spentToday: fromPaise(todayPaise),
    spentMonth: fromPaise(monthPaise),
    monthBudget: budgets.find((budget) => budget.month === month)?.limit ?? 0,
  };
}
