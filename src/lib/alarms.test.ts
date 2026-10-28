import { describe, expect, it } from 'vitest';
import type { Alarm, Habit, NotificationSettings, Task } from '../types';
import { buildReminderPlans, isQuietHours } from './reminders';
import { resolveReminderDelivery } from './sounds';
import { afterAlarmDismiss, alarmDueAt, nextAlarmFire, upcomingRings } from './alarms';

const settings: NotificationSettings = {
  browserNotificationsEnabled: true,
  soundEnabled: true,
  speechEnabled: false,
  defaultSound: 'chime',
  quietHours: { enabled: true, start: '22:00', end: '07:00' },
};

function alarm(over: Partial<Alarm> = {}): Alarm {
  return {
    id: 'alarm-1',
    label: 'Wake',
    time: '07:00',
    enabled: true,
    daysOfWeek: [],
    sound: 'chime',
    snoozeMinutes: 10,
    createdAt: '2026-10-01T00:00:00.000Z',
    updatedAt: '2026-10-01T00:00:00.000Z',
    ...over,
  };
}

function taskAt(time: string, over: Partial<Task['reminder']> = {}): Task {
  return {
    id: 'task-1',
    title: 'Standup',
    completed: false,
    date: '2026-10-28',
    time,
    priority: 'medium',
    category: 'Work',
    subtasks: [],
    recurrence: { type: 'none' },
    reminder: { enabled: true, remindBeforeMinutes: 0, sound: 'chime', ...over },
    createdAt: '2026-10-01T00:00:00.000Z',
    updatedAt: '2026-10-01T00:00:00.000Z',
  };
}

describe('resolveReminderDelivery', () => {
  it('falls back to a short chime when local music has no file', () => {
    expect(resolveReminderDelivery('music', false, false)).toEqual({ sound: 'chime', ring: false });
  });

  it('rings the saved song until dismissed', () => {
    expect(resolveReminderDelivery('music', false, true)).toEqual({ sound: 'music', ring: true });
  });

  it('loops a built-in sound only when the alarm flag is on', () => {
    expect(resolveReminderDelivery('bell', true, false)).toEqual({ sound: 'bell', ring: true });
    expect(resolveReminderDelivery('bell', false, false)).toEqual({ sound: 'bell', ring: false });
  });

  it('does not loop voice', () => {
    expect(resolveReminderDelivery('voice', false, true)).toEqual({ sound: 'voice', ring: false });
    expect(resolveReminderDelivery('voice', true, true)).toEqual({ sound: 'chime', ring: true });
  });
});

describe('clock alarms', () => {
  const morning = new Date(2026, 9, 28, 6, 0, 0);
  const evening = new Date(2026, 9, 28, 18, 0, 0);

  it('rings a once alarm later today, or tomorrow after that time has passed', () => {
    expect(nextAlarmFire(alarm(), morning)?.getDate()).toBe(28);
    expect(nextAlarmFire(alarm(), morning)?.getHours()).toBe(7);
    expect(nextAlarmFire(alarm(), evening)?.getDate()).toBe(29);
  });

  it('uses the next selected weekday', () => {
    const friday = nextAlarmFire(alarm({ daysOfWeek: [1, 3, 5], time: '07:00' }), evening);
    expect(friday?.getDay()).toBe(5);
  });

  it('lets a snooze replace the schedule and ignores quiet hours', () => {
    const snoozed = alarm({
      time: '23:00',
      snoozedUntil: new Date(2026, 9, 28, 23, 10, 0).toISOString(),
    });
    const fire = nextAlarmFire(snoozed, new Date(2026, 9, 28, 23, 0, 0));
    expect(fire?.getHours()).toBe(23);
    expect(fire?.getMinutes()).toBe(10);
    expect(isQuietHours(settings, fire!)).toBe(true);
    const rings = upcomingRings([], [snoozed], new Date(2026, 9, 28, 23, 0, 0));
    expect(rings).toHaveLength(1);
    expect(rings[0].kind).toBe('alarm');
  });

  it('turns a once alarm off after dismiss and keeps a repeating one', () => {
    expect(afterAlarmDismiss(alarm()).enabled).toBe(false);
    expect(afterAlarmDismiss(alarm({ daysOfWeek: [1, 2, 3, 4, 5] })).enabled).toBe(true);
  });

  it('is due only inside the two minute window', () => {
    const item = alarm({ time: '07:00' });
    expect(alarmDueAt(item, new Date(2026, 9, 28, 7, 1, 0))?.getHours()).toBe(7);
    expect(alarmDueAt(item, new Date(2026, 9, 28, 7, 4, 0))).toBeNull();
  });
});

describe('reminder ring routing', () => {
  const now = new Date(2026, 9, 28, 8, 0, 0);

  it('keeps quiet hours on a reminder that rings until dismissed', () => {
    const plans = buildReminderPlans([taskAt('23:30', { alarm: true })], settings, now);
    expect(plans).toHaveLength(0);
  });

  it('marks an alarm-style reminder for the ring bridge and leaves a chime on the short path', () => {
    const ringing = buildReminderPlans([taskAt('09:00', { alarm: true, sound: 'bell' })], settings, now);
    const chime = buildReminderPlans([taskAt('09:00')], settings, now);
    expect(ringing[0].ring).toBe(true);
    expect(ringing[0].sound).toBe('bell');
    expect(chime[0].ring).toBe(false);
    expect(upcomingRings(ringing, [], now)).toHaveLength(1);
    expect(upcomingRings(chime, [], now)).toHaveLength(0);
  });

  it('moves a snoozed habit ring to the snooze time', () => {
    const habit: Habit = {
      id: 'habit-1',
      title: 'Read',
      schedule: { type: 'daily' },
      archived: false,
      reminder: {
        enabled: true,
        time: '09:00',
        sound: 'music',
        alarm: true,
        snoozedUntil: new Date(2026, 9, 28, 9, 10, 0).toISOString(),
      },
      createdAt: '2026-10-01T00:00:00.000Z',
      updatedAt: '2026-10-01T00:00:00.000Z',
    };
    const plans = buildReminderPlans([], { ...settings, quietHours: { ...settings.quietHours, enabled: false }, localMusicName: 'Song.mp3' }, now, [habit]);
    expect(plans[0].ring).toBe(true);
    expect(plans[0].sound).toBe('music');
    expect(plans[0].fireAt.getHours()).toBe(9);
    expect(plans[0].fireAt.getMinutes()).toBe(10);
    expect(plans[0].occurrenceId).toBe('habit:habit-1:2026-10-28');
  });
});
