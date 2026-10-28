import { describe, expect, it } from 'vitest';
import type { Goal, Habit, HabitCheckIn, NotificationSettings } from '../types';
import { addDays, localDateString } from './habits';
import { buildReminderPlans } from './reminders';

const settings: NotificationSettings = {
  browserNotificationsEnabled: true,
  soundEnabled: true,
  speechEnabled: false,
  defaultSound: 'chime',
  quietHours: { enabled: false, start: '22:00', end: '07:00' },
};

function habit(): Habit {
  return {
    id: 'habit-1',
    title: 'Read',
    schedule: { type: 'daily' },
    archived: false,
    reminder: { enabled: true, time: '15:00', sound: 'chime' },
    createdAt: new Date(2026, 9, 1, 12, 0, 0).toISOString(),
    updatedAt: new Date(2026, 9, 1, 12, 0, 0).toISOString(),
  };
}

function check(date: string): HabitCheckIn {
  return {
    id: `checkin-habit-1-${date}`,
    habitId: 'habit-1',
    date,
    createdAt: '2026-10-01T00:00:00.000Z',
    updatedAt: '2026-10-01T00:00:00.000Z',
  };
}

describe('habit reminders', () => {
  const now = new Date(2026, 9, 28, 8, 0, 0);
  const today = localDateString(now);
  const item = habit();

  it('schedules a due habit that has not been checked', () => {
    const plans = buildReminderPlans([], settings, now, [item], [], []);
    expect(plans[0]?.habitId).toBe('habit-1');
    expect(localDateString(plans[0].fireAt)).toBe(today);
    expect(plans[0].fireAt.getHours()).toBe(15);
  });

  it('skips a habit that is already checked and schedules the next day', () => {
    const plans = buildReminderPlans([], settings, now, [item], [check(today)], []);
    expect(plans.some((plan) => localDateString(plan.fireAt) === today)).toBe(false);
    expect(localDateString(plans[0].fireAt)).toBe(addDays(today, 1));
  });

  it('does not remind a habit on a paused goal', () => {
    const goal: Goal = {
      id: 'goal-1',
      title: 'Read more',
      startDate: '2026-10-01',
      targetDate: '2026-12-31',
      status: 'paused',
      createdAt: '2026-10-01T00:00:00.000Z',
      updatedAt: '2026-10-01T00:00:00.000Z',
    };
    const linked = { ...item, goalId: 'goal-1' };
    expect(buildReminderPlans([], settings, now, [linked], [], [goal])).toHaveLength(0);
  });
});
