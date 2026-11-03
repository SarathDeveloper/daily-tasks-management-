import type { Task } from '../types';
import { readJson, writeJson } from './persistence';

/**
 * Morning plan and evening review. The plan lives on this device only: it is
 * a daily ritual, not a record worth syncing or backing up.
 */
export const DAILY_PLAN_KEY = 'dayflow_daily_plan_v1';
export const TOP_PICKS = 3;
/** Evening review is offered from this hour onwards. */
export const EVENING_HOUR = 18;
const UPCOMING_DAYS = 3;

export interface DailyPlanState {
  /** Day the picks and flags below belong to. */
  date: string;
  topTaskIds: string[];
  /** The morning prompt was answered or dismissed. */
  planned: boolean;
  /** The evening review was finished or dismissed. */
  reviewed: boolean;
}

export function emptyPlan(date: string): DailyPlanState {
  return { date, topTaskIds: [], planned: false, reviewed: false };
}

export function loadDailyPlan(today: string): DailyPlanState {
  const stored = readJson<DailyPlanState | null>(DAILY_PLAN_KEY, null);
  return stored && stored.date === today ? { ...emptyPlan(today), ...stored } : emptyPlan(today);
}

export function saveDailyPlan(plan: DailyPlanState): void {
  writeJson(DAILY_PLAN_KEY, plan);
}

function addDays(date: string, days: number): string {
  const [y, m, d] = date.split('-').map(Number);
  const next = new Date(y, m - 1, d + days);
  return `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}-${String(next.getDate()).padStart(2, '0')}`;
}

export function tomorrowOf(date: string): string {
  return addDays(date, 1);
}

const PRIORITY_RANK: Record<Task['priority'], number> = { urgent: 0, high: 1, medium: 2, low: 3 };

export interface PlanCandidates {
  overdue: Task[];
  today: Task[];
  upcoming: Task[];
}

/** Open tasks worth considering for today's top picks, most pressing first. */
export function planCandidates(tasks: Task[], today: string): PlanCandidates {
  const horizon = addDays(today, UPCOMING_DAYS);
  const byPressure = (a: Task, b: Task) =>
    a.date.localeCompare(b.date) ||
    PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] ||
    (a.time || '99:99').localeCompare(b.time || '99:99');
  const open = tasks.filter((task) => !task.completed);
  return {
    overdue: open.filter((task) => task.date < today).sort(byPressure),
    today: open.filter((task) => task.date === today).sort(byPressure),
    upcoming: open.filter((task) => task.date > today && task.date <= horizon).sort(byPressure),
  };
}

/** Tasks still open at the end of `today`, for the evening review. */
export function unfinishedToday(tasks: Task[], today: string): Task[] {
  return tasks
    .filter((task) => task.date === today && !task.completed)
    .sort((a, b) => (a.time || '99:99').localeCompare(b.time || '99:99'));
}

/** Top picks that still exist, in the order they were chosen. */
export function resolveTopTasks(plan: DailyPlanState, tasks: Task[]): Task[] {
  const byId = new Map(tasks.map((task) => [task.id, task]));
  return plan.topTaskIds.map((id) => byId.get(id)).filter((task): task is Task => Boolean(task));
}

export type PlanPhase = 'morning' | 'planned' | 'evening' | 'done';

/** Which card the Today screen shows right now. */
export function planPhase(plan: DailyPlanState, hour: number): PlanPhase {
  if (hour >= EVENING_HOUR) return plan.reviewed ? 'done' : 'evening';
  return plan.planned ? 'planned' : 'morning';
}
