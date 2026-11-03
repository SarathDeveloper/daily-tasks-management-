import type { Task } from '../types';

/** A task with a start time is a block of `estimatedMinutes` (30 when unset). */
export const DEFAULT_BLOCK_MINUTES = 30;
const DAY_START_HOUR = 6;
const DAY_END_HOUR = 22;

export function toMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + (m || 0);
}

export function fromMinutes(total: number): string {
  const clamped = Math.max(0, Math.min(total, 24 * 60 - 1));
  return `${String(Math.floor(clamped / 60)).padStart(2, '0')}:${String(clamped % 60).padStart(2, '0')}`;
}

export function blockMinutes(task: Pick<Task, 'estimatedMinutes'>): number {
  return task.estimatedMinutes && task.estimatedMinutes > 0 ? task.estimatedMinutes : DEFAULT_BLOCK_MINUTES;
}

/** "09:00–09:45". */
export function blockLabel(task: Pick<Task, 'time' | 'estimatedMinutes'>): string {
  if (!task.time) return '';
  return `${task.time}–${fromMinutes(toMinutes(task.time) + blockMinutes(task))}`;
}

/** Start time after dropping a block on `hour`, keeping its minutes past the hour. */
export function droppedTime(time: string | undefined, hour: number): string {
  const minutes = time ? toMinutes(time) % 60 : 0;
  return fromMinutes(hour * 60 + minutes);
}

/** Hours to draw: the usual 06–22 day, widened for tasks outside it. */
export function timelineHours(tasks: Pick<Task, 'time'>[]): number[] {
  let first = DAY_START_HOUR;
  let last = DAY_END_HOUR;
  for (const task of tasks) {
    if (!task.time) continue;
    const hour = Math.floor(toMinutes(task.time) / 60);
    first = Math.min(first, hour);
    last = Math.max(last, hour);
  }
  return Array.from({ length: last - first + 1 }, (_, i) => first + i);
}

/** The open block running at `nowMinutes`, with the whole minutes it has left. */
export function currentBlock<T extends Pick<Task, 'time' | 'estimatedMinutes' | 'completed'>>(
  tasks: T[],
  nowMinutes: number
): { task: T; minutesLeft: number } | null {
  let found: { task: T; minutesLeft: number } | null = null;
  for (const task of tasks) {
    if (task.completed || !task.time) continue;
    const start = toMinutes(task.time);
    const end = start + blockMinutes(task);
    if (nowMinutes < start || nowMinutes >= end) continue;
    // With overlaps, the block that started last is the one being worked on.
    if (!found || start > toMinutes(found.task.time!)) found = { task, minutesLeft: end - nowMinutes };
  }
  return found;
}
