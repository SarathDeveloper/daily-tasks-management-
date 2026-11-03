import { describe, expect, it } from 'vitest';
import { buildWidgetSnapshot } from './widgetSnapshot';

const today = '2026-11-03';

describe('buildWidgetSnapshot', () => {
  it('lists open tasks first by time, then done ones, capped at five', () => {
    const tasks = [
      { title: 'Done early', time: '07:00', completed: true, date: today },
      { title: 'Late', time: '18:00', completed: false, date: today },
      { title: 'No time', completed: false, date: today },
      { title: 'Morning', time: '09:00', completed: false, date: today },
      { title: 'Tomorrow', time: '08:00', completed: false, date: '2026-11-04' },
      { title: 'A', time: '10:00', completed: false, date: today },
      { title: 'B', time: '11:00', completed: false, date: today },
    ];
    const snapshot = buildWidgetSnapshot(today, tasks, [], []);
    expect(snapshot.tasks.map((t) => t.title)).toEqual(['Morning', 'A', 'B', 'Late', 'No time']);
    expect(snapshot.total).toBe(6);
    expect(snapshot.remaining).toBe(5);
  });

  it('sums spending for today and the month, ignoring income and transfers', () => {
    const transactions = [
      { type: 'expense' as const, amount: 0.1, date: today },
      { type: 'expense' as const, amount: 0.2, date: today },
      { type: 'expense' as const, amount: 100, date: '2026-11-01' },
      { type: 'expense' as const, amount: 999, date: '2026-10-31' },
      { type: 'income' as const, amount: 5000, date: today },
      { type: 'transfer' as const, amount: 700, date: today },
    ];
    const snapshot = buildWidgetSnapshot(today, [], transactions, [
      { month: '2026-10', limit: 1 },
      { month: '2026-11', limit: 2000 },
    ]);
    expect(snapshot.spentToday).toBe(0.3);
    expect(snapshot.spentMonth).toBe(100.3);
    expect(snapshot.monthBudget).toBe(2000);
  });
});
