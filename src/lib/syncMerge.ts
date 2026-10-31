/**
 * Record-level three-way-ish merge between the local snapshot and the copy
 * stored in Google Drive.
 *
 * Strategy: last-write-wins per record using the record's `updatedAt` (falling
 * back to `createdAt`). Deletions win over records via tombstones, which are
 * pruned after 90 days. This is intentionally simple and predictable for the
 * single-user, one-or-two-device case.
 */
import type { LedgerSettings, NotificationSettings } from '../types';
import {
  DATA_SCHEMA_VERSION,
  pruneTombstones,
  type SyncData,
  type SyncEnvelope,
} from './persistence';

function timestampOf(record: { updatedAt?: string; createdAt?: string }): number {
  const raw = record.updatedAt || record.createdAt;
  const time = raw ? Date.parse(raw) : NaN;
  return Number.isFinite(time) ? time : 0;
}

interface MergeableRecord {
  id: string;
  updatedAt?: string;
  createdAt?: string;
}

/**
 * Merge two id-keyed collections.
 * - The newer record wins when both sides have the same id.
 * - Any id present in `tombstones` is removed regardless of side.
 * - Local ordering is preserved; remote-only records are appended in their
 *   original order so the UI does not jump around.
 */
export function mergeCollection<T extends MergeableRecord>(
  local: T[],
  remote: T[],
  tombstones: Record<string, string>
): T[] {
  const remoteById = new Map<string, T>();
  for (const record of remote) remoteById.set(record.id, record);

  const merged: T[] = [];
  const seen = new Set<string>();

  for (const record of local) {
    seen.add(record.id);
    const counterpart = remoteById.get(record.id);
    if (!counterpart) {
      merged.push(record);
      continue;
    }
    merged.push(timestampOf(counterpart) > timestampOf(record) ? counterpart : record);
  }

  for (const record of remote) {
    if (seen.has(record.id)) continue;
    merged.push(record);
  }

  return merged.filter((record) => {
    const tombstone = tombstones[record.id];
    if (!tombstone) return true;
    // A record edited after it was deleted on another device stays deleted:
    // deletion is the explicit user action and is cheap to redo.
    const deletedAt = Date.parse(tombstone);
    if (!Number.isFinite(deletedAt)) return false;
    return timestampOf(record) > deletedAt;
  });
}

function mergeSettings(
  local: NotificationSettings,
  remote: NotificationSettings,
  localUpdatedAt: string | undefined,
  remoteUpdatedAt: string | undefined
): NotificationSettings {
  const localTime = localUpdatedAt ? Date.parse(localUpdatedAt) : 0;
  const remoteTime = remoteUpdatedAt ? Date.parse(remoteUpdatedAt) : 0;
  return remoteTime > localTime ? remote : local;
}

export function mergeTombstones(
  local: Record<string, string>,
  remote: Record<string, string>
): Record<string, string> {
  const merged: Record<string, string> = {};
  for (const source of [remote, local]) {
    for (const [id, iso] of Object.entries(source || {})) {
      const existing = merged[id];
      if (!existing || Date.parse(iso) > Date.parse(existing)) merged[id] = iso;
    }
  }
  return pruneTombstones(merged);
}

/**
 * Merge the full local envelope with the one downloaded from Drive.
 * `deviceId` always stays local so the next upload is attributed correctly.
 */
export function mergeEnvelopes(local: SyncEnvelope, remote: SyncEnvelope | null): SyncEnvelope {
  if (!remote) return local;

  const tombstones = mergeTombstones(local.tombstones, remote.tombstones);
  const data: SyncData = {
    tasks: mergeCollection(local.data.tasks, remote.data.tasks, tombstones),
    categories: mergeCollection(local.data.categories, remote.data.categories, tombstones),
    transactions: mergeCollection(local.data.transactions, remote.data.transactions, tombstones),
    // `?? []` keeps a v1 Drive backup (no accounts) mergeable.
    accounts: mergeCollection(local.data.accounts ?? [], remote.data.accounts ?? [], tombstones),
    ledgerSettings: mergeCollection(
      local.data.ledgerSettings ?? [],
      remote.data.ledgerSettings ?? [],
      tombstones
    ),
    budgets: mergeCollection(local.data.budgets, remote.data.budgets, tombstones),
    categoryBudgets: mergeCollection(
      local.data.categoryBudgets,
      remote.data.categoryBudgets,
      tombstones
    ),
    financeCategories: mergeCollection(
      local.data.financeCategories ?? [],
      remote.data.financeCategories ?? [],
      tombstones
    ),
    debts: mergeCollection(local.data.debts, remote.data.debts, tombstones),
    savingsGoals: mergeCollection(local.data.savingsGoals, remote.data.savingsGoals, tombstones),
    savingsEntries: mergeCollection(
      local.data.savingsEntries,
      remote.data.savingsEntries,
      tombstones
    ),
    goals: mergeCollection(local.data.goals ?? [], remote.data.goals ?? [], tombstones),
    habits: mergeCollection(local.data.habits ?? [], remote.data.habits ?? [], tombstones),
    habitCheckIns: mergeCollection(
      local.data.habitCheckIns ?? [],
      remote.data.habitCheckIns ?? [],
      tombstones
    ),
    alarms: mergeCollection(local.data.alarms ?? [], remote.data.alarms ?? [], tombstones),
    diaryEntries: mergeCollection(
      local.data.diaryEntries ?? [],
      remote.data.diaryEntries ?? [],
      tombstones
    ),
    billTemplates: mergeCollection(local.data.billTemplates, remote.data.billTemplates, tombstones),
    billPayments: mergeCollection(local.data.billPayments, remote.data.billPayments, tombstones),
    settings: mergeSettings(
      local.data.settings,
      remote.data.settings,
      local.settingsUpdatedAt,
      remote.settingsUpdatedAt
    ),
  };

  const settingsUpdatedAt =
    Date.parse(remote.settingsUpdatedAt || '') > Date.parse(local.settingsUpdatedAt || '')
      ? remote.settingsUpdatedAt
      : local.settingsUpdatedAt;

  return {
    schemaVersion: DATA_SCHEMA_VERSION,
    deviceId: local.deviceId,
    updatedAt: new Date().toISOString(),
    settingsUpdatedAt,
    tombstones,
    data,
  };
}

/** True when the envelope carries no user records at all. */
export function isEnvelopeEmpty(envelope: SyncEnvelope | null): boolean {
  if (!envelope) return true;
  const data = envelope.data;
  return (
    !data ||
    (data.tasks.length === 0 &&
      data.categories.length === 0 &&
      data.transactions.length === 0 &&
      (data.accounts?.length ?? 0) === 0 &&
      (data.ledgerSettings?.length ?? 0) === 0 &&
      data.budgets.length === 0 &&
      data.categoryBudgets.length === 0 &&
      (data.financeCategories?.length ?? 0) === 0 &&
      data.debts.length === 0 &&
      data.savingsGoals.length === 0 &&
      data.savingsEntries.length === 0 &&
      (data.goals?.length ?? 0) === 0 &&
      (data.habits?.length ?? 0) === 0 &&
      (data.habitCheckIns?.length ?? 0) === 0 &&
      (data.alarms?.length ?? 0) === 0 &&
      (data.diaryEntries?.length ?? 0) === 0 &&
      data.billTemplates.length === 0 &&
      data.billPayments.length === 0)
  );
}

/** Defensive validation for JSON downloaded from Drive. */
export function isValidEnvelope(value: unknown): value is SyncEnvelope {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<SyncEnvelope>;
  if (!candidate.data || typeof candidate.data !== 'object') return false;
  const data = candidate.data as Partial<SyncData>;
  const arrays: (keyof SyncData)[] = [
    'tasks',
    'categories',
    'transactions',
    'budgets',
    'categoryBudgets',
    'debts',
    'savingsGoals',
    'savingsEntries',
    'billTemplates',
    'billPayments',
  ];
  if (!arrays.every((key) => Array.isArray(data[key]))) return false;
  // Accounts were added in schema v2, goals, habits, and diary later. Older backups omit them.
  if (data.accounts !== undefined && !Array.isArray(data.accounts)) return false;
  if (data.ledgerSettings !== undefined && !Array.isArray(data.ledgerSettings)) return false;
  if (data.goals !== undefined && !Array.isArray(data.goals)) return false;
  if (data.habits !== undefined && !Array.isArray(data.habits)) return false;
  if (data.habitCheckIns !== undefined && !Array.isArray(data.habitCheckIns)) return false;
  if (data.alarms !== undefined && !Array.isArray(data.alarms)) return false;
  if (data.diaryEntries !== undefined && !Array.isArray(data.diaryEntries)) return false;
  if (data.financeCategories !== undefined && !Array.isArray(data.financeCategories)) return false;
  return true;
}
