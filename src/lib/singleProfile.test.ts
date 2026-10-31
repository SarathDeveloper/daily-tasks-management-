import { beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, DATA_SCHEMA_VERSION, getStorageKeys, type SyncData, type SyncEnvelope } from './persistence';
import {
  LEGACY_DRIVE_PROFILE_KEY,
  dropUntouchedStarterTasks,
  migrateToSingleProfile,
  preferRealTaskLists,
} from './singleProfile';

class MemoryStorage {
  private store = new Map<string, string>();
  getItem(key: string) {
    return this.store.has(key) ? (this.store.get(key) as string) : null;
  }
  setItem(key: string, value: string) {
    this.store.set(key, value);
  }
  removeItem(key: string) {
    this.store.delete(key);
  }
}

const CURRENT_USER_KEY = 'daily_tasks_current_user_v1';

function task(id: string, updatedAt: string) {
  return { id, title: id, updatedAt, createdAt: updatedAt };
}

function envelope(tasks: { id: string }[]): SyncEnvelope {
  const data: SyncData = {
    tasks: tasks as SyncData['tasks'],
    categories: [],
    transactions: [],
    accounts: [],
    ledgerSettings: [],
    budgets: [],
    categoryBudgets: [],
    debts: [],
    savingsGoals: [],
    savingsEntries: [],
    goals: [],
    habits: [],
    habitCheckIns: [],
    alarms: [],
    diaryEntries: [],
    billTemplates: [],
    billPayments: [],
    settings: DEFAULT_SETTINGS,
  };
  return {
    schemaVersion: DATA_SCHEMA_VERSION,
    deviceId: 'device-a',
    updatedAt: '2026-10-01T00:00:00.000Z',
    settingsUpdatedAt: '2026-10-01T00:00:00.000Z',
    tombstones: {},
    data,
  };
}

beforeEach(() => {
  Object.defineProperty(globalThis, 'localStorage', {
    value: new MemoryStorage(),
    configurable: true,
  });
});

describe('migrateToSingleProfile', () => {
  it('folds a signed-in profile onto the default keys and clears the session', () => {
    const profileId = 'usr-1';
    localStorage.setItem(
      CURRENT_USER_KEY,
      JSON.stringify({ id: profileId, name: 'A', email: 'a@example.com' })
    );
    localStorage.setItem('daily_tasks_users_v1', JSON.stringify([{ id: profileId, passwordHash: 'secret' }]));
    const globalKeys = getStorageKeys(null);
    const profileKeys = getStorageKeys(profileId);
    localStorage.setItem(
      globalKeys.tasks,
      JSON.stringify([
        task('task-1', '2026-01-01T00:00:00.000Z'),
        task('task-2', '2026-01-01T00:00:00.000Z'),
        task('task-3', '2026-01-01T00:00:00.000Z'),
        task('task-4', '2026-01-01T00:00:00.000Z'),
        task('task-5', '2026-01-01T00:00:00.000Z'),
      ])
    );
    localStorage.setItem(
      profileKeys.tasks,
      JSON.stringify([task('task-real', '2026-02-01T00:00:00.000Z')])
    );
    localStorage.setItem(
      profileKeys.transactions,
      JSON.stringify([
        {
          id: 'tx-1',
          type: 'expense',
          amount: 12,
          date: '2026-02-01',
          updatedAt: '2026-02-01T00:00:00.000Z',
          createdAt: '2026-02-01T00:00:00.000Z',
        },
      ])
    );

    migrateToSingleProfile();

    const tasks = JSON.parse(localStorage.getItem(globalKeys.tasks) as string) as { id: string }[];
    const transactions = JSON.parse(localStorage.getItem(globalKeys.transactions) as string) as {
      id: string;
    }[];
    expect(tasks.map((item) => item.id)).toEqual(['task-real']);
    expect(transactions.map((item) => item.id)).toEqual(['tx-1']);
    expect(localStorage.getItem(globalKeys.categories)).toBeNull();
    expect(localStorage.getItem(CURRENT_USER_KEY)).toBeNull();
    expect(localStorage.getItem('daily_tasks_users_v1')).toBeNull();
    expect(localStorage.getItem(LEGACY_DRIVE_PROFILE_KEY)).toBe(profileId);

    migrateToSingleProfile();
    const again = JSON.parse(localStorage.getItem(globalKeys.tasks) as string) as { id: string }[];
    expect(again).toHaveLength(1);
  });

  it('keeps the newer copy when both sides have the same record', () => {
    const profileId = 'usr-2';
    localStorage.setItem(CURRENT_USER_KEY, JSON.stringify({ id: profileId }));
    const globalKeys = getStorageKeys(null);
    const profileKeys = getStorageKeys(profileId);
    localStorage.setItem(
      globalKeys.tasks,
      JSON.stringify([task('task-real', '2026-03-01T00:00:00.000Z')])
    );
    localStorage.setItem(
      profileKeys.tasks,
      JSON.stringify([{ ...task('task-real', '2026-04-01T00:00:00.000Z'), title: 'From profile' }])
    );

    migrateToSingleProfile();

    const tasks = JSON.parse(localStorage.getItem(globalKeys.tasks) as string) as {
      title: string;
    }[];
    expect(tasks).toHaveLength(1);
    expect(tasks[0].title).toBe('From profile');
  });

  it('does not fold a sample-only profile into real tasks', () => {
    const profileId = 'usr-demo';
    localStorage.setItem(CURRENT_USER_KEY, JSON.stringify({ id: profileId }));
    const globalKeys = getStorageKeys(null);
    const profileKeys = getStorageKeys(profileId);
    localStorage.setItem(globalKeys.tasks, JSON.stringify([task('task-real', '2026-05-01T00:00:00.000Z')]));
    localStorage.setItem(
      profileKeys.tasks,
      JSON.stringify([
        task('task-1', '2026-06-01T00:00:00.000Z'),
        task('task-2', '2026-06-01T00:00:00.000Z'),
      ])
    );

    migrateToSingleProfile();

    const tasks = JSON.parse(localStorage.getItem(globalKeys.tasks) as string) as { id: string }[];
    expect(tasks.map((item) => item.id)).toEqual(['task-real']);
  });

  it('does nothing when this device was never signed in', () => {
    const globalKeys = getStorageKeys(null);
    localStorage.setItem(globalKeys.tasks, JSON.stringify([task('task-real', '2026-01-01T00:00:00.000Z')]));

    migrateToSingleProfile();

    expect(localStorage.getItem(LEGACY_DRIVE_PROFILE_KEY)).toBeNull();
    const tasks = JSON.parse(localStorage.getItem(globalKeys.tasks) as string) as { id: string }[];
    expect(tasks.map((item) => item.id)).toEqual(['task-real']);
  });
});

describe('dropUntouchedStarterTasks', () => {
  const starters = ['task-1', 'task-2', 'task-3', 'task-4', 'task-5'].map((id) => ({ id }));

  it('omits the sample day when the other device already has real tasks', () => {
    const local = envelope(starters);
    const remote = envelope([{ id: 'task-real' }]);
    expect(dropUntouchedStarterTasks(local, remote).data.tasks).toEqual([]);
  });

  it('keeps starter tasks when the remote snapshot has no real tasks', () => {
    const local = envelope(starters);
    expect(dropUntouchedStarterTasks(local, envelope(starters)).data.tasks).toHaveLength(5);
    expect(dropUntouchedStarterTasks(local, null).data.tasks).toHaveLength(5);
  });

  it('keeps a local list that already has a real task', () => {
    const local = envelope([...starters, { id: 'task-real' }]);
    const remote = envelope([{ id: 'task-other' }]);
    expect(dropUntouchedStarterTasks(local, remote).data.tasks).toHaveLength(6);
  });

  it('drops a remote sample day when this device already has real tasks', () => {
    const local = envelope([{ id: 'task-real' }]);
    const remote = envelope(starters);
    const paired = preferRealTaskLists(local, remote);
    expect(paired.left.data.tasks.map((item) => item.id)).toEqual(['task-real']);
    expect(paired.right?.data.tasks).toEqual([]);
  });
});
