import { describe, expect, it } from 'vitest';
import type { Goal, Habit, HabitCheckIn } from '../types';
import {
  addDays,
  goalProgress,
  habitCompletion,
  habitStreak,
  isDueToday,
  isScheduledOn,
  longestStreak,
  monthHeatmap,
  recentSchedule,
  weekDates,
  weekStartMonday,
  weekdayOf,
} from './habits';

const STAMP = '2026-10-01T06:30:00.000Z';

function localNoonIso(date: string): string {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(y, m - 1, d, 12, 0, 0).toISOString();
}

function goal(over: Partial<Goal> = {}): Goal {
  return {
    id: 'goal-1',
    title: 'Read more',
    startDate: '2026-10-01',
    targetDate: '2026-10-10',
    status: 'active',
    createdAt: STAMP,
    updatedAt: STAMP,
    ...over,
  };
}

function habit(over: Partial<Habit> = {}): Habit {
  return {
    id: 'habit-1',
    title: 'Read 10 pages',
    goalId: 'goal-1',
    schedule: { type: 'daily' },
    archived: false,
    createdAt: localNoonIso('2026-10-01'),
    updatedAt: STAMP,
    ...over,
  };
}

function checks(habitId: string, dates: string[]): HabitCheckIn[] {
  return dates.map((date) => ({
    id: `checkin-${habitId}-${date}`,
    habitId,
    date,
    createdAt: STAMP,
    updatedAt: STAMP,
  }));
}

function firstWeekday(day: number, from = '2026-10-01'): string {
  let cursor = from;
  for (let i = 0; i < 14; i += 1) {
    if (weekdayOf(cursor) === day) return cursor;
    cursor = addDays(cursor, 1);
  }
  return from;
}

describe('habit schedule and streak', () => {
  it('treats weekdays and custom days as scheduled, and skips days before the habit existed', () => {
    const daily = habit();
    const weekdays = habit({ schedule: { type: 'weekdays' } });
    const monday = firstWeekday(1);
    const sunday = firstWeekday(0);
    expect(isScheduledOn(daily, '2026-10-01')).toBe(true);
    expect(isScheduledOn(daily, '2026-09-30')).toBe(false);
    expect(isScheduledOn(weekdays, monday)).toBe(true);
    expect(isScheduledOn(weekdays, sunday)).toBe(false);
    expect(
      isScheduledOn(habit({ schedule: { type: 'custom', daysOfWeek: [1, 3] } }), monday)
    ).toBe(true);
    expect(
      isScheduledOn(habit({ schedule: { type: 'custom', daysOfWeek: [1, 3] } }), firstWeekday(2))
    ).toBe(false);
  });

  it('counts a daily streak and keeps it alive when today is still open', () => {
    const item = habit();
    const today = '2026-10-05';
    expect(habitStreak(item, checks('habit-1', ['2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04', '2026-10-05']), today)).toBe(5);
    expect(habitStreak(item, checks('habit-1', ['2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04']), today)).toBe(4);
    expect(habitStreak(item, checks('habit-1', ['2026-10-01', '2026-10-02', '2026-10-03']), today)).toBe(0);
  });

  it('walks weekday streaks across the weekend', () => {
    const saturday = firstWeekday(6);
    const item = habit({
      schedule: { type: 'weekdays' },
      createdAt: localNoonIso(addDays(saturday, -21)),
    });
    const friday = addDays(saturday, -1);
    const thursday = addDays(saturday, -2);
    expect(weekdayOf(friday)).toBe(5);
    expect(
      habitStreak(item, checks('habit-1', [thursday, friday]), saturday)
    ).toBe(2);

    const monday = addDays(saturday, 2);
    expect(weekdayOf(monday)).toBe(1);
    expect(habitStreak(item, checks('habit-1', [thursday, friday]), monday)).toBe(2);
    expect(habitStreak(item, checks('habit-1', [thursday]), monday)).toBe(0);
  });

  it('returns a 7-day row ending today', () => {
    const row = recentSchedule(habit(), checks('habit-1', ['2026-10-05']), '2026-10-05');
    expect(row).toHaveLength(7);
    expect(row[6]).toMatchObject({ date: '2026-10-05', scheduled: true, checked: true });
    expect(row[0].date).toBe('2026-09-29');
    expect(row[0].scheduled).toBe(false);
  });
});

describe('goal consistency', () => {
  const item = habit();
  const today = '2026-10-05';

  it('is the share of scheduled days checked through today', () => {
    const progress = goalProgress(
      goal(),
      [item],
      checks('habit-1', ['2026-10-01', '2026-10-03', '2026-10-05']),
      today
    );
    expect(progress.scheduled).toBe(5);
    expect(progress.done).toBe(3);
    expect(progress.percent).toBe(60);
    expect(progress.streak).toBe(1);
  });

  it('caps the window at the target date and ignores days before the goal starts', () => {
    const throughTarget = goalProgress(
      goal(),
      [item],
      checks('habit-1', ['2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04', '2026-10-05']),
      '2026-10-20'
    );
    expect(throughTarget.scheduled).toBe(10);
    expect(throughTarget.done).toBe(5);
    expect(throughTarget.percent).toBe(50);

    const beforeStart = goalProgress(goal(), [item], checks('habit-1', ['2026-10-01']), '2026-09-20');
    expect(beforeStart.percent).toBe(0);
    expect(beforeStart.scheduled).toBe(0);
  });

  it('starts counting a habit on the day it was created', () => {
    const late = habit({ createdAt: localNoonIso('2026-10-04') });
    const progress = goalProgress(
      goal(),
      [late],
      checks('habit-1', ['2026-10-04']),
      today
    );
    expect(progress.scheduled).toBe(2);
    expect(progress.done).toBe(1);
    expect(progress.percent).toBe(50);
  });

  it('leaves archived habits and paused goals out of the percent', () => {
    const archived = habit({ id: 'habit-archived', archived: true });
    const active = habit({ id: 'habit-open', goalId: 'goal-1' });
    const progress = goalProgress(
      goal(),
      [archived, active],
      [
        ...checks('habit-archived', ['2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04', '2026-10-05']),
        ...checks('habit-open', ['2026-10-01']),
      ],
      today
    );
    expect(progress.scheduled).toBe(5);
    expect(progress.done).toBe(1);
    expect(progress.percent).toBe(20);

    const paused = goalProgress(
      goal({ status: 'paused' }),
      [item],
      checks('habit-1', ['2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04', '2026-10-05']),
      today
    );
    expect(paused.percent).toBe(0);
    expect(paused.streak).toBe(0);

    const resumed = goalProgress(
      goal({ status: 'active' }),
      [item],
      checks('habit-1', ['2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04', '2026-10-05']),
      today
    );
    expect(resumed.percent).toBe(100);
  });

  it('counts a goal streak only when every linked habit scheduled that day is checked', () => {
    const second = habit({ id: 'habit-2', title: 'Walk' });
    const both = [
      ...checks('habit-1', ['2026-10-01', '2026-10-02', '2026-10-03']),
      ...checks('habit-2', ['2026-10-01', '2026-10-02', '2026-10-03']),
    ];
    expect(goalProgress(goal(), [item, second], both, '2026-10-03').streak).toBe(3);

    const todayOpen = [
      ...checks('habit-1', ['2026-10-01', '2026-10-02', '2026-10-03']),
      ...checks('habit-2', ['2026-10-01', '2026-10-02']),
    ];
    expect(goalProgress(goal(), [item, second], todayOpen, '2026-10-03').streak).toBe(2);

    const brokenYesterday = [
      ...checks('habit-1', ['2026-10-01', '2026-10-02', '2026-10-03']),
      ...checks('habit-2', ['2026-10-01', '2026-10-03']),
    ];
    expect(goalProgress(goal(), [item, second], brokenYesterday, '2026-10-03').streak).toBe(1);

    const broken = [
      ...checks('habit-1', ['2026-10-01', '2026-10-03']),
      ...checks('habit-2', ['2026-10-01']),
    ];
    expect(goalProgress(goal(), [item, second], broken, '2026-10-03').streak).toBe(0);
    expect(goalProgress(goal(), [], [], '2026-10-03').streak).toBe(0);
  });

  it('skips weekend days for weekday habits when building the goal streak', () => {
    const saturday = firstWeekday(6, '2026-10-01');
    const friday = addDays(saturday, -1);
    const thursday = addDays(saturday, -2);
    const reader = habit({
      schedule: { type: 'weekdays' },
      createdAt: localNoonIso(addDays(thursday, -10)),
    });
    const progress = goalProgress(
      goal({ startDate: addDays(thursday, -10), targetDate: '2026-10-31' }),
      [reader],
      checks('habit-1', [thursday, friday]),
      saturday
    );
    expect(progress.streak).toBe(2);
  });

  it('hides archived habits and habits on a paused goal from today', () => {
    const today = '2026-10-05';
    const active = habit();
    const archived = habit({ id: 'old', archived: true });
    const pausedHabit = habit({ id: 'paused-habit', goalId: 'goal-paused' });
    const goals = [goal(), goal({ id: 'goal-paused', status: 'paused' })];
    expect(isDueToday(active, today, goals)).toBe(true);
    expect(isDueToday(archived, today, goals)).toBe(false);
    expect(isDueToday(pausedHabit, today, goals)).toBe(false);
    expect(isDueToday(habit({ id: 'free', goalId: undefined }), today, goals)).toBe(true);
    expect(isDueToday(active, today, [goal({ status: 'completed' })])).toBe(false);
  });
});

describe('habit completion and longest streak', () => {
  const today = '2026-10-05';

  it('keeps a daily streak across a skip and ignores a note-only record', () => {
    const item = habit();
    const skip = checks('habit-1', ['2026-10-04']).map((entry) => ({ ...entry, skipped: true }));
    const done = checks('habit-1', ['2026-10-01', '2026-10-02', '2026-10-03']);
    expect(habitStreak(item, [...done, ...skip], today)).toBe(4);
    expect(longestStreak(item, [...done, ...skip], today)).toBe(4);

    const noteOnly = checks('habit-1', ['2026-10-04']).map((entry) => ({ ...entry, value: 0, note: 'later' }));
    expect(habitStreak(item, [...done, ...noteOnly], today)).toBe(0);
  });

  it('reports completion without counting skips as done', () => {
    const stats = habitCompletion(
      habit(),
      [
        ...checks('habit-1', ['2026-10-01', '2026-10-02', '2026-10-03']),
        ...checks('habit-1', ['2026-10-04']).map((entry) => ({ ...entry, skipped: true })),
      ],
      '2026-10-01',
      today
    );
    expect(stats.scheduled).toBe(5);
    expect(stats.done).toBe(3);
    expect(stats.skipped).toBe(1);
    expect(stats.percent).toBe(75);
  });

  it('counts times-per-week quotas, with the open week in grace', () => {
    const monday = weekStartMonday(today);
    const previous = addDays(monday, -7);
    const item = habit({
      schedule: { type: 'times_per_week', timesPerWeek: 3 },
      createdAt: localNoonIso(addDays(previous, -7)),
    });
    const met = weekDates(previous).slice(0, 3);
    expect(habitStreak(item, checks('habit-1', met), monday)).toBe(1);
    expect(longestStreak(item, checks('habit-1', met), monday)).toBe(1);
    expect(isDueToday(item, monday, [], [])).toBe(true);

    const wednesday = weekDates(monday)[2];
    const logged = [...weekDates(monday).slice(0, 2), wednesday];
    expect(isDueToday(item, wednesday, [], checks('habit-1', logged))).toBe(true);
    const thursday = weekDates(monday)[3];
    expect(isDueToday(item, thursday, [], checks('habit-1', logged.slice(0, 3)))).toBe(false);

    const stats = habitCompletion(item, checks('habit-1', met), previous, addDays(previous, 6));
    expect(stats.scheduled).toBe(3);
    expect(stats.done).toBe(3);
    expect(stats.percent).toBe(100);
  });

  it('builds a Monday-aligned month grid', () => {
    const cells = monthHeatmap(habit(), checks('habit-1', ['2026-10-01']), 2026, 10, today);
    expect(cells.length % 7).toBe(0);
    expect(cells[0].date).toBe(weekStartMonday('2026-10-01'));
    const first = cells.find((cell) => cell.date === '2026-10-01');
    expect(first).toMatchObject({ inMonth: true, state: 'done' });
    const missed = cells.find((cell) => cell.date === '2026-10-02');
    expect(missed?.state).toBe('missed');
    const open = cells.find((cell) => cell.date === today);
    expect(open?.state).toBe('pending');
  });
});
