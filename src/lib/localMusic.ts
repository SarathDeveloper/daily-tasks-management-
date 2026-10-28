import { isNativeAndroid } from './platform';
import { MAX_MUSIC_BYTES } from './sounds';
import { audioService } from '../services/audioService';
import { DayflowAlarm } from '../services/dayflowAlarm';

const DB_NAME = 'dayflow-media';
const STORE = 'files';
const MUSIC_KEY = 'reminder-music';

interface StoredMusic {
  name: string;
  blob: Blob;
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

async function idbGet(): Promise<StoredMusic | null> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const request = tx.objectStore(STORE).get(MUSIC_KEY);
    request.onsuccess = () => resolve((request.result as StoredMusic | undefined) ?? null);
    request.onerror = () => reject(request.error);
  });
}

async function idbPut(value: StoredMusic): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(value, MUSIC_KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function idbDelete(): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).delete(MUSIC_KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function hasLocalMusic(): Promise<boolean> {
  try {
    if (isNativeAndroid()) {
      const status = await DayflowAlarm.hasMusic();
      return Boolean(status.has);
    }
    const saved = await idbGet();
    return Boolean(saved?.blob && saved.blob.size > 0);
  } catch (e) {
    console.warn('Could not check the saved song:', e);
    return false;
  }
}

export async function saveLocalMusicFile(file: File): Promise<string> {
  if (file.size <= 0) throw new Error('empty');
  if (file.size > MAX_MUSIC_BYTES) throw new Error('too-large');
  const name = file.name || 'Song';
  await idbPut({ name, blob: file });
  return name;
}

export async function clearLocalMusicFile(): Promise<void> {
  if (isNativeAndroid()) {
    await DayflowAlarm.clearMusic();
    return;
  }
  await idbDelete();
}

/** Plays the saved song once. Returns false when this device has no file. */
export async function previewLocalMusic(): Promise<boolean> {
  try {
    if (isNativeAndroid()) {
      const status = await DayflowAlarm.hasMusic();
      if (!status.has) return false;
      await DayflowAlarm.preview({ sound: 'music' });
      return true;
    }
    const saved = await idbGet();
    if (!saved?.blob) return false;
    audioService.playFile(saved.blob, false);
    return true;
  } catch (e) {
    console.warn('Could not preview the saved song:', e);
    return false;
  }
}

/** Starts a looping playback of the saved song. Returns false when it is missing. */
export async function loopLocalMusic(): Promise<boolean> {
  try {
    if (isNativeAndroid()) return false;
    const saved = await idbGet();
    if (!saved?.blob) return false;
    audioService.playFile(saved.blob, true);
    return true;
  } catch (e) {
    console.warn('Could not play the saved song:', e);
    return false;
  }
}
