import { afterAll, describe, expect, it } from 'vitest';
import { calculateNextDueDate } from '../services/notificationService';
import { nextOccurrenceDate } from './financeRecurrence';

// East of UTC, local midnight is still the previous day in UTC. That is where a
// UTC date conversion made recurring dates stand still, so pin India time.
const originalTz = process.env.TZ;
process.env.TZ = 'Asia/Kolkata';
afterAll(() => {
  process.env.TZ = originalTz;
});

describe('calculateNextDueDate', () => {
  it('runs in a timezone east of UTC', () => {
    expect(new Date(2026, 10, 3).getTimezoneOffset()).toBe(-330);
  });

  it('advances each recurrence type to the next local date', () => {
    expect(calculateNextDueDate('2026-11-03', 'daily')).toBe('2026-11-04');
    expect(calculateNextDueDate('2026-11-06', 'weekdays')).toBe('2026-11-09');
    expect(calculateNextDueDate('2026-11-03', 'weekly')).toBe('2026-11-10');
    expect(calculateNextDueDate('2026-11-03', 'weekly', 1, [5])).toBe('2026-11-06');
    expect(calculateNextDueDate('2026-11-05', 'monthly')).toBe('2026-12-05');
    expect(calculateNextDueDate('2026-11-03', 'custom', 3)).toBe('2026-11-06');
  });

  it('crosses month and year ends', () => {
    expect(calculateNextDueDate('2026-11-30', 'daily')).toBe('2026-12-01');
    expect(calculateNextDueDate('2026-12-31', 'daily')).toBe('2027-01-01');
  });
});

describe('nextOccurrenceDate', () => {
  it('advances recurring money entries to the next local date', () => {
    expect(nextOccurrenceDate('2026-11-03', 'daily')).toBe('2026-11-04');
    expect(nextOccurrenceDate('2026-11-03', 'weekly')).toBe('2026-11-10');
    expect(nextOccurrenceDate('2026-01-31', 'monthly')).toBe('2026-02-28');
    expect(nextOccurrenceDate('2026-11-03', 'daily', '2026-11-03')).toBeNull();
  });
});
