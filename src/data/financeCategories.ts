import type { AccountType, PaymentMethod } from '../types';

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
