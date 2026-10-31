import { AUTOMATIC_BACKUP_FILENAME, automaticBackupSignature, type BackupFile } from './backup';
import { isNativeAndroid } from './platform';
import { DayflowAlarm } from '../services/dayflowAlarm';

const DB_NAME = 'dayflow-backup';
const STORE = 'handles';
const HANDLE_KEY = 'folder';
const META_KEY = 'daily_tasks_auto_backup_v1';

export interface AutoBackupStatus {
  supported: boolean;
  name: string | null;
  lastSavedAt: string | null;
  /** A saved folder can no longer be written, so Settings should ask again. */
  lost: boolean;
}

export type AutoBackupWriteResult = 'saved' | 'skipped' | 'none' | 'lost';

interface WritableStream {
  write(data: string): Promise<void>;
  close(): Promise<void>;
}

interface BackupDirectoryHandle {
  name: string;
  queryPermission(descriptor: { mode: 'readwrite' }): Promise<'granted' | 'denied' | 'prompt'>;
  requestPermission(descriptor: { mode: 'readwrite' }): Promise<'granted' | 'denied' | 'prompt'>;
  getFileHandle(
    name: string,
    options: { create: boolean }
  ): Promise<{ createWritable(): Promise<WritableStream> }>;
}

let lastSignature: string | null = null;
let epoch = 0;
let choosingFolder = false;
let writeQueue: Promise<void> = Promise.resolve();

/** True while the folder picker is open. That pause is not the user leaving the app. */
export function isChoosingBackupFolder(): boolean {
  return choosingFolder;
}

function readLastSavedAt(): string | null {
  try {
    const raw = localStorage.getItem(META_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { lastSavedAt?: unknown };
    return typeof parsed.lastSavedAt === 'string' ? parsed.lastSavedAt : null;
  } catch {
    return null;
  }
}

function writeLastSavedAt(value: string | null): void {
  try {
    if (!value) localStorage.removeItem(META_KEY);
    else localStorage.setItem(META_KEY, JSON.stringify({ lastSavedAt: value }));
  } catch {
    // The backup file still matters more than the label.
  }
}

export function canPickBackupFolder(): boolean {
  return typeof window !== 'undefined' && 'showDirectoryPicker' in window;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function idbGet(): Promise<BackupDirectoryHandle | null> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const request = tx.objectStore(STORE).get(HANDLE_KEY);
    request.onsuccess = () => resolve((request.result as BackupDirectoryHandle | undefined) ?? null);
    request.onerror = () => reject(request.error);
  });
}

async function idbPut(handle: BackupDirectoryHandle): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(handle, HANDLE_KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function idbDelete(): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).delete(HANDLE_KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

function showDirectoryPicker(): Promise<BackupDirectoryHandle> {
  const picker = (
    window as unknown as {
      showDirectoryPicker?: (options: { mode: 'readwrite' }) => Promise<BackupDirectoryHandle>;
    }
  ).showDirectoryPicker;
  if (!picker) throw new Error('unsupported');
  return picker({ mode: 'readwrite' });
}

export function isBackupCancel(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const name = (error as { name?: string }).name;
  const message = error instanceof Error ? error.message : String(error);
  return name === 'AbortError' || message.includes('cancelled') || message.includes('canceled');
}

function isPermissionLost(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return message.includes('permission-lost') || message.includes('no-folder');
}

export function resetAutomaticBackupMemory(): void {
  lastSignature = null;
  epoch += 1;
}

function enqueue<T>(work: () => Promise<T>): Promise<T> {
  const run = writeQueue.then(work, work);
  writeQueue = run.then(
    () => undefined,
    () => undefined
  );
  return run;
}

export async function readAutoBackupStatus(): Promise<AutoBackupStatus> {
  const lastSavedAt = readLastSavedAt();
  if (isNativeAndroid()) {
    try {
      const status = await DayflowAlarm.getBackupFolder();
      if (!status.has) {
        if (status.lost) writeLastSavedAt(null);
        return { supported: true, name: null, lastSavedAt: null, lost: Boolean(status.lost) };
      }
      return {
        supported: true,
        name: status.name || 'Chosen folder',
        lastSavedAt,
        lost: false,
      };
    } catch {
      return { supported: true, name: null, lastSavedAt, lost: false };
    }
  }

  if (!canPickBackupFolder()) {
    return { supported: false, name: null, lastSavedAt: null, lost: false };
  }

  try {
    const handle = await idbGet();
    if (!handle) return { supported: true, name: null, lastSavedAt: null, lost: false };
    const permission = await handle.queryPermission({ mode: 'readwrite' });
    if (permission === 'denied') {
      await idbDelete();
      writeLastSavedAt(null);
      return { supported: true, name: null, lastSavedAt: null, lost: true };
    }
    return { supported: true, name: handle.name || 'Chosen folder', lastSavedAt, lost: false };
  } catch {
    return { supported: true, name: null, lastSavedAt, lost: false };
  }
}

export async function chooseBackupFolder(): Promise<{ name: string }> {
  resetAutomaticBackupMemory();
  choosingFolder = true;
  try {
    if (isNativeAndroid()) {
      const picked = await DayflowAlarm.pickBackupFolder();
      return { name: picked.name || 'Chosen folder' };
    }
    const handle = await showDirectoryPicker();
    if (typeof handle.requestPermission === 'function') {
      const permission = await handle.requestPermission({ mode: 'readwrite' });
      if (permission !== 'granted') throw new Error('permission-lost');
    }
    await idbPut(handle);
    return { name: handle.name || 'Chosen folder' };
  } finally {
    choosingFolder = false;
  }
}

export async function clearBackupFolder(): Promise<void> {
  resetAutomaticBackupMemory();
  writeLastSavedAt(null);
  if (isNativeAndroid()) {
    await DayflowAlarm.clearBackupFolder();
    return;
  }
  try {
    await idbDelete();
  } catch {
    // Nothing left to clear.
  }
}

async function writeWebFile(contents: string): Promise<void> {
  const handle = await idbGet();
  if (!handle) throw new Error('no-folder');
  const permission = await handle.queryPermission({ mode: 'readwrite' });
  if (permission === 'denied') {
    await idbDelete();
    writeLastSavedAt(null);
    throw new Error('permission-lost');
  }
  // A background write cannot ask for permission. Keep the folder and try again later.
  if (permission !== 'granted') throw new Error('not-granted');
  const file = await handle.getFileHandle(AUTOMATIC_BACKUP_FILENAME, { create: true });
  const writable = await file.createWritable();
  await writable.write(contents);
  await writable.close();
}

export function writeAutomaticBackup(file: BackupFile): Promise<AutoBackupWriteResult> {
  const signature = automaticBackupSignature(file);
  const started = epoch;
  return enqueue(async () => {
    if (started !== epoch || signature === lastSignature) return 'skipped';
    const contents = JSON.stringify(file, null, 2);
    try {
      if (isNativeAndroid()) {
        const status = await DayflowAlarm.getBackupFolder();
        if (started !== epoch) return 'skipped';
        if (!status.has) {
          if (status.lost) writeLastSavedAt(null);
          return status.lost ? 'lost' : 'none';
        }
        await DayflowAlarm.writeBackupFile({ contents });
      } else {
        if (!canPickBackupFolder()) return 'none';
        const handle = await idbGet();
        if (!handle) return 'none';
        if (started !== epoch) return 'skipped';
        await writeWebFile(contents);
      }
    } catch (error) {
      if (isPermissionLost(error)) {
        writeLastSavedAt(null);
        return 'lost';
      }
      console.warn('Automatic backup failed:', error);
      return 'none';
    }
    if (started !== epoch) return 'skipped';
    lastSignature = signature;
    writeLastSavedAt(new Date().toISOString());
    return 'saved';
  });
}
