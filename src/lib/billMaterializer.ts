import type { BillPayment, BillTemplate } from '../types';

/**
 * Clamp a day-of-month to the last valid day for the given month,
 * returning a YYYY-MM-DD date string.
 */
export function clampDueDate(month: string, day: number): string {
  const [y, m] = month.split('-').map(Number);
  const lastDayOfMonth = new Date(y, m, 0).getDate();
  const clamped = Math.min(Math.max(1, day), lastDayOfMonth);
  return `${month}-${String(clamped).padStart(2, '0')}`;
}

const toMonthKey = (dateStr: string) => dateStr.slice(0, 7);

/**
 * Iterate months from `startMonth` through `endMonth` (inclusive), ascending.
 */
function* eachMonth(startMonth: string, endMonth: string): Generator<string> {
  let [y, m] = startMonth.split('-').map(Number);
  const [ey, em] = endMonth.split('-').map(Number);
  let guard = 0;
  while (guard < 600) {
    if (y > ey || (y === ey && m > em)) break;
    yield `${y}-${String(m).padStart(2, '0')}`;
    m += 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
    guard += 1;
  }
}

/**
 * Materialize BillPayments for active templates up to `currentMonth` (inclusive).
 * For each active template and each month from its createdAt month through currentMonth,
 * if no BillPayment exists for (billId, month), create one unpaid.
 *
 * Does NOT pre-generate future months beyond currentMonth.
 * Caps at 24 months per template to bound growth.
 *
 * @returns updated payments array (existing + created) and the list of created payments.
 */
export function materializeBillPayments(
  templates: BillTemplate[],
  payments: BillPayment[],
  currentMonth: string,
  userId?: string
): { payments: BillPayment[]; created: BillPayment[] } {
  const created: BillPayment[] = [];
  if (templates.length === 0) return { payments, created };

  const now = new Date().toISOString();
  const existingKeys = new Set(
    payments.map((p) => `${p.billId}|${p.month}`)
  );

  for (const template of templates) {
    if (!template.active) continue;
    const startMonth = toMonthKey(template.createdAt.slice(0, 7) + '-01');
    const start = startMonth < currentMonth ? startMonth : currentMonth;
    let count = 0;
    for (const month of eachMonth(start, currentMonth)) {
      if (count >= 24) break;
      const key = `${template.id}|${month}`;
      if (existingKeys.has(key)) continue;
      existingKeys.add(key);
      const newPayment: BillPayment = {
        id: `billpay-${template.id}-${month}-${Math.random().toString(36).slice(2, 7)}`,
        userId: userId ?? template.userId,
        billId: template.id,
        month,
        amount: template.amount,
        dueDate: clampDueDate(month, template.dueDayOfMonth),
        paid: false,
        note: template.note,
        createdAt: now,
        updatedAt: now,
      };
      created.push(newPayment);
      count += 1;
    }
  }

  if (created.length === 0) return { payments, created };
  return { payments: [...created, ...payments], created };
}
