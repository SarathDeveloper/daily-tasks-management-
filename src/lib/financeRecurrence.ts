import type { FinanceTransaction, FinanceRecurrenceType } from '../types';

const toISODate = (d: Date) => d.toISOString().split('T')[0];

const parseDate = (dateStr: string) => new Date(dateStr + 'T00:00:00');

/**
 * Compute the next occurrence date for a finance recurrence.
 * Returns null if type is 'none' or if the next date would exceed endDate.
 */
export function nextOccurrenceDate(
  currentDate: string,
  type: FinanceRecurrenceType,
  endDate?: string
): string | null {
  if (type === 'none') return null;
  const base = parseDate(currentDate);

  let next = new Date(base);
  if (type === 'daily') {
    next.setDate(next.getDate() + 1);
  } else if (type === 'weekly') {
    next.setDate(next.getDate() + 7);
  } else if (type === 'monthly') {
    // Same day-of-month next month, clamped to last day of shorter months.
    const day = base.getDate();
    const nextMonth = new Date(base.getFullYear(), base.getMonth() + 1, 1);
    const lastDayOfNextMonth = new Date(
      nextMonth.getFullYear(),
      nextMonth.getMonth() + 1,
      0
    ).getDate();
    next = new Date(
      nextMonth.getFullYear(),
      nextMonth.getMonth(),
      Math.min(day, lastDayOfNextMonth)
    );
  }

  const nextStr = toISODate(next);
  if (endDate && nextStr > endDate) return null;
  return nextStr;
}

/**
 * Materialize recurring transactions up to a target date (inclusive).
 * Walks each series forward from its latest instance, inserting missing dates.
 * Returns the updated transactions list (sorted by createdAt desc).
 *
 * @param transactions current transactions array
 * @param targetDate generate occurrences up to and including this date (YYYY-MM-DD)
 * @param userId optional userId to stamp on generated instances
 */
export function materializeRecurringTransactions(
  transactions: FinanceTransaction[],
  targetDate: string,
  userId?: string
): FinanceTransaction[] {
  // Group by recurrenceGroupId, keeping only groups with recurrence !== 'none'
  const groups = new Map<string, FinanceTransaction[]>();
  for (const tx of transactions) {
    if (tx.recurrence?.type && tx.recurrence.type !== 'none' && tx.recurrenceGroupId) {
      const arr = groups.get(tx.recurrenceGroupId) || [];
      arr.push(tx);
      groups.set(tx.recurrenceGroupId, arr);
    }
  }

  if (groups.size === 0) return transactions;

  const generated: FinanceTransaction[] = [];
  const now = new Date().toISOString();

  for (const [, groupTx] of groups) {
    // Sort by date ascending; the latest instance is the seed for next occurrences.
    const sorted = [...groupTx].sort((a, b) => a.date.localeCompare(b.date));
    const template = sorted[sorted.length - 1];
    const { recurrence } = template;
    if (!recurrence || recurrence.type === 'none') continue;

    let cursor = template.date;
    // Cap generation at endDate OR targetDate, whichever is earlier.
    const hardCap = recurrence.endDate && recurrence.endDate < targetDate
      ? recurrence.endDate
      : targetDate;

    // Safety guard: never generate more than 400 occurrences per series
    // (prevents runaway loops on bad data / clock changes).
    let guard = 0;
    while (guard < 400) {
      const next = nextOccurrenceDate(cursor, recurrence.type, recurrence.endDate);
      if (!next || next > hardCap) break;
      if (next > targetDate) break;

      const newTx: FinanceTransaction = {
        id: `fin-${Date.now()}-${Math.random().toString(36).slice(2, 9)}-${guard}`,
        userId: userId ?? template.userId,
        type: template.type,
        amount: template.amount,
        category: template.category,
        note: template.note,
        date: next,
        paymentMethod: template.paymentMethod,
        recurrence: { ...recurrence },
        recurrenceGroupId: template.recurrenceGroupId,
        createdAt: now,
        updatedAt: now,
      };
      generated.push(newTx);
      cursor = next;
      guard++;
    }
  }

  if (generated.length === 0) return transactions;
  return [...generated, ...transactions].sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt)
  );
}

/**
 * Get the most-used expense categories from transaction history (most recent first).
 * Used for quick-add chips.
 */
export function recentExpenseCategories(
  transactions: FinanceTransaction[],
  limit = 5
): string[] {
  const seen = new Set<string>();
  const sorted = [...transactions]
    .filter((t) => t.type === 'expense')
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  for (const tx of sorted) {
    if (!seen.has(tx.category)) seen.add(tx.category);
    if (seen.size >= limit) break;
  }
  return Array.from(seen);
}
