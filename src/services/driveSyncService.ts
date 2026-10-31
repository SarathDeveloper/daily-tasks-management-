/**
 * Google Drive client for the Dayflow backup.
 *
 * The snapshot is a normal file, `Dayflow/daily-tasks-sync.json`, in the user's
 * My Drive. The hidden appDataFolder is only read once so an older backup can
 * be copied into that visible file. A sync is successful only after Drive
 * returns the same records that were uploaded.
 */
import { isValidEnvelope } from '../lib/syncMerge';
import type { SyncEnvelope } from '../lib/persistence';

const DRIVE_API = 'https://www.googleapis.com/drive/v3';
const DRIVE_UPLOAD = 'https://www.googleapis.com/upload/drive/v3';
const SYNC_FILE_BASE = 'daily-tasks-sync';
const FOLDER_MIME = 'application/vnd.google-apps.folder';

/** The only snapshot both this phone and the desktop site read and write. */
export const SYNC_FILE_NAME = `${SYNC_FILE_BASE}.json`;

/** Folder created in My Drive so the backup is visible in Google Drive. */
export const DRIVE_FOLDER_NAME = 'Dayflow';

export class DriveAuthError extends Error {
  constructor(message = 'Google Drive access expired.') {
    super(message);
    this.name = 'DriveAuthError';
  }
}

export class DriveScopeError extends Error {
  constructor(message = 'Google Drive permission is missing. Reconnect and allow access to Google Drive.') {
    super(message);
    this.name = 'DriveScopeError';
  }
}

export class DriveError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'DriveError';
    this.status = status;
  }
}

export interface DriveFileRef {
  id: string;
  name: string;
  modifiedTime?: string;
}

export interface CloudSnapshot {
  folderId: string;
  /** The visible Dayflow file, when it already exists. */
  file: DriveFileRef | null;
  /** Contents of that visible file. */
  visible: SyncEnvelope | null;
  /** Older hidden copies that still need to be merged once. */
  hidden: SyncEnvelope[];
}

/**
 * Desktop and phone share this one file. A signed-in local profile used to
 * get its own name; that id is ignored so both devices meet here.
 */
export function syncFileNameFor(_profileId?: string | null): string {
  return SYNC_FILE_NAME;
}

/** Name of the per-profile file written before the single-profile switch. */
export function legacySyncFileName(profileId: string): string {
  return `${SYNC_FILE_BASE}-${profileId}.json`;
}

/** True when two snapshots carry the same records and deletions. */
export function snapshotsMatch(a: SyncEnvelope, b: SyncEnvelope): boolean {
  try {
    return (
      JSON.stringify(a.data) === JSON.stringify(b.data) &&
      JSON.stringify(a.tombstones) === JSON.stringify(b.tombstones)
    );
  } catch {
    return false;
  }
}

function escapeQuery(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

async function driveFetch(
  token: string,
  url: string,
  init: RequestInit = {}
): Promise<Response> {
  const headers = new Headers(init.headers);
  headers.set('Authorization', `Bearer ${token}`);
  const response = await fetch(url, { ...init, headers });
  if (response.status === 401) throw new DriveAuthError();
  return response;
}

async function assertOk(response: Response, action: string): Promise<void> {
  if (response.ok) return;
  let message = `Drive ${action} failed (${response.status}).`;
  let reason = '';
  try {
    const body = (await response.json()) as {
      error?: { message?: string; errors?: { reason?: string }[] };
    };
    if (body.error?.message) message = `Drive ${action} failed: ${body.error.message}`;
    reason = body.error?.errors?.[0]?.reason ?? '';
  } catch {
    // The body was empty or not JSON.
  }
  if (
    response.status === 403 &&
    /insufficient|scope|forbidden|appNotAuthorized/i.test(`${reason} ${message}`)
  ) {
    throw new DriveScopeError(
      'Google Drive permission is missing. Reconnect and allow access to Google Drive.'
    );
  }
  throw new DriveError(response.status, message);
}

async function listFiles(
  token: string,
  query: string,
  space: 'drive' | 'appDataFolder'
): Promise<DriveFileRef[]> {
  const params = new URLSearchParams({
    spaces: space,
    fields: 'files(id,name,modifiedTime)',
    pageSize: '20',
    q: query,
  });
  if (space === 'drive') params.set('orderBy', 'modifiedTime desc');
  const response = await driveFetch(token, `${DRIVE_API}/files?${params.toString()}`);
  await assertOk(response, 'lookup');
  const body = (await response.json()) as { files?: DriveFileRef[] };
  return body.files ?? [];
}

async function findInParent(
  token: string,
  parentId: string,
  name: string
): Promise<DriveFileRef | null> {
  const files = await listFiles(
    token,
    `name = '${escapeQuery(name)}' and '${escapeQuery(parentId)}' in parents and trashed = false`,
    'drive'
  );
  return files[0] ?? null;
}

async function createFolder(token: string): Promise<DriveFileRef> {
  const response = await driveFetch(token, `${DRIVE_API}/files?fields=id,name`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: DRIVE_FOLDER_NAME,
      mimeType: FOLDER_MIME,
    }),
  });
  await assertOk(response, 'folder create');
  const created = (await response.json()) as { id?: string; name?: string };
  if (!created.id) throw new DriveError(0, 'Drive did not return the Dayflow folder.');
  return { id: created.id, name: created.name ?? DRIVE_FOLDER_NAME };
}

/** Finds or creates the My Drive folder that holds the backup. */
export async function ensureDayflowFolder(token: string): Promise<string> {
  const folders = await listFiles(
    token,
    `name = '${escapeQuery(DRIVE_FOLDER_NAME)}' and mimeType = '${FOLDER_MIME}' and trashed = false`,
    'drive'
  );
  for (const folder of folders) {
    const existing = await findInParent(token, folder.id, SYNC_FILE_NAME);
    if (existing) return folder.id;
  }
  if (folders[0]) return folders[0].id;
  const created = await createFolder(token);
  return created.id;
}

async function readHiddenFile(token: string, name: string): Promise<SyncEnvelope | null> {
  try {
    const files = await listFiles(
      token,
      `name = '${escapeQuery(name)}' and trashed = false`,
      'appDataFolder'
    );
    const file = files[0];
    if (!file) return null;
    return downloadSyncFile(token, file.id);
  } catch (error) {
    if (error instanceof DriveAuthError) throw error;
    if (error instanceof DriveScopeError || (error instanceof DriveError && error.status === 403)) {
      return null;
    }
    throw error;
  }
}

/**
 * Reads the visible backup. When that file is missing, also returns hidden
 * copies from the old app-data folder so they can be merged and re-uploaded.
 */
export async function loadCloudSnapshot(
  token: string,
  legacyProfileId?: string | null
): Promise<CloudSnapshot> {
  const folderId = await ensureDayflowFolder(token);
  const file = await findInParent(token, folderId, SYNC_FILE_NAME);
  const visible = file ? await downloadSyncFile(token, file.id) : null;
  const hidden: SyncEnvelope[] = [];
  if (!visible) {
    const shared = await readHiddenFile(token, SYNC_FILE_NAME);
    if (shared) hidden.push(shared);
  }
  if (legacyProfileId) {
    const legacy = await readHiddenFile(token, legacySyncFileName(legacyProfileId));
    if (legacy) hidden.push(legacy);
  }
  return { folderId, file, visible, hidden };
}

/** Downloads and validates a Drive file. An unreadable file is ignored. */
export async function downloadSyncFile(token: string, fileId: string): Promise<SyncEnvelope | null> {
  const response = await driveFetch(token, `${DRIVE_API}/files/${encodeURIComponent(fileId)}?alt=media`);
  await assertOk(response, 'download');
  let parsed: unknown;
  try {
    parsed = await response.json();
  } catch {
    console.warn('Remote sync file is not JSON; ignoring it.');
    return null;
  }
  if (!isValidEnvelope(parsed)) {
    console.warn('Remote sync file is not a recognised snapshot; ignoring it.');
    return null;
  }
  return parsed;
}

function multipartBody(folderId: string, envelope: SyncEnvelope, boundary: string): string {
  return mediaPart(
    envelope,
    boundary,
    JSON.stringify({
      name: SYNC_FILE_NAME,
      mimeType: 'application/json',
      parents: [folderId],
    })
  );
}

async function createSyncFile(
  token: string,
  folderId: string,
  envelope: SyncEnvelope
): Promise<string> {
  const boundary = `dayflow_${crypto.randomUUID().replace(/-/g, '')}`;
  const response = await driveFetch(
    token,
    `${DRIVE_UPLOAD}/files?uploadType=multipart&fields=id,name`,
    {
      method: 'POST',
      headers: { 'Content-Type': `multipart/related; boundary=${boundary}` },
      body: multipartBody(folderId, envelope, boundary),
    }
  );
  await assertOk(response, 'upload');
  const created = (await response.json()) as { id?: string };
  if (!created.id) throw new DriveError(0, 'Drive did not return the uploaded backup.');
  return created.id;
}

function mediaPart(envelope: SyncEnvelope, boundary: string, metadata: string): string {
  return [
    `--${boundary}`,
    'Content-Type: application/json; charset=UTF-8',
    '',
    metadata,
    `--${boundary}`,
    'Content-Type: application/json',
    '',
    JSON.stringify(envelope),
    `--${boundary}--`,
    '',
  ].join('\r\n');
}

async function writeMedia(token: string, fileId: string, envelope: SyncEnvelope): Promise<void> {
  // Multipart, not a raw JSON body. A plain application/json PATCH is easy for
  // Drive to treat as file metadata, which leaves the backup bytes unchanged.
  const boundary = `dayflow_${crypto.randomUUID().replace(/-/g, '')}`;
  const response = await driveFetch(
    token,
    `${DRIVE_UPLOAD}/files/${encodeURIComponent(fileId)}?uploadType=multipart`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': `multipart/related; boundary=${boundary}` },
      body: mediaPart(
        envelope,
        boundary,
        JSON.stringify({ name: SYNC_FILE_NAME, mimeType: 'application/json' })
      ),
    }
  );
  await assertOk(response, 'upload');
}

/**
 * Writes the snapshot into Dayflow/daily-tasks-sync.json, then reads it back.
 * Throws when Drive does not return the same records.
 */
export async function saveCloudSnapshot(
  token: string,
  folderId: string,
  existing: DriveFileRef | null,
  envelope: SyncEnvelope
): Promise<void> {
  const fileId = existing
    ? existing.id
    : await createSyncFile(token, folderId, envelope);
  if (existing) await writeMedia(token, fileId, envelope);
  const stored = await downloadSyncFile(token, fileId);
  if (!stored || !snapshotsMatch(stored, envelope)) {
    throw new DriveError(
      0,
      'Google Drive did not store this backup. Sync was not saved.'
    );
  }
}
