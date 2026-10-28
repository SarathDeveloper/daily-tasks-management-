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

/** Monday of the week that contains `dateStr`. */
export function weekStartMonday(dateStr: string): string {
  const day = weekdayOf(dateStr);
  const delta = day === 0 ? -6 : 1 - day;
  return addDays(dateStr, delta);
}

/** Seven dates, Monday through Sunday. */
export function weekDates(monday: string): string[] {
  return eachDate(monday, addDays(monday, 6));
}

/** Calendar day the habit began, in local time. */
export function habitStartDate(habit: Habit): string {
  const parsed = new Date(habit.createdAt);
  if (Number.isNaN(parsed.getTime())) return habit.createdAt.slice(0, 10);
  return localDateString(parsed);
}

export function weeklyQuota(habit: Habit): number {
  const n = habit.schedule.timesPerWeek ?? 3;
  return Math.min(7, Math.max(1, Math.round(n)));
}

/** Quota clipped to the days of this week the habit already existed. */
export function quotaForWeek(habit: Habit, monday: string): number {
  const available = weekDates(monday).filter((date) => date >= habitStartDate(habit)).length;
  if (available === 0) return 0;
  return Math.min(weeklyQuota(habit), available);
}

export function matchesSchedule(schedule: HabitSchedule, dateStr: string): boolean {
  const day = weekdayOf(dateStr);
  if (schedule.type === 'daily' || schedule.type === 'times_per_week') return true;
  if (schedule.type === 'weekdays') return day >= 1 && day <= 5;
  return (schedule.daysOfWeek ?? []).includes(day);
}

/** True when this calendar day is one the habit can be logged on. */
export function isScheduledOn(habit: Habit, dateStr: string): boolean {
  if (dateStr < habitStartDate(habit)) return false;
  return matchesSchedule(habit.schedule, dateStr);
}

export function scheduleLabel(habit: Habit): string {
  if (habit.schedule.type === 'daily') return 'Every day';
  if (habit.schedule.type === 'weekdays') return 'Weekdays';
  if (habit.schedule.type === 'times_per_week') return `${weeklyQuota(habit)}× week`;
  const names = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const days = (habit.schedule.daysOfWeek ?? []).map((day) => names[day]).filter(Boolean);
  return days.length > 0 ? days.join(' ') : 'Custom';
}

export function checkInDates(habitId: string, checkIns: HabitCheckIn[]): Set<string> {
  const dates = new Set<string>();
  for (const entry of checkIns) {
    if (entry.habitId === habitId) dates.add(entry.date);
  }
  return dates;
}

export function checkInMap(habitId: string, checkIns: HabitCheckIn[]): Map<string, HabitCheckIn> {
  const map = new Map<string, HabitCheckIn>();
  for (const entry of checkIns) {
    if (entry.habitId === habitId) map.set(entry.date, entry);
  }
  return map;
}

export function checkInOn(
  habitId: string,
  checkIns: HabitCheckIn[],
  date: string
): HabitCheckIn | undefined {
  return checkIns.find((entry) => entry.habitId === habitId && entry.date === date);
}

export function isSkipped(entry?: HabitCheckIn): boolean {
  return Boolean(entry?.skipped);
}

/** A finished check. Skips and note-only records (value 0) are not done. */
export function isComplete(habit: Habit, entry?: HabitCheckIn): boolean {
  if (!entry || entry.skipped) return false;
  const target = Math.max(1, habit.targetCount ?? 1);
  if (target > 1) return (entry.value ?? 0) >= target;
  return entry.value !== 0;
}

/** Skip or a finished check. Used only for streaks. */
export function keepsStreak(habit: Habit, entry?: HabitCheckIn): boolean {
  return isComplete(habit, entry) || isSkipped(entry);
}

export function habitBlockReason(habit: Habit, goals: Goal[]): 'archived' | 'paused' | 'completed' | null {
  if (habit.archived) return 'archived';
  if (!habit.goalId) return null;
  const goal = goals.find((item) => item.id === habit.goalId);
  if (!goal) return null;
  if (goal.status === 'paused') return 'paused';
  if (goal.status === 'completed') return 'completed';
  return null;
}

function weekCompletes(habit: Habit, map: Map<string, HabitCheckIn>, monday: string): number {
  const start = habitStartDate(habit);
  return weekDates(monday).filter((date) => date >= start && isComplete(habit, map.get(date))).length;
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

function timesPerWeekStreak(habit: Habit, map: Map<string, HabitCheckIn>, today: string): number {
  let monday = weekStartMonday(today);
  if (weekCompletes(habit, map, monday) < quotaForWeek(habit, monday)) {
    monday = addDays(monday, -7);
  }

  const start = habitStartDate(habit);
  let streak = 0;
  let guard = 0;
  while (guard < 520) {
    const weekEnd = addDays(monday, 6);
    if (weekEnd < start) break;
    const quota = quotaForWeek(habit, monday);
    if (quota > 0 && weekCompletes(habit, map, monday) >= quota) streak += 1;
    else break;
    monday = addDays(monday, -7);
    guard += 1;
  }
  return streak;
}

/**
 * Consecutive scheduled days checked.
 * A skip counts the same as a check. If today is scheduled and still open,
 * the streak stays alive from the previous scheduled day.
 * Times-per-week habits count consecutive weeks that hit the quota.
 */
export function habitStreak(habit: Habit, checkIns: HabitCheckIn[], today: string): number {
  if (habit.archived) return 0;
  const map = checkInMap(habit.id, checkIns);
  const start = habitStartDate(habit);
  if (today < start) return 0;

  if (habit.schedule.type === 'times_per_week') return timesPerWeekStreak(habit, map, today);

  const todayScheduled = matchesSchedule(habit.schedule, today);
  let cursor: string | null;
  if (todayScheduled && keepsStreak(habit, map.get(today))) {
    cursor = today;
  } else if (todayScheduled) {
    cursor = previousScheduledDate(habit, today);
  } else {
    cursor = previousScheduledDate(habit, addDays(today, 1));
  }

  let streak = 0;
  let guard = 0;
  while (cursor && keepsStreak(habit, map.get(cursor)) && guard < 10000) {
    streak += 1;
    cursor = previousScheduledDate(habit, cursor);
    guard += 1;
  }
  return streak;
}

/** Longest run. Today stays in grace when it is still open. A skip does not break the run. */
export function longestStreak(habit: Habit, checkIns: HabitCheckIn[], today: string): number {
  if (habit.archived) return 0;
  const map = checkInMap(habit.id, checkIns);
  const start = habitStartDate(habit);
  if (today < start) return 0;

  if (habit.schedule.type === 'times_per_week') {
    let best = 0;
    let run = 0;
    let monday = weekStartMonday(start);
    const endMonday = weekStartMonday(today);
    let guard = 0;
    while (monday <= endMonday && guard < 520) {
      const quota = quotaForWeek(habit, monday);
      const met = quota > 0 && weekCompletes(habit, map, monday) >= quota;
      const open = monday === endMonday && !met;
      if (!open) {
        if (met) {
          run += 1;
          if (run > best) best = run;
        } else {
          run = 0;
        }
      }
      monday = addDays(monday, 7);
      guard += 1;
    }
    return best;
  }

  let best = 0;
  let run = 0;
  for (const date of eachDate(start, today)) {
    if (!matchesSchedule(habit.schedule, date)) continue;
    if (date === today && !keepsStreak(habit, map.get(date))) continue;
    if (keepsStreak(habit, map.get(date))) {
      run += 1;
      if (run > best) best = run;
    } else {
      run = 0;
    }
  }
  return best;
}

export interface RecentDay {
  date: string;
  scheduled: boolean;
  checked: boolean;
  skipped: boolean;
  value: number;
}

export function scheduleForDates(
  habit: Habit,
  checkIns: HabitCheckIn[],
  dates: string[]
): RecentDay[] {
  const map = checkInMap(habit.id, checkIns);
  return dates.map((date) => {
    const entry = map.get(date);
    return {
      date,
      scheduled: isScheduledOn(habit, date),
      checked: isComplete(habit, entry),
      skipped: isSkipped(entry),
      value: entry?.skipped ? 0 : (entry?.value ?? (isComplete(habit, entry) ? 1 : 0)),
    };
  });
}

export function recentSchedule(
  habit: Habit,
  checkIns: HabitCheckIn[],
  today: string,
  days = 7
): RecentDay[] {
  const start = addDays(today, -(days - 1));
  return scheduleForDates(habit, checkIns, eachDate(start, today));
}

export interface HabitCompletion {
  scheduled: number;
  done: number;
  skipped: number;
  /** Done divided by scheduled days that were not skipped. Times-per-week uses the weekly quota. */
  percent: number;
}

export function habitCompletion(
  habit: Habit,
  checkIns: HabitCheckIn[],
  from: string,
  to: string
): HabitCompletion {
  const empty = { scheduled: 0, done: 0, skipped: 0, percent: 0 };
  if (!from || !to || to < from) return empty;
  const start = habitStartDate(habit);
  const windowFrom = from > start ? from : start;
  if (windowFrom > to) return empty;
  const map = checkInMap(habit.id, checkIns);

  if (habit.schedule.type === 'times_per_week') {
    let scheduled = 0;
    let done = 0;
    let skipped = 0;
    let monday = weekStartMonday(windowFrom);
    const last = weekStartMonday(to);
    let guard = 0;
    while (monday <= last && guard < 520) {
      const days = weekDates(monday).filter((date) => date >= windowFrom && date <= to && date >= start);
      if (days.length > 0) {
        const quota = Math.min(weeklyQuota(habit), days.length);
        scheduled += quota;
        const completes = days.filter((date) => isComplete(habit, map.get(date))).length;
        done += Math.min(completes, quota);
        skipped += days.filter((date) => isSkipped(map.get(date))).length;
      }
      monday = addDays(monday, 7);
      guard += 1;
    }
    const percent = scheduled === 0 ? 0 : Math.round((done / scheduled) * 100);
    return { scheduled, done, skipped, percent };
  }

  let scheduled = 0;
  let done = 0;
  let skipped = 0;
  for (const date of eachDate(windowFrom, to)) {
    if (!matchesSchedule(habit.schedule, date)) continue;
    scheduled += 1;
    const entry = map.get(date);
    if (isSkipped(entry)) skipped += 1;
    else if (isComplete(habit, entry)) done += 1;
  }
  const countable = scheduled - skipped;
  const percent = countable === 0 ? 0 : Math.round((done / countable) * 100);
  return { scheduled, done, skipped, percent };
}

export type HeatCell = 'off' | 'done' | 'skipped' | 'missed' | 'pending';

export interface HeatmapCell {
  date: string;
  inMonth: boolean;
  state: HeatCell;
}

function heatState(
  habit: Habit,
  map: Map<string, HabitCheckIn>,
  date: string,
  today: string
): HeatCell {
  if (date > today || date < habitStartDate(habit) || !isScheduledOn(habit, date)) return 'off';
  const entry = map.get(date);
  if (isComplete(habit, entry)) return 'done';
  if (isSkipped(entry)) return 'skipped';

  if (habit.schedule.type === 'times_per_week') {
    const monday = weekStartMonday(date);
    const quota = quotaForWeek(habit, monday);
    if (quota === 0 || weekCompletes(habit, map, monday) >= quota) return 'off';
    const weekEnd = addDays(monday, 6);
    if (weekEnd >= today) return date === today ? 'pending' : 'off';
    return 'missed';
  }

  if (date === today) return 'pending';
  return 'missed';
}

/** Monday-aligned month grid. Days outside the month stay in the list so columns line up. */
export function monthHeatmap(
  habit: Habit,
  checkIns: HabitCheckIn[],
  year: number,
  month: number,
  today: string
): HeatmapCell[] {
  const first = localDateString(new Date(year, month - 1, 1));
  const last = localDateString(new Date(year, month, 0));
  const gridStart = weekStartMonday(first);
  const gridEnd = addDays(weekStartMonday(last), 6);
  const map = checkInMap(habit.id, checkIns);
  return eachDate(gridStart, gridEnd).map((date) => {
    const inMonth = date >= first && date <= last;
    return {
      date,
      inMonth,
      state: inMonth ? heatState(habit, map, date, today) : 'off',
    };
  });
}

type DayKind = 'done' | 'missed' | 'off';

function habitDayKind(
  habit: Habit,
  map: Map<string, HabitCheckIn>,
  date: string,
  today: string
): DayKind {
  if (date < habitStartDate(habit)) return 'off';

  if (habit.schedule.type === 'times_per_week') {
    if (isComplete(habit, map.get(date)) || isSkipped(map.get(date))) return 'done';
    const monday = weekStartMonday(date);
    const quota = quotaForWeek(habit, monday);
    if (quota === 0 || weekCompletes(habit, map, monday) >= quota) return 'off';
    const weekEnd = addDays(monday, 6);
    if (weekEnd >= today && date <= today) return 'off';
    if (date > today) return 'off';
    return 'missed';
  }

  if (!isScheduledOn(habit, date)) return 'off';
  if (isComplete(habit, map.get(date)) || isSkipped(map.get(date))) return 'done';
  return 'missed';
}

function classifyGoalDay(
  goal: Goal,
  habits: Habit[],
  maps: Map<string, Map<string, HabitCheckIn>>,
  date: string,
  today: string
): DayKind {
  if (date < goal.startDate || date > goal.targetDate) return 'off';
  let any = false;
  for (const habit of habits) {
    const kind = habitDayKind(habit, maps.get(habit.id) ?? new Map(), date, today);
    if (kind === 'off') continue;
    any = true;
    if (kind === 'missed') return 'missed';
  }
  return any ? 'done' : 'off';
}

/**
 * Consecutive days on which every linked habit scheduled that day was checked.
 * Unscheduled days are skipped. Today stays in grace while the goal window is open.
 * A skip satisfies the day. Times-per-week habits only miss once the week closes under quota.
 */
export function goalStreak(
  goal: Goal,
  habits: Habit[],
  checkIns: HabitCheckIn[],
  today: string
): number {
  const linked = habits.filter((habit) => habit.goalId === goal.id && !habit.archived);
  if (linked.length === 0) return 0;

  const maps = new Map(linked.map((habit) => [habit.id, checkInMap(habit.id, checkIns)]));
  let cursor = today > goal.targetDate ? goal.targetDate : today;
  if (cursor < goal.startDate) return 0;

  const windowOpen = today >= goal.startDate && today <= goal.targetDate;
  const first = classifyGoalDay(goal, linked, maps, cursor, today);
  if (first === 'missed' && !windowOpen) return 0;
  if (first !== 'done') cursor = addDays(cursor, -1);

  let streak = 0;
  let guard = 0;
  while (cursor >= goal.startDate && guard < 10000) {
    const kind = classifyGoalDay(goal, linked, maps, cursor, today);
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
 * Archived habits and days before a habit existed are left out. Skips are left out.
 * Check-ins remain.
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
    if (habit.schedule.type === 'times_per_week') {
      const stats = habitCompletion(habit, checkIns, from, windowEnd);
      scheduled += stats.scheduled;
      done += stats.done;
      continue;
    }
    const map = checkInMap(habit.id, checkIns);
    for (const date of eachDate(from, windowEnd)) {
      if (!matchesSchedule(habit.schedule, date)) continue;
      const entry = map.get(date);
      if (isSkipped(entry)) continue;
      scheduled += 1;
      if (isComplete(habit, entry)) done += 1;
    }
  }

  const percent = scheduled === 0 ? 0 : Math.round((done / scheduled) * 100);
  return { percent, scheduled, done, streak };
}

export function isDueToday(
  habit: Habit,
  today: string,
  goals: Goal[],
  checkIns: HabitCheckIn[] = []
): boolean {
  if (habitBlockReason(habit, goals) || !isScheduledOn(habit, today)) return false;
  if (habit.schedule.type !== 'times_per_week') return true;

  const map = checkInMap(habit.id, checkIns);
  if (isComplete(habit, map.get(today)) || isSkipped(map.get(today))) return true;
  const monday = weekStartMonday(today);
  const quota = quotaForWeek(habit, monday);
  if (quota === 0) return false;
  return weekCompletes(habit, map, monday) < quota;
}
