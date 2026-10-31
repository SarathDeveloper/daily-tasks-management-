import { afterEach, describe, expect, it, vi } from 'vitest';
import type { SyncEnvelope } from '../lib/persistence';
import {
  DriveError,
  DriveScopeError,
  downloadSyncFile,
  legacySyncFileName,
  loadCloudSnapshot,
  saveCloudSnapshot,
  SYNC_FILE_NAME,
  syncFileNameFor,
} from './driveSyncService';

const snapshot = {
  schemaVersion: 2,
  deviceId: 'device-1',
  updatedAt: '2026-10-31T00:00:00.000Z',
  settingsUpdatedAt: '2026-10-31T00:00:00.000Z',
  tombstones: {},
  data: {
    tasks: [{ id: 'task-real', title: 'Dayflow task' }],
    categories: [],
    transactions: [],
    budgets: [],
    categoryBudgets: [],
    debts: [],
    savingsGoals: [],
    savingsEntries: [],
    billTemplates: [],
    billPayments: [],
    settings: {},
  },
} as SyncEnvelope;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

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

describe('Drive backup file', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('uploads into the Dayflow folder and reads the file back before succeeding', async () => {
    const calls: { url: string; method: string; body?: string; authorization: string | null }[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init?: RequestInit) => {
        const method = init?.method ?? 'GET';
        const headers = new Headers(init?.headers);
        calls.push({
          url,
          method,
          body: typeof init?.body === 'string' ? init.body : undefined,
          authorization: headers.get('Authorization'),
        });
        if (method === 'POST' && url.includes('uploadType=multipart')) return json({ id: 'file-1' });
        if (method === 'GET' && url.includes('/files/file-1')) return json(snapshot);
        return json({ error: { message: 'unexpected' } }, 500);
      })
    );

    await saveCloudSnapshot('token-1', 'folder-1', null, snapshot);

    const upload = calls.find((call) => call.url.includes('uploadType=multipart'));
    expect(upload?.method).toBe('POST');
    expect(upload?.authorization).toBe('Bearer token-1');
    expect(upload?.body).toContain('Dayflow task');
    expect(upload?.body).toContain('"parents":["folder-1"]');
    expect(upload?.body).toContain('daily-tasks-sync.json');
    expect(calls.some((call) => call.method === 'GET' && call.url.includes('alt=media'))).toBe(true);
  });

  it('does not treat an upload as saved when Drive returns different records', async () => {
    const patches: { url: string; body: string }[] = [];
    vi.stubGlobal('fetch', async (url: string, init?: RequestInit) => {
      if ((init?.method ?? 'GET') === 'PATCH') {
        patches.push({ url, body: typeof init?.body === 'string' ? init.body : '' });
        return json({ id: 'file-1' });
      }
      if (url.includes('alt=media')) {
        return json({ ...snapshot, data: { ...snapshot.data, tasks: [] } });
      }
      return json({ error: { message: 'unexpected' } }, 500);
    });

    await expect(
      saveCloudSnapshot('token-1', 'folder-1', { id: 'file-1', name: SYNC_FILE_NAME }, snapshot)
    ).rejects.toBeInstanceOf(DriveError);
    expect(patches[0]?.url).toContain('uploadType=multipart');
    expect(patches[0]?.body).toContain('Dayflow task');
    expect(patches[0]?.body).toContain('daily-tasks-sync.json');
    expect(patches[0]?.body).not.toContain('"parents"');
  });

  it('ignores a Drive file that is not a snapshot so a later sync can replace it', async () => {
    vi.stubGlobal('fetch', async () => new Response('not-json', { status: 200 }));
    await expect(downloadSyncFile('token-1', 'file-1')).resolves.toBeNull();
  });

  it('reads the visible Dayflow file instead of the hidden app folder', async () => {
    const spaces: string[] = [];
    vi.stubGlobal('fetch', async (url: string) => {
      const parsed = new URL(url);
      const space = parsed.searchParams.get('spaces') ?? '';
      if (space) spaces.push(space);
      const query = parsed.searchParams.get('q') ?? '';
      if (query.includes('mimeType')) return json({ files: [{ id: 'folder-1', name: 'Dayflow' }] });
      if (query.includes('in parents')) {
        return json({ files: [{ id: 'file-1', name: SYNC_FILE_NAME }] });
      }
      if (url.includes('/files/file-1')) return json(snapshot);
      return json({ files: [] });
    });

    const cloud = await loadCloudSnapshot('token-1', null);
    expect(cloud.folderId).toBe('folder-1');
    expect(cloud.file?.id).toBe('file-1');
    expect(cloud.visible?.data.tasks[0]).toMatchObject({ id: 'task-real' });
    expect(cloud.hidden).toEqual([]);
    expect(spaces).not.toContain('appDataFolder');
  });

  it('pulls an older hidden backup when the Dayflow file is not there yet', async () => {
    vi.stubGlobal('fetch', async (url: string) => {
      const parsed = new URL(url);
      const query = parsed.searchParams.get('q') ?? '';
      if (parsed.searchParams.get('spaces') === 'appDataFolder') {
        if (query.includes('usr-1')) return json({ files: [] });
        return json({ files: [{ id: 'hidden-1', name: SYNC_FILE_NAME }] });
      }
      if (query.includes('mimeType')) return json({ files: [{ id: 'folder-1', name: 'Dayflow' }] });
      if (url.includes('/files/hidden-1')) return json(snapshot);
      return json({ files: [] });
    });

    const cloud = await loadCloudSnapshot('token-1', 'usr-1');
    expect(cloud.file).toBeNull();
    expect(cloud.visible).toBeNull();
    expect(cloud.hidden).toHaveLength(1);
    expect(cloud.hidden[0].data.tasks[0]).toMatchObject({ title: 'Dayflow task' });
  });

  it('reports a missing Drive permission instead of a successful sync', async () => {
    vi.stubGlobal('fetch', async () =>
      json(
        {
          error: {
            message: 'Insufficient Permission',
            errors: [{ reason: 'insufficientPermissions' }],
          },
        },
        403
      )
    );

    await expect(loadCloudSnapshot('token-1', null)).rejects.toBeInstanceOf(DriveScopeError);
  });
});
