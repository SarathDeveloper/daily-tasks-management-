import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS } from './persistence';
import {
  BACKUP_ARRAY_KEYS,
  BackupError,
  automaticBackupSignature,
  buildBackup,
  parseBackup,
  stampImportedBackup,
  type BackupCollections,
} from './backup';

const emptyCollections = (): BackupCollections => ({
  tasks: [],
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
});

describe('buildBackup / parseBackup', () => {
  it('round-trips a version 1 snapshot and replaces every collection', () => {
    const file = buildBackup({
      ...emptyCollections(),
      tasks: [{ id: 'task-1' } as BackupCollections['tasks'][number]],
      diaryEntries: [{ id: 'diary-1', images: [{ id: 'img', dataUrl: 'data:image/jpeg;base64,abc' }] } as BackupCollections['diaryEntries'][number]],
      settings: { ...DEFAULT_SETTINGS, localMusicName: 'Morning.mp3', soundEnabled: false },
      theme: 'dark',
      budgetAlertState: { '2026-10': { eightyNotifiedAt: '2026-10-02T00:00:00.000Z' } },
    });

    const parsed = parseBackup(JSON.parse(JSON.stringify(file)));

    expect(parsed.mode).toBe('full');
    expect(parsed.present).toEqual([...BACKUP_ARRAY_KEYS, 'settings']);
    expect(parsed.data.tasks).toEqual([{ id: 'task-1' }]);
    expect(parsed.data.diaryEntries).toEqual([
      { id: 'diary-1', images: [{ id: 'img', dataUrl: 'data:image/jpeg;base64,abc' }] },
    ]);
    expect(parsed.data.habits).toEqual([]);
    expect(parsed.data.settings?.localMusicName).toBe('Morning.mp3');
    expect(parsed.data.settings?.soundEnabled).toBe(false);
    expect(parsed.theme).toBe('dark');
    expect(parsed.budgetAlertState).toEqual({
      '2026-10': { eightyNotifiedAt: '2026-10-02T00:00:00.000Z' },
    });
    expect(file).not.toHaveProperty('user');
    expect(file).not.toHaveProperty('passwordHash');
  });

  it('treats a legacy flat export as a partial replace', () => {
    const parsed = parseBackup({
      tasks: [{ id: 'old-task' }],
      categories: [{ id: 'cat-1' }],
      savingsStreak: { count: 4 },
      user: { id: 'u1', passwordHash: 'secret' },
    });

    expect(parsed.mode).toBe('partial');
    expect(parsed.present).toEqual(['tasks', 'categories']);
    expect(parsed.data.tasks).toEqual([{ id: 'old-task' }]);
    expect(parsed.data.habits).toBeUndefined();
    expect(parsed.data.settings).toBeUndefined();
    expect(parsed.theme).toBeUndefined();
    expect(parsed.budgetAlertState).toBeUndefined();
  });

  it('fills missing collections when a version 1 file omits them', () => {
    const parsed = parseBackup({ app: 'dayflow', version: 1, tasks: [] });

    expect(parsed.mode).toBe('full');
    expect(parsed.data.tasks).toEqual([]);
    expect(parsed.data.alarms).toEqual([]);
    expect(parsed.data.settings).toEqual(DEFAULT_SETTINGS);
    expect(parsed.present).toContain('settings');
  });

  it('stamps imported records so they are newer than a cloud copy', () => {
    const parsed = parseBackup({
      tasks: [{ id: 't', title: 'Old', updatedAt: '2020-01-01T00:00:00.000Z' }],
      habits: [],
    });
    const stamped = stampImportedBackup(parsed, '2026-10-31T10:00:00.000Z');

    expect(stamped.data.tasks).toEqual([
      { id: 't', title: 'Old', updatedAt: '2026-10-31T10:00:00.000Z' },
    ]);
    expect(stamped.data.habits).toEqual([]);
    expect(stamped.data.alarms).toBeUndefined();
    expect(parsed.data.tasks).toEqual([
      { id: 't', title: 'Old', updatedAt: '2020-01-01T00:00:00.000Z' },
    ]);
  });

  it('treats a new export time as the same automatic backup', () => {
    const first = buildBackup({
      ...emptyCollections(),
      tasks: [{ id: 'task-1' } as BackupCollections['tasks'][number]],
      theme: 'light',
      budgetAlertState: {},
    });
    const second = { ...first, exportedAt: '2099-01-01T00:00:00.000Z' };
    expect(automaticBackupSignature(first)).toBe(automaticBackupSignature(second));
    expect(automaticBackupSignature({ ...first, tasks: [] })).not.toBe(automaticBackupSignature(first));
  });

  it('rejects files that are not backups', () => {
    expect(() => parseBackup(null)).toThrow(BackupError);
    expect(() => parseBackup([])).toThrow(BackupError);
    expect(() => parseBackup({ nope: true })).toThrow(BackupError);
    expect(() => parseBackup({ tasks: 'not-a-list' })).toThrow(BackupError);
    expect(() => parseBackup({ version: 1 })).toThrow(BackupError);
    expect(() => parseBackup({ version: 2, tasks: [] })).toThrow(/newer version/);
  });
});
