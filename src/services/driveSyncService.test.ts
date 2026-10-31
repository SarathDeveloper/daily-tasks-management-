import { describe, expect, it } from 'vitest';
import { legacySyncFileName, syncFileNameFor, SYNC_FILE_NAME } from './driveSyncService';

describe('sync file name', () => {
  it('always uses the single shared Drive file', () => {
    expect(SYNC_FILE_NAME).toBe('daily-tasks-sync.json');
    expect(syncFileNameFor()).toBe('daily-tasks-sync.json');
    expect(syncFileNameFor(null)).toBe('daily-tasks-sync.json');
    expect(syncFileNameFor('usr-1')).toBe('daily-tasks-sync.json');
  });

  it('still names the old per-profile file for the one-time pull', () => {
    expect(legacySyncFileName('usr-1')).toBe('daily-tasks-sync-usr-1.json');
  });
});
