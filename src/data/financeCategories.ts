import type { PaymentMethod } from '../types';

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
  'Other',
] as const;

export const INCOME_CATEGORIES = [
  'Salary',
  'Freelance',
  'Business',
  'Investment',
  'Gift',
  'Other',
] as const;

export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];
export type IncomeCategory = (typeof INCOME_CATEGORIES)[number];

export const PAYMENT_METHODS: { value: PaymentMethod; label: string; emoji: string }[] = [
  { value: 'upi', label: 'UPI', emoji: '📱' },
  { value: 'cash', label: 'Cash', emoji: '💵' },
  { value: 'card', label: 'Card', emoji: '💳' },
  { value: 'bank', label: 'Bank', emoji: '🏦' },
];

export const DEFAULT_PAYMENT_METHOD: PaymentMethod = 'upi';

export const QUICK_ADD_AMOUNTS = [50, 100, 200, 500];

export const QUICK_ADD_FALLBACK_CATEGORIES = [
  'Food & Dining',
  'Transport',
  'Shopping',
] as const;
