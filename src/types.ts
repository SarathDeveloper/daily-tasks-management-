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
  updatedAt?: string;
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

export type ActiveTab = 'today' | 'calendar' | 'timeline' | 'focus' | 'goals' | 'habits' | 'categories' | 'stats' | 'finance' | 'settings';

export type GoalStatus = 'active' | 'paused' | 'completed';

export interface Goal {
  id: string;
  userId?: string;
  title: string;
  note?: string;
  startDate: string; // YYYY-MM-DD
  targetDate: string; // YYYY-MM-DD
  status: GoalStatus;
  createdAt: string;
  updatedAt: string;
}

export type HabitScheduleType = 'daily' | 'weekdays' | 'custom';

export interface HabitSchedule {
  type: HabitScheduleType;
  /** 0 = Sunday … 6 = Saturday. Used when type is `custom`. */
  daysOfWeek?: number[];
}

export interface Habit {
  id: string;
  userId?: string;
  title: string;
  goalId?: string;
  schedule: HabitSchedule;
  archived: boolean;
  createdAt: string;
  updatedAt: string;
}

/** One record per habit per calendar day. Deleting it unchecks that day. */
export interface HabitCheckIn {
  id: string;
  userId?: string;
  habitId: string;
  date: string; // YYYY-MM-DD
  createdAt: string;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// Money ledger: accounts
// ---------------------------------------------------------------------------

export type AccountType = 'cash' | 'savings' | 'current' | 'other';

export interface Account {
  id: string;
  userId?: string;
  name: string; // "YES Bank", "Indian Bank", "Cash Wallet"
  type: AccountType;
  bankName?: string;
  accountNickname?: string;
  lastFourDigits?: string;
  /** Balance the account held before the first tracked transaction, in rupees. */
  openingBalance: number;
  /** Archived accounts keep their history but are excluded from totals/pickers. */
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * Ledger-wide preferences. Stored as an array (one record, id = 'ledger') so it
 * rides the same record-level sync/merge path as every other collection.
 */
export interface LedgerSettings {
  id: string;
  userId?: string;
  allowNegativeBalance: boolean;
  defaultAccountId?: string;
  updatedAt: string;
}

/**
 * `transfer` moves money between two accounts and is never counted as income
 * or expense. `upi` and `bank` are legacy payment methods kept so entries
 * created before the ledger existed still render correctly.
 */
export type TransactionType = 'expense' | 'income' | 'transfer';

export type PaymentMethod =
  | 'cash'
  | 'gpay'
  | 'phonepe'
  | 'bank_transfer'
  | 'card'
  | 'other'
  | 'upi'
  | 'bank';

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
  time?: string; // HH:mm (optional)
  paymentMethod?: PaymentMethod;
  /** Funding account for expenses / receiving account for income. */
  accountId?: string;
  /** Transfers only: the account money lands in. */
  destinationAccountId?: string;
  /** Links an ATM-fee expense to the transfer that produced it. */
  linkedTransferId?: string;
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
  updatedAt?: string;
}

export interface CategoryBudget {
  id: string;
  userId?: string;
  month: string; // YYYY-MM
  category: string;
  limit: number;
  updatedAt?: string;
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
  updatedAt?: string;
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
  accountId?: string; // account the bill is paid from (optional)
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
