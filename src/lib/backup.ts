import type {
  Account,
  Alarm,
  BillPayment,
  BillTemplate,
  BudgetAlertState,
  Category,
  CategoryBudget,
  FinanceCategory,
  Debt,
  DiaryEntry,
  FinanceTransaction,
  Goal,
  Habit,
  HabitCheckIn,
  LedgerSettings,
  MonthlyBudget,
  NotificationSettings,
  SavingsEntry,
  SavingsGoal,
  Task,
} from '../types';
import { DEFAULT_SETTINGS } from './persistence';

export const BACKUP_APP = 'dayflow';
export const BACKUP_VERSION = 1;

export const BACKUP_ARRAY_KEYS = [
  'tasks',
  'categories',
  'transactions',
  'accounts',
  'ledgerSettings',
  'budgets',
  'categoryBudgets',
  'financeCategories',
  'debts',
  'savingsGoals',
  'savingsEntries',
  'goals',
  'habits',
  'habitCheckIns',
  'alarms',
  'diaryEntries',
  'billTemplates',
  'billPayments',
] as const;

export type BackupArrayKey = (typeof BACKUP_ARRAY_KEYS)[number];
export type BackupCollectionKey = BackupArrayKey | 'settings';

export interface BackupCollections {
  tasks: Task[];
  categories: Category[];
  transactions: FinanceTransaction[];
  accounts: Account[];
  ledgerSettings: LedgerSettings[];
  budgets: MonthlyBudget[];
  categoryBudgets: CategoryBudget[];
  financeCategories: FinanceCategory[];
  debts: Debt[];
  savingsGoals: SavingsGoal[];
  savingsEntries: SavingsEntry[];
  goals: Goal[];
  habits: Habit[];
  habitCheckIns: HabitCheckIn[];
  alarms: Alarm[];
  diaryEntries: DiaryEntry[];
  billTemplates: BillTemplate[];
  billPayments: BillPayment[];
  settings: NotificationSettings;
}

export interface BackupFile extends BackupCollections {
  app: typeof BACKUP_APP;
  version: typeof BACKUP_VERSION;
  exportedAt: string;
  theme: 'light' | 'dark';
  budgetAlertState: BudgetAlertState;
}

export interface ParsedBackup {
  mode: 'full' | 'partial';
  /** Collections this import replaces. A version 1 file lists every collection. */
  present: BackupCollectionKey[];
  data: Partial<BackupCollections>;
  theme?: 'light' | 'dark';
  budgetAlertState?: BudgetAlertState;
}

export class BackupError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BackupError';
  }
}

const INVALID_FILE = 'This file is not a Dayflow backup.';

export function backupFilename(date = new Date()): string {
  return `dayflow-backup-${date.toISOString().split('T')[0]}.json`;
}

/** Single file replaced in the folder chosen for automatic backup. */
export const AUTOMATIC_BACKUP_FILENAME = 'dayflow-backup.json';

/** Same data with a new export time still counts as unchanged. */
export function automaticBackupSignature(file: BackupFile): string {
  return JSON.stringify({ ...file, exportedAt: '' });
}

export function buildBackup(
  input: BackupCollections & { theme: 'light' | 'dark'; budgetAlertState: BudgetAlertState }
): BackupFile {
  return {
    app: BACKUP_APP,
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    theme: input.theme,
    budgetAlertState: input.budgetAlertState,
    tasks: input.tasks,
    categories: input.categories,
    transactions: input.transactions,
    accounts: input.accounts,
    ledgerSettings: input.ledgerSettings,
    budgets: input.budgets,
    categoryBudgets: input.categoryBudgets,
    financeCategories: input.financeCategories ?? [],
    debts: input.debts,
    savingsGoals: input.savingsGoals,
    savingsEntries: input.savingsEntries,
    goals: input.goals,
    habits: input.habits,
    habitCheckIns: input.habitCheckIns,
    alarms: input.alarms,
    diaryEntries: input.diaryEntries,
    billTemplates: input.billTemplates,
    billPayments: input.billPayments,
    settings: input.settings,
  };
}

export function recordIds(list: unknown): string[] {
  if (!Array.isArray(list)) return [];
  const ids: string[] = [];
  for (const item of list) {
    if (item && typeof item === 'object' && typeof (item as { id?: unknown }).id === 'string') {
      ids.push((item as { id: string }).id);
    }
  }
  return ids;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function normalizeSettings(value: unknown): NotificationSettings {
  const partial = isPlainObject(value) ? (value as Partial<NotificationSettings>) : {};
  const quiet = partial.quietHours;
  return {
    ...DEFAULT_SETTINGS,
    ...partial,
    quietHours: {
      ...DEFAULT_SETTINGS.quietHours,
      ...(quiet && typeof quiet === 'object' ? quiet : {}),
    },
  };
}

export function parseBackup(raw: unknown): ParsedBackup {
  if (!isPlainObject(raw)) throw new BackupError(INVALID_FILE);
  const obj = raw;

  if (obj.version !== undefined && obj.version !== BACKUP_VERSION) {
    throw new BackupError('This backup was made by a newer version of the app.');
  }

  for (const key of BACKUP_ARRAY_KEYS) {
    if (obj[key] !== undefined && !Array.isArray(obj[key])) throw new BackupError(INVALID_FILE);
  }
  if (obj.settings !== undefined && !isPlainObject(obj.settings)) throw new BackupError(INVALID_FILE);
  if (obj.budgetAlertState !== undefined && !isPlainObject(obj.budgetAlertState)) {
    throw new BackupError(INVALID_FILE);
  }

  const full = obj.version === BACKUP_VERSION;
  const hasSettings = isPlainObject(obj.settings);
  const hasAnyCollection = BACKUP_ARRAY_KEYS.some((key) => Array.isArray(obj[key])) || hasSettings;
  if (!hasAnyCollection) throw new BackupError(INVALID_FILE);

  const data: Partial<BackupCollections> = {};
  const present: BackupCollectionKey[] = [];

  for (const key of BACKUP_ARRAY_KEYS) {
    if (full) {
      // Older backups omit this list. Leaving it absent keeps names already saved.
      if (key === 'financeCategories' && obj[key] === undefined) continue;
      data[key] = (Array.isArray(obj[key]) ? obj[key] : []) as never;
      present.push(key);
    } else if (Array.isArray(obj[key])) {
      data[key] = obj[key] as never;
      present.push(key);
    }
  }

  if (full || hasSettings) {
    data.settings = normalizeSettings(hasSettings ? obj.settings : undefined);
    present.push('settings');
  }

  const theme = obj.theme === 'light' || obj.theme === 'dark' ? obj.theme : undefined;
  const budgetAlertState = isPlainObject(obj.budgetAlertState)
    ? (obj.budgetAlertState as BudgetAlertState)
    : undefined;

  return { mode: full ? 'full' : 'partial', present, data, theme, budgetAlertState };
}

/**
 * Mark every imported record as edited now. Drive sync keeps the newer copy,
 * so without this an older backup would be overwritten by the cloud a few
 * seconds after import.
 */
export function stampImportedBackup(parsed: ParsedBackup, now = new Date().toISOString()): ParsedBackup {
  const data: Partial<BackupCollections> = { ...parsed.data };
  for (const key of parsed.present) {
    if (key === 'settings') continue;
    const list = data[key];
    if (!Array.isArray(list)) continue;
    data[key] = list.map((item) =>
      item && typeof item === 'object' ? { ...item, updatedAt: now } : item
    ) as never;
  }
  return { ...parsed, data };
}

export function isShareCancel(error: unknown): boolean {
  return Boolean(error) && typeof error === 'object' && (error as { name?: string }).name === 'AbortError';
}

/**
 * Share the backup when the device can hand a file to another app.
 * Otherwise download it. The object URL stays alive long enough for the download to start.
 */
export async function saveBackupFile(contents: string, filename: string): Promise<void> {
  const file = new File([contents], filename, { type: 'application/json' });
  let canShareFiles = false;
  try {
    canShareFiles =
      typeof navigator !== 'undefined' &&
      typeof navigator.canShare === 'function' &&
      navigator.canShare({ files: [file] });
  } catch {
    canShareFiles = false;
  }

  if (canShareFiles) {
    try {
      await navigator.share({ files: [file], title: 'Dayflow backup' });
      return;
    } catch (error) {
      if (isShareCancel(error)) throw error;
    }
  }

  const blob = new Blob([contents], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  window.setTimeout(() => {
    a.remove();
    URL.revokeObjectURL(url);
  }, 1500);
}
