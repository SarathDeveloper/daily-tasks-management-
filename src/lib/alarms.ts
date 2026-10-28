import type { Alarm, Habit, SoundType, Task } from '../types';
import type { AlarmEvent } from '../services/dayflowAlarm';
import { localDateString } from './habits';
import { hashNotificationId, type ReminderPlan } from './reminders';

export const RING_WINDOW_MS = 120_000;
const DAY_MS = 24 * 60 * 60 * 1000;

export interface RingSession {
  id: string;
  kind: 'task' | 'habit' | 'alarm';
  title: string;
  body: string;
  sound: SoundType;
  snoozeMinutes: number;
}

export interface RingPlan {
  id: string;
  notificationId: number;
  at: number;
  title: string;
  body: string;
  sound: string;
  kind: 'task' | 'habit' | 'alarm';
  snoozeMinutes: number;
  time?: string;
  daysOfWeek?: number[];
}

function parseClock(time: string): { hours: number; minutes: number } | null {
  if (!/^\d{1,2}:\d{2}$/.test(time)) return null;
  const [hours, minutes] = time.split(':').map(Number);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;
  return { hours, minutes };
}

function atTime(base: Date, hours: number, minutes: number, dayOffset = 0): Date {
  return new Date(base.getFullYear(), base.getMonth(), base.getDate() + dayOffset, hours, minutes, 0, 0);
}

/** Next future ring for an enabled alarm. Snooze wins over the weekly schedule. Quiet hours do not apply. */
export function nextAlarmFire(alarm: Alarm, now: Date): Date | null {
  if (!alarm.enabled) return null;
  const snooze = alarm.snoozedUntil ? Date.parse(alarm.snoozedUntil) : NaN;
  if (Number.isFinite(snooze) && snooze > now.getTime()) return new Date(snooze);

  const clock = parseClock(alarm.time);
  if (!clock) return null;
  const days = alarm.daysOfWeek ?? [];
  for (let offset = 0; offset < 8; offset += 1) {
    const candidate = atTime(now, clock.hours, clock.minutes, offset);
    if (candidate.getTime() <= now.getTime()) continue;
    if (days.length > 0 && !days.includes(candidate.getDay())) continue;
    return candidate;
  }
  return null;
}

/** A ring that should be showing now, within the last two minutes. */
export function alarmDueAt(alarm: Alarm, now: Date, windowMs = RING_WINDOW_MS): Date | null {
  if (!alarm.enabled) return null;
  const snooze = alarm.snoozedUntil ? Date.parse(alarm.snoozedUntil) : NaN;
  if (Number.isFinite(snooze) && snooze > now.getTime()) return null;
  if (Number.isFinite(snooze) && now.getTime() - snooze <= windowMs && snooze <= now.getTime()) {
    return new Date(snooze);
  }

  const clock = parseClock(alarm.time);
  if (!clock) return null;
  const days = alarm.daysOfWeek ?? [];
  const acknowledged = alarm.acknowledgedAt ? Date.parse(alarm.acknowledgedAt) : NaN;
  for (const offset of [0, -1]) {
    const candidate = atTime(now, clock.hours, clock.minutes, offset);
    const age = now.getTime() - candidate.getTime();
    if (age < 0 || age > windowMs) continue;
    if (days.length > 0 && !days.includes(candidate.getDay())) continue;
    if (Number.isFinite(acknowledged) && Math.abs(acknowledged - candidate.getTime()) <= windowMs + 60_000) continue;
    return candidate;
  }
  return null;
}

export function afterAlarmDismiss(alarm: Alarm, now = new Date()): Alarm {
  const stamp = now.toISOString();
  if ((alarm.daysOfWeek?.length ?? 0) === 0) {
    return { ...alarm, enabled: false, snoozedUntil: undefined, acknowledgedAt: stamp, updatedAt: stamp };
  }
  return { ...alarm, snoozedUntil: undefined, acknowledgedAt: stamp, updatedAt: stamp };
}

export function afterAlarmSnooze(alarm: Alarm, minutes: number, now = new Date()): Alarm {
  const until = new Date(now.getTime() + minutes * 60_000).toISOString();
  return { ...alarm, enabled: true, snoozedUntil: until, acknowledgedAt: undefined, updatedAt: until };
}

export function upcomingRings(plans: ReminderPlan[], alarms: Alarm[], now: Date): RingPlan[] {
  const used = new Set<number>();
  const rings: RingPlan[] = [];
  for (const plan of plans) {
    if (!plan.ring) continue;
    used.add(plan.notificationId);
    rings.push({
      id: plan.occurrenceId,
      notificationId: plan.notificationId,
      at: plan.fireAt.getTime(),
      title: plan.title,
      body: plan.body,
      sound: plan.sound === 'voice' ? 'chime' : plan.sound,
      kind: plan.habitId ? 'habit' : 'task',
      snoozeMinutes: 10,
    });
  }

  const horizon = now.getTime() + 60 * DAY_MS;
  for (const alarm of alarms) {
    const fire = nextAlarmFire(alarm, now);
    if (!fire || fire.getTime() > horizon) continue;
    let notificationId = hashNotificationId(`alarm:${alarm.id}`);
    if (notificationId === 0) notificationId = 1;
    while (used.has(notificationId)) {
      notificationId = (notificationId + 1) % 2147483647;
      if (notificationId === 0) notificationId = 1;
    }
    used.add(notificationId);
    rings.push({
      id: alarm.id,
      notificationId,
      at: fire.getTime(),
      title: alarm.label || 'Alarm',
      body: alarm.time,
      sound: alarm.sound === 'voice' ? 'chime' : alarm.sound,
      kind: 'alarm',
      snoozeMinutes: alarm.snoozeMinutes > 0 ? alarm.snoozeMinutes : 10,
      time: alarm.time,
      daysOfWeek: alarm.daysOfWeek ?? [],
    });
  }
  return rings;
}

export function nextEnabledAlarm(alarms: Alarm[], now = new Date()): { alarm: Alarm; fireAt: Date } | null {
  let best: { alarm: Alarm; fireAt: Date } | null = null;
  for (const alarm of alarms) {
    const fireAt = nextAlarmFire(alarm, now);
    if (!fireAt) continue;
    if (!best || fireAt.getTime() < best.fireAt.getTime()) best = { alarm, fireAt };
  }
  return best;
}

function snoozeStamp(event: AlarmEvent): string {
  return new Date(event.at + event.snoozeMinutes * 60_000).toISOString();
}

export function applyTaskRingEvent(tasks: Task[], event: AlarmEvent): Task[] {
  return tasks.map((task) => {
    if (task.id !== event.id) return task;
    if (event.type === 'snooze') {
      return {
        ...task,
        reminder: { ...task.reminder, snoozedUntil: snoozeStamp(event) },
        updatedAt: new Date(event.at).toISOString(),
      };
    }
    return {
      ...task,
      reminder: {
        ...task.reminder,
        lastNotifiedAt: new Date(event.at).toISOString(),
        snoozedUntil: undefined,
      },
      updatedAt: new Date(event.at).toISOString(),
    };
  });
}

export function applyHabitRingEvent(habits: Habit[], event: AlarmEvent): Habit[] {
  const match = event.id.match(/^habit:(.+):\d{4}-\d{2}-\d{2}$/);
  const habitId = match?.[1];
  if (!habitId) return habits;
  return habits.map((habit) => {
    if (habit.id !== habitId || !habit.reminder) return habit;
    if (event.type === 'snooze') {
      return {
        ...habit,
        reminder: { ...habit.reminder, snoozedUntil: snoozeStamp(event) },
        updatedAt: new Date(event.at).toISOString(),
      };
    }
    return {
      ...habit,
      reminder: {
        ...habit.reminder,
        lastNotifiedAt: new Date(event.at).toISOString(),
        snoozedUntil: undefined,
      },
      updatedAt: new Date(event.at).toISOString(),
    };
  });
}

export function applyAlarmRingEvent(alarms: Alarm[], event: AlarmEvent): Alarm[] {
  return alarms.map((alarm) => {
    if (alarm.id !== event.id) return alarm;
    const now = new Date(event.at);
    return event.type === 'snooze'
      ? afterAlarmSnooze(alarm, event.snoozeMinutes, now)
      : afterAlarmDismiss(alarm, now);
  });
}

export function formatAlarmWhen(fireAt: Date, now = new Date()): string {
  const minutes = Math.round((fireAt.getTime() - now.getTime()) / 60_000);
  const clock = fireAt.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  if (minutes <= 1) return `${clock} · now`;
  if (minutes < 60) return `${clock} · in ${minutes} min`;
  const sameDay = localDateString(fireAt) === localDateString(now);
  if (sameDay) return clock;
  const day = fireAt.toLocaleDateString([], { weekday: 'short' });
  return `${day} ${clock}`;
}

export function daySummary(days: number[]): string {
  if (days.length === 0) return 'Once';
  const labels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  if (days.length === 7) return 'Every day';
  const weekdays = [1, 2, 3, 4, 5];
  if (weekdays.every((day) => days.includes(day)) && days.length === 5) return 'Weekdays';
  return days
    .slice()
    .sort((a, b) => a - b)
    .map((day) => labels[day] ?? '')
    .filter(Boolean)
    .join(' ');
}

export function ringSoundLabel(sound: SoundType): string {
  if (sound === 'music') return 'Local music';
  if (sound === 'voice') return 'Voice';
  return sound;
}
