import type { AccountType, CategoryBudget, FinanceCategory, PaymentMethod } from '../types';

export const EXPENSE_CATEGORIES = [
  'Food & Dining',
  'Transport',
  'Shopping',
  'Bills & Utilities',
  'Rent & Housing',
  'Health',
  'Entertainment',
  'Education',
  'Personal Care',
  'Fuel',
  'Other',
] as const;

export const INCOME_CATEGORIES = [
  'Salary',
  'Freelance',
  'Business',
  'Investment',
  'Interest',
  'Gift',
  'Other',
] as const;

export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];
export type IncomeCategory = (typeof INCOME_CATEGORIES)[number];

/**
 * Payment methods mirror how money actually leaves the account. GPay and
 * PhonePe are UPI apps, not accounts: the *account* is chosen separately.
 * `upi` and `bank` are legacy values (entries created before the ledger) and
 * are intentionally kept out of the picker below.
 */
export const PAYMENT_METHODS: { value: PaymentMethod; label: string; emoji: string }[] = [
  { value: 'cash', label: 'Cash', emoji: '💵' },
  { value: 'gpay', label: 'GPay', emoji: '🟢' },
  { value: 'phonepe', label: 'PhonePe', emoji: '🟣' },
  { value: 'bank_transfer', label: 'Bank', emoji: '🏦' },
  { value: 'card', label: 'Card', emoji: '💳' },
  { value: 'other', label: 'Other', emoji: '🧾' },
];

/** Labels for the legacy values so old records never render a raw key. */
export const LEGACY_PAYMENT_METHODS: { value: PaymentMethod; label: string; emoji: string }[] = [
  { value: 'upi', label: 'UPI (legacy)', emoji: '📱' },
  { value: 'bank', label: 'Bank (legacy)', emoji: '🏦' },
];

export const ALL_PAYMENT_METHODS = [...PAYMENT_METHODS, ...LEGACY_PAYMENT_METHODS];

export const DEFAULT_PAYMENT_METHOD: PaymentMethod = 'cash';

export const ACCOUNT_TYPES: { value: AccountType; label: string; emoji: string }[] = [
  { value: 'cash', label: 'Cash Wallet', emoji: '💵' },
  { value: 'savings', label: 'Savings Bank', emoji: '🏦' },
  { value: 'current', label: 'Current Bank', emoji: '🏛️' },
  { value: 'gold', label: 'Gold', emoji: '🪙' },
  { value: 'stocks', label: 'Stocks', emoji: '📈' },
  { value: 'other', label: 'Other', emoji: '💼' },
];

export const QUICK_ADD_AMOUNTS = [50, 100, 200, 500];

export const QUICK_ADD_FALLBACK_CATEGORIES = [
  'Food & Dining',
  'Transport',
  'Shopping',
] as const;

export const paymentMethodMeta = (method?: PaymentMethod) =>
  ALL_PAYMENT_METHODS.find((p) => p.value === method);

export const paymentMethodLabel = (method?: PaymentMethod): string =>
  method ? paymentMethodMeta(method)?.label ?? method : '';

export const paymentMethodEmoji = (method?: PaymentMethod): string =>
  method ? paymentMethodMeta(method)?.emoji ?? '' : '';

export const accountTypeMeta = (type: AccountType) =>
  ACCOUNT_TYPES.find((t) => t.value === type) ?? ACCOUNT_TYPES[0];

export function normalizeCategoryName(name: string): string {
  return name.trim().replace(/\s+/g, ' ');
}

export function sameCategoryName(left: string, right: string): boolean {
  return normalizeCategoryName(left).toLowerCase() === normalizeCategoryName(right).toLowerCase();
}

/** True when this name was added by the user for this side. Built-in names are not. */
export function isCustomFinanceCategory(
  name: string,
  kind: 'income' | 'expense',
  custom: Pick<FinanceCategory, 'name' | 'kind'>[]
): boolean {
  const key = normalizeCategoryName(name).toLowerCase();
  if (!key) return false;
  const builtins = kind === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
  if (builtins.some((item) => item.toLowerCase() === key)) return false;
  return custom.some(
    (item) => item.kind === kind && normalizeCategoryName(item.name).toLowerCase() === key
  );
}

/** Reserved so a category name cannot collide with the "Add category" option. */
export const ADD_CATEGORY_VALUE = '__add_category__';

function withOtherLast(names: readonly string[]): string[] {
  const rest = names.filter((name) => name !== 'Other');
  return names.includes('Other') ? [...rest, 'Other'] : [...rest];
}

/**
 * Built-in names first, with Other last, then names the user added, then any
 * name already stored on a transaction that is in neither list.
 */
export function financeCategoryNames(
  kind: 'income' | 'expense' | 'all',
  custom: Pick<FinanceCategory, 'name' | 'kind'>[],
  extraUsed: string[] = []
): string[] {
  const builtins =
    kind === 'income'
      ? INCOME_CATEGORIES
      : kind === 'expense'
        ? EXPENSE_CATEGORIES
        : [...INCOME_CATEGORIES, ...EXPENSE_CATEGORIES];
  const ordered = withOtherLast([...new Set(builtins)]);
  const seen = new Set(ordered.map((name) => name.toLowerCase()));

  const customNames = custom
    .filter((item) => kind === 'all' || item.kind === kind)
    .map((item) => normalizeCategoryName(item.name))
    .filter((name) => name && !seen.has(name.toLowerCase()))
    .sort((a, b) => a.localeCompare(b));
  for (const name of customNames) {
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    ordered.push(name);
  }

  for (const raw of extraUsed) {
    const name = normalizeCategoryName(raw);
    const key = name.toLowerCase();
    if (!name || key === 'transfer' || seen.has(key)) continue;
    seen.add(key);
    ordered.push(name);
  }
  return ordered;
}

/** Blank names and names that already exist on this side are refused. */
export function financeCategoryError(
  raw: string,
  kind: 'income' | 'expense',
  custom: Pick<FinanceCategory, 'name' | 'kind'>[]
): string | null {
  const name = normalizeCategoryName(raw);
  if (!name || name === ADD_CATEGORY_VALUE) return 'Enter a category name.';
  const taken = financeCategoryNames(kind, custom);
  if (taken.some((item) => item.toLowerCase() === name.toLowerCase())) {
    return 'That category already exists.';
  }
  return null;
}

/**
 * Move a deleted category's limits onto Other. A month that already has an
 * Other limit drops the extra row instead of showing two.
 */
export function reassignDeletedCategoryBudgets(
  budgets: CategoryBudget[],
  name: string,
  now: string
): { budgets: CategoryBudget[]; droppedIds: string[] } {
  const droppedIds: string[] = [];
  const next: CategoryBudget[] = [];
  for (const budget of budgets) {
    if (!sameCategoryName(budget.category, name)) {
      next.push(budget);
      continue;
    }
    const otherExists =
      budgets.some(
        (other) =>
          other.id !== budget.id && other.month === budget.month && other.category === 'Other'
      ) || next.some((other) => other.month === budget.month && other.category === 'Other');
    if (otherExists) {
      droppedIds.push(budget.id);
      continue;
    }
    next.push({ ...budget, category: 'Other', updatedAt: now });
  }
  return { budgets: next, droppedIds };
}

/** Recent expense chips, then any custom expense name that is not already there. */
export function quickAddCategoryNames(
  recents: string[],
  custom: Pick<FinanceCategory, 'name' | 'kind'>[]
): string[] {
  const base =
    recents.length >= 3
      ? recents.slice(0, 5)
      : [...new Set([...recents, ...QUICK_ADD_FALLBACK_CATEGORIES])].slice(0, 5);
  const seen = new Set(base.map((name) => name.toLowerCase()));
  const extras = custom
    .filter((item) => item?.kind === 'expense')
    .map((item) => normalizeCategoryName(item.name))
    .filter((name) => name && !seen.has(name.toLowerCase()))
    .sort((a, b) => a.localeCompare(b));
  const unique: string[] = [];
  for (const name of extras) {
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(name);
  }
  return [...base, ...unique];
}
