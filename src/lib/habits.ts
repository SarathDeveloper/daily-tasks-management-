import type { Goal, Habit, HabitCheckIn, HabitSchedule } from '../types';

export function localDateString(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function todayDateString(now: Date = new Date()): string {
  return localDateString(now);
}

export function addDays(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(y, (m || 1) - 1, d || 1);
  date.setDate(date.getDate() + days);
  return localDateString(date);
}

export function eachDate(start: string, end: string): string[] {
  if (!start || !end || end < start) return [];
  const dates: string[] = [];
  let cursor = start;
  let guard = 0;
  while (cursor <= end && guard < 10000) {
    dates.push(cursor);
    cursor = addDays(cursor, 1);
    guard += 1;
  }
  return dates;
}

export function weekdayOf(dateStr: string): number {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1).getDay();
}

/** Calendar day the habit began, in local time. */
export function habitStartDate(habit: Habit): string {
  const parsed = new Date(habit.createdAt);
  if (Number.isNaN(parsed.getTime())) return habit.createdAt.slice(0, 10);
  return localDateString(parsed);
}

export function matchesSchedule(schedule: HabitSchedule, dateStr: string): boolean {
  const day = weekdayOf(dateStr);
  if (schedule.type === 'daily') return true;
  if (schedule.type === 'weekdays') return day >= 1 && day <= 5;
  return (schedule.daysOfWeek ?? []).includes(day);
}

/** True when this calendar day is one the habit expects a check-in. */
export function isScheduledOn(habit: Habit, dateStr: string): boolean {
  if (dateStr < habitStartDate(habit)) return false;
  return matchesSchedule(habit.schedule, dateStr);
}

export function checkInDates(habitId: string, checkIns: HabitCheckIn[]): Set<string> {
  const dates = new Set<string>();
  for (const entry of checkIns) {
    if (entry.habitId === habitId) dates.add(entry.date);
  }
  return dates;
}

function previousScheduledDate(habit: Habit, beforeDate: string): string | null {
  const start = habitStartDate(habit);
  let cursor = addDays(beforeDate, -1);
  let guard = 0;
  while (cursor >= start && guard < 10000) {
    if (matchesSchedule(habit.schedule, cursor)) return cursor;
    cursor = addDays(cursor, -1);
    guard += 1;
  }
  return null;
}

/**
 * Consecutive scheduled days checked.
 * If today is scheduled and still unchecked, the streak stays alive from the
 * previous scheduled day (today is still in progress).
 */
export function habitStreak(habit: Habit, checkIns: HabitCheckIn[], today: string): number {
  if (habit.archived) return 0;
  const checked = checkInDates(habit.id, checkIns);
  const start = habitStartDate(habit);
  if (today < start) return 0;

  const todayScheduled = matchesSchedule(habit.schedule, today);
  let cursor: string | null;
  if (todayScheduled && checked.has(today)) {
    cursor = today;
  } else if (todayScheduled) {
    cursor = previousScheduledDate(habit, today);
  } else {
    cursor = previousScheduledDate(habit, addDays(today, 1));
  }

  let streak = 0;
  let guard = 0;
  while (cursor && checked.has(cursor) && guard < 10000) {
    streak += 1;
    cursor = previousScheduledDate(habit, cursor);
    guard += 1;
  }
  return streak;
}

export interface RecentDay {
  date: string;
  scheduled: boolean;
  checked: boolean;
}

export function recentSchedule(
  habit: Habit,
  checkIns: HabitCheckIn[],
  today: string,
  days = 7
): RecentDay[] {
  const checked = checkInDates(habit.id, checkIns);
  const start = addDays(today, -(days - 1));
  return eachDate(start, today).map((date) => ({
    date,
    scheduled: isScheduledOn(habit, date),
    checked: checked.has(date),
  }));
}

type DayKind = 'done' | 'missed' | 'off';

function classifyGoalDay(
  goal: Goal,
  habits: Habit[],
  checkedByHabit: Map<string, Set<string>>,
  date: string
): DayKind {
  if (date < goal.startDate || date > goal.targetDate) return 'off';
  let any = false;
  for (const habit of habits) {
    if (!isScheduledOn(habit, date)) continue;
    any = true;
    if (!checkedByHabit.get(habit.id)?.has(date)) return 'missed';
  }
  return any ? 'done' : 'off';
}

/**
 * Consecutive days on which every linked habit scheduled that day was checked.
 * Unscheduled days are skipped. Today stays in grace while the goal window is open.
 */
export function goalStreak(
  goal: Goal,
  habits: Habit[],
  checkIns: HabitCheckIn[],
  today: string
): number {
  const linked = habits.filter((habit) => habit.goalId === goal.id && !habit.archived);
  if (linked.length === 0) return 0;

  const checkedByHabit = new Map(linked.map((habit) => [habit.id, checkInDates(habit.id, checkIns)]));
  let cursor = today > goal.targetDate ? goal.targetDate : today;
  if (cursor < goal.startDate) return 0;

  const windowOpen = today >= goal.startDate && today <= goal.targetDate;
  const first = classifyGoalDay(goal, linked, checkedByHabit, cursor);
  if (first === 'missed' && !windowOpen) return 0;
  if (first !== 'done') cursor = addDays(cursor, -1);

  let streak = 0;
  let guard = 0;
  while (cursor >= goal.startDate && guard < 10000) {
    const kind = classifyGoalDay(goal, linked, checkedByHabit, cursor);
    if (kind === 'done') streak += 1;
    else if (kind === 'missed') break;
    cursor = addDays(cursor, -1);
    guard += 1;
  }
  return streak;
}

export interface GoalProgress {
  percent: number;
  scheduled: number;
  done: number;
  streak: number;
}

/**
 * Consistency from the goal start through today, never past the target date.
 * Archived habits and days before a habit existed are left out. Check-ins remain.
 */
export function goalProgress(
  goal: Goal,
  habits: Habit[],
  checkIns: HabitCheckIn[],
  today: string
): GoalProgress {
  const linked = habits.filter((habit) => habit.goalId === goal.id && !habit.archived);
  const streak = goal.status === 'paused' ? 0 : goalStreak(goal, habits, checkIns, today);
  const windowEnd = today < goal.targetDate ? today : goal.targetDate;
  if (goal.status === 'paused' || linked.length === 0 || windowEnd < goal.startDate) {
    return { percent: 0, scheduled: 0, done: 0, streak };
  }

  let scheduled = 0;
  let done = 0;
  for (const habit of linked) {
    const from = goal.startDate > habitStartDate(habit) ? goal.startDate : habitStartDate(habit);
    if (from > windowEnd) continue;
    const dates = checkInDates(habit.id, checkIns);
    for (const date of eachDate(from, windowEnd)) {
      if (!matchesSchedule(habit.schedule, date)) continue;
      scheduled += 1;
      if (dates.has(date)) done += 1;
    }
  }

  const percent = scheduled === 0 ? 0 : Math.round((done / scheduled) * 100);
  return { percent, scheduled, done, streak };
}

export function isDueToday(habit: Habit, today: string, goals: Goal[]): boolean {
  if (habit.archived || !isScheduledOn(habit, today)) return false;
  if (!habit.goalId) return true;
  const goal = goals.find((item) => item.id === habit.goalId);
  if (!goal) return true;
  return goal.status !== 'paused';
}
