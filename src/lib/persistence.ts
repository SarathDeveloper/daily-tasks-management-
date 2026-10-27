/**
 * Single source of truth for every localStorage key the app owns, plus the
 * snapshot helpers used by the Google Drive sync engine.
 *
 * Keeping the key names in one place makes it possible to (a) reload the whole
 * app from storage after a cloud pull and (b) build a sync payload without
 * threading a dozen callbacks through `App.tsx`.
 */
import type {
  Account,
  BillPayment,
  BillTemplate,
  Category,
  CategoryBudget,
  Debt,
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

export interface StorageKeys {
  tasks: string;
  categories: string;
  transactions: string;
  accounts: string;
  ledgerSettings: string;
  budgets: string;
  categoryBudgets: string;
  debts: string;
  savingsGoals: string;
  savingsEntries: string;
  goals: string;
  habits: string;
  habitCheckIns: string;
  billTemplates: string;
  billPayments: string;
  alertState: string;
  savingsStreak: string;
  settings: string;
}

const GLOBAL_KEYS: StorageKeys = {
  tasks: 'daily_tasks_app_data_v1',
  categories: 'daily_tasks_categories_v1',
  transactions: 'daily_finance_transactions_v1',
  accounts: 'daily_finance_accounts_v1',
  ledgerSettings: 'daily_finance_ledger_settings_v1',
  budgets: 'daily_finance_budgets_v1',
  categoryBudgets: 'daily_finance_category_budgets_v1',
  debts: 'daily_finance_debts_v1',
  savingsGoals: 'daily_finance_savings_goals_v1',
  savingsEntries: 'daily_finance_savings_entries_v1',
  goals: 'daily_goals_v1',
  habits: 'daily_habits_v1',
  habitCheckIns: 'daily_habit_checkins_v1',
  billTemplates: 'daily_finance_bill_templates_v1',
  billPayments: 'daily_finance_bill_payments_v1',
  alertState: 'daily_finance_alert_state_v1',
  savingsStreak: 'daily_finance_savings_streak_v1',
  settings: 'daily_tasks_settings_v1',
};

/**
 * Storage keys are namespaced per signed-in profile. The un-signed-in keys are
 * kept byte-for-byte identical to the pre-sync app so existing installs keep
 * their data after the update.
 */
export function getStorageKeys(userId?: string | null): StorageKeys {
  if (!userId) return GLOBAL_KEYS;
  return {
    tasks: `daily_tasks_user_${userId}`,
    categories: `daily_tasks_categories_${userId}`,
    transactions: `daily_finance_user_${userId}`,
    accounts: `daily_finance_accounts_${userId}`,
    ledgerSettings: `daily_finance_ledger_settings_${userId}`,
    budgets: `daily_finance_budgets_${userId}`,
    categoryBudgets: `daily_finance_category_budgets_${userId}`,
    debts: `daily_finance_debts_${userId}`,
    savingsGoals: `daily_finance_savings_goals_${userId}`,
    savingsEntries: `daily_finance_savings_entries_${userId}`,
    goals: `daily_goals_${userId}`,
    habits: `daily_habits_${userId}`,
    habitCheckIns: `daily_habit_checkins_${userId}`,
    billTemplates: `daily_finance_bill_templates_${userId}`,
    billPayments: `daily_finance_bill_payments_${userId}`,
    alertState: `daily_finance_alert_state_${userId}`,
    savingsStreak: `daily_finance_savings_streak_${userId}`,
    settings: GLOBAL_KEYS.settings,
  };
}

export const DEFAULT_SETTINGS: NotificationSettings = {
  browserNotificationsEnabled: true,
  soundEnabled: true,
  speechEnabled: false,
  defaultSound: 'chime',
  quietHours: {
    enabled: false,
    start: '22:00',
    end: '07:00',
  },
};

export function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch (e) {
    console.warn(`Failed to parse storage key "${key}":`, e);
    return fallback;
  }
}

export function writeJson(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.warn(`Failed to write storage key "${key}":`, e);
  }
}

// ---------------------------------------------------------------------------
// Sync payload
// ---------------------------------------------------------------------------

export const DATA_SCHEMA_VERSION = 2;

export interface SyncData {
  tasks: Task[];
  categories: Category[];
  transactions: FinanceTransaction[];
  accounts: Account[];
  ledgerSettings: LedgerSettings[];
  budgets: MonthlyBudget[];
  categoryBudgets: CategoryBudget[];
  debts: Debt[];
  savingsGoals: SavingsGoal[];
  savingsEntries: SavingsEntry[];
  goals?: Goal[];
  habits?: Habit[];
  habitCheckIns?: HabitCheckIn[];
  billTemplates: BillTemplate[];
  billPayments: BillPayment[];
  settings: NotificationSettings;
}

/**
 * The JSON document stored in Drive's hidden appDataFolder.
 * `tombstones` maps a deleted record id to the ISO timestamp of the deletion so
 * a merge on the other device does not resurrect it.
 */
export interface SyncEnvelope {
  schemaVersion: number;
  deviceId: string;
  updatedAt: string;
  settingsUpdatedAt: string;
  tombstones: Record<string, string>;
  data: SyncData;
}

export function readSnapshot(keys: StorageKeys): SyncData {
  return {
    tasks: readJson<Task[]>(keys.tasks, []),
    categories: readJson<Category[]>(keys.categories, []),
    transactions: readJson<FinanceTransaction[]>(keys.transactions, []),
    accounts: readJson<Account[]>(keys.accounts, []),
    ledgerSettings: readJson<LedgerSettings[]>(keys.ledgerSettings, []),
    budgets: readJson<MonthlyBudget[]>(keys.budgets, []),
    categoryBudgets: readJson<CategoryBudget[]>(keys.categoryBudgets, []),
    debts: readJson<Debt[]>(keys.debts, []),
    savingsGoals: readJson<SavingsGoal[]>(keys.savingsGoals, []),
    savingsEntries: readJson<SavingsEntry[]>(keys.savingsEntries, []),
    goals: readJson<Goal[]>(keys.goals, []),
    habits: readJson<Habit[]>(keys.habits, []),
    habitCheckIns: readJson<HabitCheckIn[]>(keys.habitCheckIns, []),
    billTemplates: readJson<BillTemplate[]>(keys.billTemplates, []),
    billPayments: readJson<BillPayment[]>(keys.billPayments, []),
    settings: {
      ...DEFAULT_SETTINGS,
      ...readJson<Partial<NotificationSettings>>(keys.settings, {}),
    },
  };
}

export function writeSnapshot(keys: StorageKeys, data: SyncData): void {
  writeJson(keys.tasks, data.tasks);
  writeJson(keys.categories, data.categories);
  writeJson(keys.transactions, data.transactions);
  writeJson(keys.accounts, data.accounts ?? []);
  writeJson(keys.ledgerSettings, data.ledgerSettings ?? []);
  writeJson(keys.budgets, data.budgets);
  writeJson(keys.categoryBudgets, data.categoryBudgets);
  writeJson(keys.debts, data.debts);
  writeJson(keys.savingsGoals, data.savingsGoals);
  writeJson(keys.savingsEntries, data.savingsEntries);
  writeJson(keys.goals, data.goals ?? []);
  writeJson(keys.habits, data.habits ?? []);
  writeJson(keys.habitCheckIns, data.habitCheckIns ?? []);
  writeJson(keys.billTemplates, data.billTemplates);
  writeJson(keys.billPayments, data.billPayments);
  writeJson(keys.settings, data.settings);
}

export function countRecords(data: SyncData): number {
  return (
    data.tasks.length +
    data.categories.length +
    data.transactions.length +
    (data.accounts?.length ?? 0) +
    (data.ledgerSettings?.length ?? 0) +
    data.budgets.length +
    data.categoryBudgets.length +
    data.debts.length +
    data.savingsGoals.length +
    data.savingsEntries.length +
    (data.goals?.length ?? 0) +
    (data.habits?.length ?? 0) +
    (data.habitCheckIns?.length ?? 0) +
    data.billTemplates.length +
    data.billPayments.length
  );
}

// ---------------------------------------------------------------------------
// Sync bookkeeping (tombstones, last sync timestamp)
// ---------------------------------------------------------------------------

export interface SyncMeta {
  lastSyncedAt?: string;
  /** ISO timestamp of the last local edit to notification settings. */
  settingsUpdatedAt?: string;
  /**
   * Serialized settings that `settingsUpdatedAt` refers to. Lets the app tell
   * "the user edited settings" apart from "settings just arrived from Drive",
   * which would otherwise re-stamp the pulled values as the newest edit.
   */
  settingsSnapshot?: string;
  /** Deleted record id -> ISO timestamp of deletion. */
  tombstones: Record<string, string>;
}

const TOMBSTONE_TTL_DAYS = 90;

function syncMetaKey(keys: StorageKeys): string {
  return `${keys.billPayments}__sync_meta`;
}

export function readSyncMeta(keys: StorageKeys): SyncMeta {
  const meta = readJson<SyncMeta>(syncMetaKey(keys), { tombstones: {} });
  return {
    lastSyncedAt: meta.lastSyncedAt,
    settingsUpdatedAt: meta.settingsUpdatedAt,
    settingsSnapshot: meta.settingsSnapshot,
    tombstones: pruneTombstones(meta.tombstones || {}),
  };
}

export function writeSyncMeta(keys: StorageKeys, meta: SyncMeta): void {
  writeJson(syncMetaKey(keys), {
    lastSyncedAt: meta.lastSyncedAt,
    settingsUpdatedAt: meta.settingsUpdatedAt,
    settingsSnapshot: meta.settingsSnapshot,
    tombstones: pruneTombstones(meta.tombstones || {}),
  });
}

export function markDeleted(keys: StorageKeys, ids: string[]): void {
  if (ids.length === 0) return;
  const meta = readSyncMeta(keys);
  const now = new Date().toISOString();
  for (const id of ids) meta.tombstones[id] = now;
  writeSyncMeta(keys, meta);
}

export function unmarkDeleted(keys: StorageKeys, ids: string[]): void {
  if (ids.length === 0) return;
  const meta = readSyncMeta(keys);
  let changed = false;
  for (const id of ids) {
    if (id in meta.tombstones) {
      delete meta.tombstones[id];
      changed = true;
    }
  }
  if (changed) writeSyncMeta(keys, meta);
}

export function pruneTombstones(tombstones: Record<string, string>): Record<string, string> {
  const cutoff = Date.now() - TOMBSTONE_TTL_DAYS * 24 * 60 * 60 * 1000;
  const pruned: Record<string, string> = {};
  for (const [id, iso] of Object.entries(tombstones)) {
    const time = Date.parse(iso);
    if (Number.isFinite(time) && time >= cutoff) pruned[id] = iso;
  }
  return pruned;
}

// ---------------------------------------------------------------------------
// Device identity
// ---------------------------------------------------------------------------

const DEVICE_ID_KEY = 'daily_tasks_device_id_v1';

export function getDeviceId(): string {
  let id = localStorage.getItem(DEVICE_ID_KEY);
  if (!id) {
    id =
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `dev-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    localStorage.setItem(DEVICE_ID_KEY, id);
  }
  return id;
}

/**
 * Ask the browser/WebView to keep this origin's storage out of the eviction
 * pool. Best-effort: silently ignored where unsupported.
 */
export async function requestPersistentStorage(): Promise<boolean> {
  try {
    if (navigator.storage?.persist) {
      if (await navigator.storage.persisted()) return true;
      return await navigator.storage.persist();
    }
  } catch (e) {
    console.warn('Persistent storage request failed:', e);
  }
  return false;
}
