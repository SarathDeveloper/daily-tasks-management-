/**
 * Pure planning logic for task reminders.
 *
 * Everything here is platform-agnostic so the same rules drive the native
 * alarm scheduler and the browser fallback: the schedule is *derived* from the
 * current task list every time, never appended to, which is what keeps the
 * phone's pending alarms in sync with edits, deletes, snoozes and completion.
 */
import type { Goal, Habit, HabitCheckIn, NotificationSettings, SoundType, Task } from '../types';
import {
  addDays,
  checkInMap,
  habitBlockReason,
  isComplete,
  isScheduledOn,
  isSkipped,
  localDateString,
  quotaForWeek,
  todayDateString,
  weekDates,
  weekStartMonday,
} from './habits';
import { resolveReminderDelivery } from './sounds';

/** Do not schedule further out than this; keeps the alarm list small. */
export const MAX_SCHEDULE_HORIZON_DAYS = 60;
/** Upper bound on simultaneously pending alarms. */
export const MAX_SCHEDULED_REMINDERS = 200;
/** Ignore reminders that are already within this window of "now". */
const MIN_LEAD_MS = 30_000;

export interface ReminderPlan {
  taskId: string;
  notificationId: number;
  fireAt: Date;
  title: string;
  body: string;
  /** The task's own chime choice; drives the Android notification channel. */
  sound: SoundType;
  /** Loop on the alarm bridge instead of a one-shot notification. */
  ring: boolean;
  /** Task id, or `habit:{id}:{date}` for a habit day. */
  occurrenceId: string;
  /** Set when this plan belongs to a habit rather than a task. */
  habitId?: string;
}

/**
 * Mirrors the overnight-aware window check used by the in-app notification
 * service. Returns true when `at` falls inside the configured quiet hours.
 */
export function isQuietHours(settings: NotificationSettings, at: Date = new Date()): boolean {
  if (!settings.quietHours?.enabled) return false;
  const currentMins = at.getHours() * 60 + at.getMinutes();

  const [startH, startM] = settings.quietHours.start.split(':').map(Number);
  const [endH, endM] = settings.quietHours.end.split(':').map(Number);
  if ([startH, startM, endH, endM].some((n) => !Number.isFinite(n))) return false;

  const startMins = startH * 60 + startM;
  const endMins = endH * 60 + endM;

  if (startMins === endMins) return false;
  if (startMins < endMins) return currentMins >= startMins && currentMins < endMins;
  // Overnight window, e.g. 22:00 -> 07:00.
  return currentMins >= startMins || currentMins < endMins;
}

/** Combines a `YYYY-MM-DD` task date and `HH:mm` time into a local Date. */
export function parseTaskDateTime(date: string, time?: string): Date | null {
  if (!date) return null;
  const safeTime = time && /^\d{1,2}:\d{2}$/.test(time) ? time : '09:00';
  const [year, month, day] = date.split('-').map(Number);
  const [hours, minutes] = safeTime.split(':').map(Number);
  if ([year, month, day, hours, minutes].some((n) => !Number.isFinite(n))) return null;
  const parsed = new Date(year, month - 1, day, hours, minutes, 0, 0);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/** Stable positive 31-bit id so a task always maps to the same alarm slot. */
export function hashNotificationId(taskId: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < taskId.length; i++) {
    hash ^= taskId.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 1) % 2147483647;
}

/**
 * Build the full list of reminders that should exist right now.
 * Sorted soonest-first and capped at `MAX_SCHEDULED_REMINDERS`.
 */
export function buildReminderPlans(
  tasks: Task[],
  settings: NotificationSettings,
  now: Date = new Date(),
  habits: Habit[] = [],
  checkIns: HabitCheckIn[] = [],
  goals: Goal[] = [],
  hasMusic = Boolean(settings.localMusicName)
): ReminderPlan[] {
  const nowMs = now.getTime();
  const horizonMs = nowMs + MAX_SCHEDULE_HORIZON_DAYS * 24 * 60 * 60 * 1000;
  const usedIds = new Set<number>();
  const plans: ReminderPlan[] = [];

  for (const task of tasks) {
    if (task.completed) continue;
    if (!task.reminder?.enabled) continue;

    const dueAt = parseTaskDateTime(task.date, task.time);
    if (!dueAt) continue;

    const leadMinutes = Math.min(
      Math.max(task.reminder.remindBeforeMinutes ?? 0, 0),
      24 * 60
    );

    let fireMs = dueAt.getTime() - leadMinutes * 60_000;

    const snoozedUntil = task.reminder.snoozedUntil
      ? Date.parse(task.reminder.snoozedUntil)
      : NaN;
    if (Number.isFinite(snoozedUntil) && snoozedUntil > nowMs && snoozedUntil > fireMs) {
      fireMs = snoozedUntil;
    }

    if (fireMs < nowMs + MIN_LEAD_MS) continue;
    if (fireMs > horizonMs) continue;

    const fireAt = new Date(fireMs);
    if (isQuietHours(settings, fireAt)) continue;

    const delivery = resolveReminderDelivery(
      task.reminder.sound,
      task.reminder.alarm,
      hasMusic,
      settings.defaultSound
    );
    plans.push({
      taskId: task.id,
      notificationId: reserveNotificationId(hashNotificationId(task.id), usedIds),
      fireAt,
      title: task.title,
      body: task.time ? `${task.time} · ${task.category}` : task.category,
      sound: delivery.sound,
      ring: delivery.ring,
      occurrenceId: task.id,
    });
  }

  appendHabitPlans(plans, usedIds, habits, checkIns, goals, settings, nowMs, horizonMs, hasMusic);

  plans.sort((a, b) => a.fireAt.getTime() - b.fireAt.getTime());
  return plans.slice(0, MAX_SCHEDULED_REMINDERS);
}

function appendHabitPlans(
  plans: ReminderPlan[],
  usedIds: Set<number>,
  habits: Habit[],
  checkIns: HabitCheckIn[],
  goals: Goal[],
  settings: NotificationSettings,
  nowMs: number,
  horizonMs: number,
  hasMusic: boolean
): void {
  const today = todayDateString(new Date(nowMs));
  for (const habit of habits) {
    if (!habit.reminder?.enabled || !habit.reminder.time) continue;
    if (habitBlockReason(habit, goals)) continue;
    const snoozedUntil = habit.reminder.snoozedUntil ? Date.parse(habit.reminder.snoozedUntil) : NaN;
    const snoozeDay =
      Number.isFinite(snoozedUntil) && snoozedUntil > nowMs
        ? localDateString(new Date(snoozedUntil))
        : '';
    const map = checkInMap(habit.id, checkIns);
    const plannedThisWeek = new Map<string, number>();
    let day = today;
    for (let guard = 0; guard < MAX_SCHEDULE_HORIZON_DAYS; guard += 1) {
      if (isScheduledOn(habit, day)) {
        const entry = map.get(day);
        const satisfied = isComplete(habit, entry) || isSkipped(entry);
        if (!satisfied) {
          let allowed = true;
          let monday = '';
          if (habit.schedule.type === 'times_per_week') {
            monday = weekStartMonday(day);
            const completes = weekDates(monday).filter((date) => isComplete(habit, map.get(date))).length;
            const planned = plannedThisWeek.get(monday) ?? 0;
            const quota = quotaForWeek(habit, monday);
            allowed = quota > 0 && completes + planned < quota;
          }
          if (allowed) {
            if (snoozeDay && day < snoozeDay) {
              day = addDays(day, 1);
              continue;
            }
            const fireAt = parseTaskDateTime(day, habit.reminder.time);
            let fireMs = fireAt?.getTime() ?? NaN;
            if (fireAt && snoozeDay === day && snoozedUntil > fireMs) fireMs = snoozedUntil;
            const adjusted = Number.isFinite(fireMs) ? new Date(fireMs) : null;
            if (
              adjusted &&
              fireMs >= nowMs + MIN_LEAD_MS &&
              fireMs <= horizonMs &&
              !isQuietHours(settings, adjusted)
            ) {
              const delivery = resolveReminderDelivery(
                habit.reminder.sound,
                habit.reminder.alarm,
                hasMusic,
                settings.defaultSound
              );
              plans.push({
                taskId: `habit:${habit.id}`,
                habitId: habit.id,
                notificationId: reserveNotificationId(hashNotificationId(`habit:${habit.id}:${day}`), usedIds),
                fireAt: adjusted,
                title: habit.title,
                body: `Habit · ${habit.reminder.time}`,
                sound: delivery.sound,
                ring: delivery.ring,
                occurrenceId: `habit:${habit.id}:${day}`,
              });
              if (habit.schedule.type === 'times_per_week' && monday) {
                plannedThisWeek.set(monday, (plannedThisWeek.get(monday) ?? 0) + 1);
              }
            }
          }
        }
      }
      day = addDays(day, 1);
    }
  }
}

/** Linear probing avoids two tasks colliding on the same notification id. */
function reserveNotificationId(initial: number, used: Set<number>): number {
  let id = initial === 0 ? 1 : initial;
  while (used.has(id)) {
    id = (id + 1) % 2147483647;
    if (id === 0) id = 1;
  }
  used.add(id);
  return id;
}

/** Human-readable summary for the settings screen, e.g. "in 12 min". */
export function describeNextReminder(
  tasks: Task[],
  settings: NotificationSettings,
  habits: Habit[] = [],
  checkIns: HabitCheckIn[] = [],
  goals: Goal[] = []
): string | null {
  const [next] = buildReminderPlans(tasks, settings, new Date(), habits, checkIns, goals);
  if (!next) return null;
  const minutes = Math.round((next.fireAt.getTime() - Date.now()) / 60_000);
  const habit = next.habitId ? habits.find((item) => item.id === next.habitId) : undefined;
  const task = tasks.find((item) => item.id === next.taskId);
  const title = habit?.title ?? task?.title ?? next.title;
  if (minutes <= 1) return `${title} - in under a minute`;
  if (minutes < 60) return `${title} - in ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${title} - in ${hours} h`;
  return `${title} - in ${Math.round(hours / 24)} d`;
}
