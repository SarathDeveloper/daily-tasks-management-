export type Priority = 'low' | 'medium' | 'high' | 'urgent';

export interface User {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  avatarColor?: string;
  createdAt: string;
}

export type RecurrenceType = 'none' | 'daily' | 'weekdays' | 'weekly' | 'monthly' | 'custom';

export type SoundType = 'chime' | 'bell' | 'digital' | 'gentle' | 'voice';

export interface Subtask {
  id: string;
  title: string;
  completed: boolean;
}

export interface TaskReminder {
  enabled: boolean;
  remindBeforeMinutes: number; // 0 = at time, 5, 15, 30, 60
  sound: SoundType;
  lastNotifiedAt?: string;
  snoozedUntil?: string;
}

export interface TaskRecurrence {
  type: RecurrenceType;
  intervalDays?: number; // for custom interval
  daysOfWeek?: number[]; // 0=Sun, 1=Mon, ..., 6=Sat
  endDate?: string;
}

export interface Task {
  id: string;
  userId?: string;
  title: string;
  description?: string;
  completed: boolean;
  completedAt?: string;
  date: string; // YYYY-MM-DD
  time?: string; // HH:mm
  estimatedMinutes?: number;
  priority: Priority;
  category: string;
  subtasks: Subtask[];
  recurrence: TaskRecurrence;
  reminder: TaskReminder;
  tags?: string[];
  createdAt: string;
  updatedAt: string;
}

export interface Category {
  id: string;
  userId?: string;
  name: string;
  color: string; // hex or tailwind color name
  icon: string; // lucide icon identifier
}

export interface NotificationSettings {
  browserNotificationsEnabled: boolean;
  soundEnabled: boolean;
  speechEnabled: boolean;
  defaultSound: SoundType;
  quietHours: {
    enabled: boolean;
    start: string; // "22:00"
    end: string;   // "07:00"
  };
}

export type ActiveTab = 'today' | 'timeline' | 'focus' | 'categories' | 'stats' | 'finance' | 'settings';

export type TransactionType = 'expense' | 'income';

export type PaymentMethod = 'cash' | 'upi' | 'card' | 'bank';

export type FinanceRecurrenceType = 'none' | 'daily' | 'weekly' | 'monthly';

export interface FinanceRecurrence {
  type: FinanceRecurrenceType;
  endDate?: string; // YYYY-MM-DD
}

export interface FinanceTransaction {
  id: string;
  userId?: string;
  type: TransactionType;
  amount: number;
  category: string;
  note?: string;
  date: string; // YYYY-MM-DD
  paymentMethod?: PaymentMethod;
  recurrence: FinanceRecurrence;
  recurrenceGroupId?: string; // links generated instances in a series
  createdAt: string;
  updatedAt: string;
}

export interface MonthlyBudget {
  id: string;
  userId?: string;
  month: string; // YYYY-MM
  limit: number;
}

export interface CategoryBudget {
  id: string;
  userId?: string;
  month: string; // YYYY-MM
  category: string;
  limit: number;
}

export type DebtDirection = 'lent' | 'owed';

export interface Debt {
  id: string;
  userId?: string;
  direction: DebtDirection; // lent = receivable, owed = payable
  personName: string;
  amount: number;
  date: string; // YYYY-MM-DD when it happened
  dueDate?: string; // YYYY-MM-DD optional
  note?: string;
  paid: boolean;
  paidAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SavingsGoal {
  id: string;
  userId?: string;
  month: string; // YYYY-MM
  target: number;
}

export interface SavingsEntry {
  id: string;
  userId?: string;
  date: string; // YYYY-MM-DD
  amount: number; // how much saved that day
  note?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SavingsStreakState {
  currentStreak: number;
  longestStreak: number;
  lastSavedDate?: string; // YYYY-MM-DD
}

export interface BillTemplate {
  id: string;
  userId?: string;
  name: string; // e.g. "Electricity", "Internet"
  amount: number; // expected amount
  category: string; // expense category
  dueDayOfMonth: number; // 1-31
  paymentMethod?: PaymentMethod;
  active: boolean; // false = paused
  note?: string;
  createdAt: string;
  updatedAt: string;
}

export interface BillPayment {
  id: string;
  userId?: string;
  billId: string; // links to template
  month: string; // YYYY-MM
  amount: number; // actual paid amount (defaults to template amount)
  dueDate: string; // YYYY-MM-DD clamped to last day of month
  paid: boolean;
  paidAt?: string;
  transactionId?: string; // links to auto-created FinanceTransaction
  note?: string;
  createdAt: string;
  updatedAt: string;
}

export interface BudgetAlertStateEntry {
  eightyNotifiedAt?: string;
  hundredNotifiedAt?: string;
}

export interface BudgetAlertState {
  [key: string]: BudgetAlertStateEntry; // key = `${month}` or `${month}-${category}`
}

export interface BudgetAlert {
  key: string;
  level: 'warning' | 'critical';
  scope: string; // 'Monthly' or category name
  spent: number;
  limit: number;
  pct: number;
}

export interface ActiveAlert {
  task: Task;
  triggeredAt: Date;
}
