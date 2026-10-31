/**
 * One device, one set of storage keys, one Drive file.
 *
 * Older builds kept a signed-in profile in its own keys and its own Drive
 * file. This folds that profile into the default keys once, before React
 * reads storage, and remembers the id so the next merge can pull the old file.
 */
import type { BudgetAlertState, SavingsStreakState } from '../types';
import {
  getStorageKeys,
  readJson,
  readSnapshot,
  readSyncMeta,
  writeJson,
  writeSyncMeta,
  type SyncData,
  type SyncEnvelope,
} from './persistence';
import { mergeCollection, mergeTombstones } from './syncMerge';

const CURRENT_USER_KEY = 'daily_tasks_current_user_v1';
const USERS_KEY = 'daily_tasks_users_v1';
const MIGRATED_KEY = 'dayflow_single_profile_migrated_v1';

/** Set when a signed-in profile still has a Drive file to merge once. */
export const LEGACY_DRIVE_PROFILE_KEY = 'dayflow_legacy_drive_profile_v1';

/** Ids from `getInitialTasks`. A brand-new install has only these. */
export const STARTER_TASK_IDS = new Set(['task-1', 'task-2', 'task-3', 'task-4', 'task-5']);

interface StoredUser {
  id?: string;
}

export function isStarterOnlyTaskList(tasks: { id: string }[]): boolean {
  return tasks.length > 0 && tasks.every((task) => STARTER_TASK_IDS.has(task.id));
}

export function hasRealTasks(tasks: { id: string }[]): boolean {
  return tasks.some((task) => !STARTER_TASK_IDS.has(task.id));
}

function withoutTasks<T extends SyncEnvelope>(envelope: T): T {
  return { ...envelope, data: { ...envelope.data, tasks: [] } };
}

/**
 * A fresh install seeds the sample day before the first sync. Whichever side
 * is only that sample loses its tasks when the other side already has real
 * ones, so the sample is neither uploaded nor pulled back in.
 */
export function preferRealTaskLists<T extends SyncEnvelope>(
  left: T,
  right: T | null
): { left: T; right: T | null } {
  if (!right) return { left, right };
  const leftTasks = left.data.tasks ?? [];
  const rightTasks = right.data.tasks ?? [];
  const leftReal = hasRealTasks(leftTasks);
  const rightReal = hasRealTasks(rightTasks);
  return {
    left: rightReal && isStarterOnlyTaskList(leftTasks) ? withoutTasks(left) : left,
    right: leftReal && isStarterOnlyTaskList(rightTasks) ? withoutTasks(right) : right,
  };
}

/** Drop this device's sample day when the other snapshot already has real tasks. */
export function dropUntouchedStarterTasks(
  local: SyncEnvelope,
  remote: SyncEnvelope | null
): SyncEnvelope {
  return preferRealTaskLists(local, remote).left;
}

export function readLegacyDriveProfileId(): string | null {
  try {
    const id = localStorage.getItem(LEGACY_DRIVE_PROFILE_KEY);
    return id && id.trim() ? id : null;
  } catch {
    return null;
  }
}

export function clearLegacyDriveProfileId(): void {
  try {
    localStorage.removeItem(LEGACY_DRIVE_PROFILE_KEY);
  } catch {
    // Storage can be unavailable. The next launch will try the lookup again.
  }
}

function readStoredUser(): StoredUser | null {
  try {
    const raw = localStorage.getItem(CURRENT_USER_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredUser;
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

function keyExists(key: string): boolean {
  try {
    return localStorage.getItem(key) != null;
  } catch {
    return false;
  }
}

/** Absent keys stay absent so the app can still seed its defaults. */
function writeMergedSnapshot(
  globalKeys: ReturnType<typeof getStorageKeys>,
  profileKeys: ReturnType<typeof getStorageKeys>,
  merged: SyncData
): void {
  const fields = [
    'tasks',
    'categories',
    'transactions',
    'accounts',
    'ledgerSettings',
    'budgets',
    'categoryBudgets',
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
    'settings',
  ] as const;
  for (const field of fields) {
    if (!keyExists(globalKeys[field]) && !keyExists(profileKeys[field])) continue;
    writeJson(globalKeys[field], merged[field]);
  }
}

function laterSettingsStamp(left?: string, right?: string): string | undefined {
  const leftTime = left ? Date.parse(left) : NaN;
  const rightTime = right ? Date.parse(right) : NaN;
  if (!Number.isFinite(leftTime)) return right;
  if (!Number.isFinite(rightTime)) return left;
  return rightTime > leftTime ? right : left;
}

function mergeSnapshots(globalData: SyncData, profileData: SyncData, tombstones: Record<string, string>): SyncData {
  const dropGlobal =
    isStarterOnlyTaskList(globalData.tasks) && hasRealTasks(profileData.tasks);
  const dropProfile =
    isStarterOnlyTaskList(profileData.tasks) && hasRealTasks(globalData.tasks);
  const tasks = dropGlobal ? [] : globalData.tasks;
  const profileTasks = dropProfile ? [] : profileData.tasks;
  return {
    tasks: mergeCollection(tasks, profileTasks, tombstones),
    categories: mergeCollection(globalData.categories, profileData.categories, tombstones),
    transactions: mergeCollection(globalData.transactions, profileData.transactions, tombstones),
    accounts: mergeCollection(globalData.accounts ?? [], profileData.accounts ?? [], tombstones),
    ledgerSettings: mergeCollection(
      globalData.ledgerSettings ?? [],
      profileData.ledgerSettings ?? [],
      tombstones
    ),
    budgets: mergeCollection(globalData.budgets, profileData.budgets, tombstones),
    categoryBudgets: mergeCollection(
      globalData.categoryBudgets,
      profileData.categoryBudgets,
      tombstones
    ),
    debts: mergeCollection(globalData.debts, profileData.debts, tombstones),
    savingsGoals: mergeCollection(globalData.savingsGoals, profileData.savingsGoals, tombstones),
    savingsEntries: mergeCollection(globalData.savingsEntries, profileData.savingsEntries, tombstones),
    goals: mergeCollection(globalData.goals ?? [], profileData.goals ?? [], tombstones),
    habits: mergeCollection(globalData.habits ?? [], profileData.habits ?? [], tombstones),
    habitCheckIns: mergeCollection(
      globalData.habitCheckIns ?? [],
      profileData.habitCheckIns ?? [],
      tombstones
    ),
    alarms: mergeCollection(globalData.alarms ?? [], profileData.alarms ?? [], tombstones),
    diaryEntries: mergeCollection(globalData.diaryEntries ?? [], profileData.diaryEntries ?? [], tombstones),
    billTemplates: mergeCollection(globalData.billTemplates, profileData.billTemplates, tombstones),
    billPayments: mergeCollection(globalData.billPayments, profileData.billPayments, tombstones),
    settings: globalData.settings,
  };
}

function mergeAlertState(globalKey: string, profileKey: string): void {
  const profile = readJson<BudgetAlertState | null>(profileKey, null);
  if (!profile) return;
  const global = readJson<BudgetAlertState | null>(globalKey, null) ?? {};
  const next: BudgetAlertState = { ...global };
  for (const [key, entry] of Object.entries(profile)) {
    const existing = next[key];
    if (!existing) {
      next[key] = entry;
      continue;
    }
    const existingStamp = existing.hundredNotifiedAt || existing.eightyNotifiedAt || '';
    const profileStamp = entry.hundredNotifiedAt || entry.eightyNotifiedAt || '';
    if (profileStamp > existingStamp) next[key] = entry;
  }
  writeJson(globalKey, next);
}

function mergeSavingsStreak(globalKey: string, profileKey: string): void {
  const profile = readJson<SavingsStreakState | null>(profileKey, null);
  if (!profile) return;
  const global = readJson<SavingsStreakState | null>(globalKey, null);
  if (!global || (profile.lastSavedDate ?? '') > (global.lastSavedDate ?? '')) {
    writeJson(globalKey, profile);
  }
}

/** Fold a signed-in profile into the default keys. Safe to call on every boot. */
export function migrateToSingleProfile(): void {
  try {
    if (localStorage.getItem(MIGRATED_KEY) === '1') return;
  } catch {
    return;
  }

  const user = readStoredUser();
  const profileId = user?.id?.trim();
  if (!profileId) {
    try {
      localStorage.removeItem(CURRENT_USER_KEY);
      localStorage.removeItem(USERS_KEY);
      localStorage.setItem(MIGRATED_KEY, '1');
    } catch {
      // Nothing to fold. The next boot can try again.
    }
    return;
  }

  const globalKeys = getStorageKeys(null);
  const profileKeys = getStorageKeys(profileId);
  const globalMeta = readSyncMeta(globalKeys);
  const profileMeta = readSyncMeta(profileKeys);
  const tombstones = mergeTombstones(globalMeta.tombstones, profileMeta.tombstones);
  const merged = mergeSnapshots(readSnapshot(globalKeys), readSnapshot(profileKeys), tombstones);

  writeMergedSnapshot(globalKeys, profileKeys, merged);
  writeSyncMeta(globalKeys, {
    ...globalMeta,
    tombstones,
    settingsUpdatedAt: laterSettingsStamp(globalMeta.settingsUpdatedAt, profileMeta.settingsUpdatedAt),
  });
  mergeAlertState(globalKeys.alertState, profileKeys.alertState);
  mergeSavingsStreak(globalKeys.savingsStreak, profileKeys.savingsStreak);

  try {
    localStorage.setItem(LEGACY_DRIVE_PROFILE_KEY, profileId);
    localStorage.removeItem(CURRENT_USER_KEY);
    localStorage.removeItem(USERS_KEY);
    localStorage.setItem(MIGRATED_KEY, '1');
  } catch {
    // The fold is already on the default keys. Losing the legacy id only
    // skips the one Drive-file pull; local data is already combined.
  }
}
