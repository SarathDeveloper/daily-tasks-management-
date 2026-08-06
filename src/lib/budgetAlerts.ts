import type {
  BudgetAlert,
  BudgetAlertState,
  CategoryBudget,
  FinanceTransaction,
  MonthlyBudget,
} from '../types';

const toMonthKey = (dateStr: string) => dateStr.slice(0, 7);

/**
 * Compute alerts to fire for the given month based on budgets and current spend.
 * Returns new alerts that have not yet been notified (per alertState).
 * Also returns the updated alertState entries to persist.
 */
export function checkBudgetAlerts(args: {
  transactions: FinanceTransaction[];
  budgets: MonthlyBudget[];
  categoryBudgets: CategoryBudget[];
  alertState: BudgetAlertState;
  month: string;
}): { alerts: BudgetAlert[]; stateUpdates: BudgetAlertState } {
  const { transactions, budgets, categoryBudgets, alertState, month } = args;
  const alerts: BudgetAlert[] = [];
  const stateUpdates: BudgetAlertState = {};

  const monthTx = transactions.filter((t) => t.date.startsWith(month));

  // Overall monthly budget
  const monthlyBudget = budgets.find((b) => b.month === month);
  if (monthlyBudget && monthlyBudget.limit > 0) {
    const spent = monthTx
      .filter((t) => t.type === 'expense')
      .reduce((s, t) => s + t.amount, 0);
    const pct = (spent / monthlyBudget.limit) * 100;
    const key = month;
    const entry = alertState[key] || {};

    if (pct >= 100 && !entry.hundredNotifiedAt) {
      alerts.push({
        key,
        level: 'critical',
        scope: 'Monthly',
        spent,
        limit: monthlyBudget.limit,
        pct: Math.round(pct),
      });
      stateUpdates[key] = {
        ...entry,
        hundredNotifiedAt: new Date().toISOString(),
        eightyNotifiedAt: entry.eightyNotifiedAt || new Date().toISOString(),
      };
    } else if (pct >= 80 && !entry.eightyNotifiedAt) {
      alerts.push({
        key,
        level: 'warning',
        scope: 'Monthly',
        spent,
        limit: monthlyBudget.limit,
        pct: Math.round(pct),
      });
      stateUpdates[key] = {
        ...entry,
        eightyNotifiedAt: new Date().toISOString(),
      };
    }
  }

  // Per-category budgets
  for (const cb of categoryBudgets.filter((b) => b.month === month)) {
    if (cb.limit <= 0) continue;
    const spent = monthTx
      .filter((t) => t.type === 'expense' && t.category === cb.category)
      .reduce((s, t) => s + t.amount, 0);
    const pct = (spent / cb.limit) * 100;
    const key = `${month}-${cb.category}`;
    const entry = alertState[key] || {};

    if (pct >= 100 && !entry.hundredNotifiedAt) {
      alerts.push({
        key,
        level: 'critical',
        scope: cb.category,
        spent,
        limit: cb.limit,
        pct: Math.round(pct),
      });
      stateUpdates[key] = {
        ...entry,
        hundredNotifiedAt: new Date().toISOString(),
        eightyNotifiedAt: entry.eightyNotifiedAt || new Date().toISOString(),
      };
    } else if (pct >= 80 && !entry.eightyNotifiedAt) {
      alerts.push({
        key,
        level: 'warning',
        scope: cb.category,
        spent,
        limit: cb.limit,
        pct: Math.round(pct),
      });
      stateUpdates[key] = {
        ...entry,
        eightyNotifiedAt: new Date().toISOString(),
      };
    }
  }

  return { alerts, stateUpdates };
}

/**
 * Format an alert into a human-readable message.
 */
export function formatAlertMessage(alert: BudgetAlert): string {
  const limitStr = new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(alert.limit);
  const spentStr = new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(alert.spent);
  const scopeSuffix = alert.scope === 'Monthly' ? ' monthly budget' : ` ${alert.scope} budget`;
  if (alert.level === 'critical') {
    return `You've exceeded your${scopeSuffix} (${spentStr} of ${limitStr})`;
  }
  return `You've spent ${alert.pct}% of your${scopeSuffix} (${spentStr} of ${limitStr})`;
}
