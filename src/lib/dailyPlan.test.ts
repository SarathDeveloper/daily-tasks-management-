import { beforeEach, describe, expect, it } from 'vitest';
import type { Task } from '../types';
import {
  DAILY_PLAN_KEY,
  emptyPlan,
  loadDailyPlan,
  planCandidates,
  planPhase,
  resolveTopTasks,
  saveDailyPlan,
  tomorrowOf,
  unfinishedToday,
} from './dailyPlan';

const today = '2026-11-03';

function task(id: string, partial: Partial<Task>): Task {
  return {
    id,
    title: id,
    completed: false,
    date: today,
    priority: 'medium',
    category: 'Work',
    subtasks: [],
    recurrence: { type: 'none' },
    reminder: { enabled: false, remindBeforeMinutes: 0, sound: 'chime' },
    createdAt: '',
    updatedAt: '',
    ...partial,
  };
}

const tasks = [
  task('old-low', { date: '2026-10-30', priority: 'low' }),
  task('old-urgent', { date: '2026-10-30', priority: 'urgent' }),
  task('yesterday', { date: '2026-11-02' }),
  task('today-late', { time: '17:00' }),
  task('today-early', { time: '08:00' }),
  task('today-done', { completed: true }),
  task('in-3-days', { date: '2026-11-06' }),
  task('in-4-days', { date: '2026-11-07' }),
];

describe('planCandidates', () => {
  it('splits open tasks into overdue, today and the next three days', () => {
    const groups = planCandidates(tasks, today);
    expect(groups.overdue.map((t) => t.id)).toEqual(['old-urgent', 'old-low', 'yesterday']);
    expect(groups.today.map((t) => t.id)).toEqual(['today-early', 'today-late']);
    expect(groups.upcoming.map((t) => t.id)).toEqual(['in-3-days']);
  });
});

describe('evening helpers', () => {
  it('lists unfinished tasks for today by time', () => {
    expect(unfinishedToday(tasks, today).map((t) => t.id)).toEqual(['today-early', 'today-late']);
  });

  it('works out tomorrow across month ends', () => {
    expect(tomorrowOf('2026-11-30')).toBe('2026-12-01');
    expect(tomorrowOf('2026-12-31')).toBe('2027-01-01');
  });
});

describe('plan state', () => {
  beforeEach(() => {
    const store = new Map<string, string>();
    globalThis.localStorage = {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => void store.set(key, value),
      removeItem: (key: string) => void store.delete(key),
      clear: () => store.clear(),
      key: () => null,
      length: 0,
    } as Storage;
  });

  it('keeps picks for the same day and starts fresh on a new day', () => {
    saveDailyPlan({ ...emptyPlan(today), topTaskIds: ['a'], planned: true });
    expect(loadDailyPlan(today)).toMatchObject({ topTaskIds: ['a'], planned: true });
    expect(loadDailyPlan('2026-11-04')).toEqual(emptyPlan('2026-11-04'));
    expect(localStorage.getItem(DAILY_PLAN_KEY)).toContain(today);
  });

  it('drops picks whose task was deleted', () => {
    const plan = { ...emptyPlan(today), topTaskIds: ['today-late', 'gone', 'yesterday'] };
    expect(resolveTopTasks(plan, tasks).map((t) => t.id)).toEqual(['today-late', 'yesterday']);
  });

  it('picks the card for the time of day', () => {
    expect(planPhase(emptyPlan(today), 9)).toBe('morning');
    expect(planPhase({ ...emptyPlan(today), planned: true }, 9)).toBe('planned');
    expect(planPhase(emptyPlan(today), 19)).toBe('evening');
    expect(planPhase({ ...emptyPlan(today), reviewed: true }, 19)).toBe('done');
  });
});
