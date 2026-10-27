/**
 * Minimal Google Drive client for the hidden `appDataFolder`.
 *
 * Deliberately uses plain `fetch` against the Drive REST API instead of the
 * Google JS SDK: the SDK is ~100 KB of extra code for three endpoints, and this
 * app is meant to stay small.
 */
import { isValidEnvelope } from '../lib/syncMerge';
import type { SyncEnvelope } from '../lib/persistence';

const DRIVE_API = 'https://www.googleapis.com/drive/v3';
const DRIVE_UPLOAD = 'https://www.googleapis.com/upload/drive/v3';
const SYNC_FILE_BASE = 'daily-tasks-sync';

export class DriveAuthError extends Error {
  constructor(message = 'Google Drive access expired.') {
    super(message);
    this.name = 'DriveAuthError';
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

/**
 * One Drive file per local profile so two people using the same Google account
 * on one device never overwrite each other.
 */
export function syncFileNameFor(profileId: string | null): string {
  return profileId ? `${SYNC_FILE_BASE}-${profileId}.json` : `${SYNC_FILE_BASE}.json`;
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

/** Looks up the sync file; returns null when this is the first sync. */
export async function findSyncFile(token: string, name: string): Promise<DriveFileRef | null> {
  const params = new URLSearchParams({
    spaces: 'appDataFolder',
    fields: 'files(id,name,modifiedTime)',
    q: `name = '${name.replace(/'/g, "\\'")}' and trashed = false`,
  });
  const response = await driveFetch(token, `${DRIVE_API}/files?${params.toString()}`);
  if (!response.ok) {
    throw new DriveError(response.status, `Drive lookup failed (${response.status}).`);
  }
  const body = (await response.json()) as { files?: DriveFileRef[] };
  return body.files?.[0] ?? null;
}

/** Downloads and validates the remote snapshot. */
export async function downloadSyncFile(token: string, fileId: string): Promise<SyncEnvelope | null> {
  const response = await driveFetch(token, `${DRIVE_API}/files/${fileId}?alt=media`);
  if (!response.ok) {
    throw new DriveError(response.status, `Drive download failed (${response.status}).`);
  }
  const parsed = (await response.json()) as unknown;
  if (!isValidEnvelope(parsed)) {
    console.warn('Remote sync file is not a recognised snapshot; ignoring it.');
    return null;
  }
  return parsed;
}

async function writeMedia(token: string, fileId: string, envelope: SyncEnvelope): Promise<void> {
  const response = await driveFetch(
    token,
    `${DRIVE_UPLOAD}/files/${fileId}?uploadType=media`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(envelope),
    }
  );
  if (!response.ok) {
    throw new DriveError(response.status, `Drive upload failed (${response.status}).`);
  }
}

/** Creates the snapshot in the app data folder (two requests, no multipart). */
export async function createSyncFile(
  token: string,
  name: string,
  envelope: SyncEnvelope
): Promise<DriveFileRef> {
  const metaResponse = await driveFetch(token, `${DRIVE_API}/files`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name,
      mimeType: 'application/json',
      parents: ['appDataFolder'],
    }),
  });
  if (!metaResponse.ok) {
    throw new DriveError(metaResponse.status, `Drive create failed (${metaResponse.status}).`);
  }
  const created = (await metaResponse.json()) as { id: string };
  await writeMedia(token, created.id, envelope);
  return { id: created.id, name };
}

export async function updateSyncFile(
  token: string,
  fileId: string,
  envelope: SyncEnvelope
): Promise<void> {
  await writeMedia(token, fileId, envelope);
}
