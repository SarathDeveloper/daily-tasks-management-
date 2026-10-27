/**
 * Orchestrates Google Drive backup: auth state, automatic sync triggers and the
 * merge/restore operations. All heavy lifting lives in `driveSyncService` and
 * `syncMerge`; this hook only owns lifecycle and UI-facing state.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { App as CapApp } from '@capacitor/app';
import {
  DATA_SCHEMA_VERSION,
  getDeviceId,
  getStorageKeys,
  readSnapshot,
  readSyncMeta,
  writeSnapshot,
  writeSyncMeta,
  type StorageKeys,
  type SyncEnvelope,
} from '../lib/persistence';
import { mergeEnvelopes } from '../lib/syncMerge';
import {
  DriveAuthError,
  createSyncFile,
  downloadSyncFile,
  findSyncFile,
  syncFileNameFor,
  updateSyncFile,
} from '../services/driveSyncService';
import {
  completeWebRedirectIfNeeded,
  connectGoogleAccount,
  disconnectGoogleAccount,
  getCachedAccessToken,
  getStoredAccount,
  isGoogleSignInConfigured,
  isNativePlatform,
  type GoogleAccount,
} from '../services/googleAuthService';

export type CloudSyncStatus =
  | 'unconfigured'
  | 'disconnected'
  | 'idle'
  | 'syncing'
  | 'needs-auth'
  | 'error';

export interface UseCloudSyncOptions {
  /** Active local profile; null means the un-namespaced default profile. */
  profileId: string | null;
  /** Bumped by the app whenever local data changes, so sync can debounce. */
  revision: number;
  /** Called after a cloud snapshot has been written to localStorage. */
  onDataApplied: () => void;
  /** Disable sync entirely (used while a modal owns the screen, etc.). */
  enabled?: boolean;
}

export interface CloudSyncApi {
  status: CloudSyncStatus;
  account: GoogleAccount | null;
  lastSyncedAt: string | null;
  error: string | null;
  configured: boolean;
  hasSession: boolean;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  syncNow: () => Promise<void>;
  restoreFromCloud: () => Promise<void>;
}

type SyncMode = 'merge' | 'restore';

const AUTO_SYNC_DEBOUNCE_MS = 4000;

export function useCloudSync(options: UseCloudSyncOptions): CloudSyncApi {
  const { profileId, revision, onDataApplied, enabled = true } = options;

  const keys = useMemo(() => getStorageKeys(profileId), [profileId]);
  const configured = isGoogleSignInConfigured();

  const [account, setAccount] = useState<GoogleAccount | null>(() => getStoredAccount());
  const [status, setStatus] = useState<CloudSyncStatus>(() => {
    if (!isGoogleSignInConfigured()) return 'unconfigured';
    return getStoredAccount() ? (getCachedAccessToken() ? 'idle' : 'needs-auth') : 'disconnected';
  });
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(
    () => readSyncMeta(getStorageKeys(profileId)).lastSyncedAt ?? null
  );
  const [error, setError] = useState<string | null>(null);

  const busyRef = useRef(false);
  const keysRef = useRef<StorageKeys>(keys);
  const profileRef = useRef<string | null>(profileId);
  const onDataAppliedRef = useRef(onDataApplied);
  keysRef.current = keys;
  profileRef.current = profileId;
  onDataAppliedRef.current = onDataApplied;

  // Re-read the "last synced" stamp when switching profiles.
  useEffect(() => {
    setLastSyncedAt(readSyncMeta(keys).lastSyncedAt ?? null);
  }, [keys]);

  const buildLocalEnvelope = useCallback((storageKeys: StorageKeys): SyncEnvelope => {
    const meta = readSyncMeta(storageKeys);
    const now = new Date().toISOString();
    return {
      schemaVersion: DATA_SCHEMA_VERSION,
      deviceId: getDeviceId(),
      updatedAt: now,
      settingsUpdatedAt: meta.settingsUpdatedAt ?? now,
      tombstones: meta.tombstones,
      data: readSnapshot(storageKeys),
    };
  }, []);

  const applyEnvelope = useCallback((envelope: SyncEnvelope, storageKeys: StorageKeys) => {
    writeSnapshot(storageKeys, envelope.data);
    const meta = readSyncMeta(storageKeys);
    const syncedAt = new Date().toISOString();
    writeSyncMeta(storageKeys, {
      ...meta,
      tombstones: envelope.tombstones,
      settingsUpdatedAt: envelope.settingsUpdatedAt,
      // Record what we just applied so the settings effect does not mistake
      // the incoming value for a fresh local edit.
      settingsSnapshot: JSON.stringify(envelope.data.settings),
      lastSyncedAt: syncedAt,
    });
    setLastSyncedAt(syncedAt);
    onDataAppliedRef.current();
  }, []);

  const runSync = useCallback(
    async (mode: SyncMode, opts: { silent?: boolean } = {}) => {
      if (!enabled || !isGoogleSignInConfigured()) return;
      if (busyRef.current) return;

      const storedAccount = getStoredAccount();
      if (!storedAccount) {
        setStatus('disconnected');
        return;
      }
      setAccount(storedAccount);

      const token = getCachedAccessToken();
      if (!token) {
        setStatus('needs-auth');
        setError('Google Drive session expired. Tap Reconnect to keep syncing.');
        return;
      }

      busyRef.current = true;
      if (!opts.silent) setError(null);
      setStatus('syncing');

      const storageKeys = keysRef.current;
      const fileName = syncFileNameFor(profileRef.current);

      try {
        const existing = await findSyncFile(token, fileName);

        if (mode === 'restore') {
          if (!existing) {
            throw new Error('No cloud backup found for this profile yet.');
          }
          const remote = await downloadSyncFile(token, existing.id);
          if (!remote) throw new Error('The cloud backup could not be read.');
          applyEnvelope(remote, storageKeys);
          setStatus('idle');
          setError(null);
          return;
        }

        const remote = existing ? await downloadSyncFile(token, existing.id) : null;
        const local = buildLocalEnvelope(storageKeys);
        const merged = mergeEnvelopes(local, remote);

        const remoteMatchesMerged =
          remote !== null && envelopesMatch(remote, merged) && envelopesMatch(local, merged);

        if (!remoteMatchesMerged) {
          if (existing) {
            await updateSyncFile(token, existing.id, merged);
          } else {
            await createSyncFile(token, fileName, merged);
          }
        }

        // Only touch localStorage when the cloud actually contributed data.
        if (remote && !envelopesMatch(local, merged)) {
          applyEnvelope(merged, storageKeys);
        } else {
          const meta = readSyncMeta(storageKeys);
          const syncedAt = new Date().toISOString();
          writeSyncMeta(storageKeys, { ...meta, lastSyncedAt: syncedAt });
          setLastSyncedAt(syncedAt);
        }

        setStatus('idle');
        setError(null);
      } catch (e) {
        if (e instanceof DriveAuthError) {
          setStatus('needs-auth');
          setError('Google Drive access expired. Tap Reconnect to resume syncing.');
        } else {
          const message = e instanceof Error ? e.message : String(e);
          setStatus('error');
          setError(message);
        }
      } finally {
        busyRef.current = false;
      }
    },
    [applyEnvelope, buildLocalEnvelope, enabled]
  );

  // Finish the web OAuth redirect flow once, then sync.
  useEffect(() => {
    if (!configured) return;
    let cancelled = false;
    void (async () => {
      const accountFromRedirect = await completeWebRedirectIfNeeded();
      if (cancelled || !accountFromRedirect) return;
      setAccount(accountFromRedirect);
      await runSync('merge', { silent: true });
    })();
    return () => {
      cancelled = true;
    };
  }, [configured, runSync]);

  // First sync on launch when a still-valid token is cached.
  useEffect(() => {
    if (!configured || !enabled) return;
    if (!getStoredAccount() || !getCachedAccessToken()) return;
    void runSync('merge', { silent: true });
    // Intentionally only on mount / profile change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [configured, profileId]);

  // Debounced push after local mutations.
  useEffect(() => {
    if (!configured || !enabled) return;
    if (!getStoredAccount() || !getCachedAccessToken()) return;
    const timer = setTimeout(() => {
      void runSync('merge', { silent: true });
    }, AUTO_SYNC_DEBOUNCE_MS);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [revision, configured, enabled]);

  // Catch up when the app comes back to the foreground.
  useEffect(() => {
    if (!configured || !isNativePlatform() || !enabled) return;
    let remove: (() => void) | null = null;
    void CapApp.addListener('appStateChange', ({ isActive }) => {
      if (isActive) void runSync('merge', { silent: true });
    }).then((handle) => {
      remove = () => {
        try {
          handle.remove();
        } catch {
          // already detached
        }
      };
    });
    return () => remove?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [configured, enabled]);

  const connect = useCallback(async () => {
    setError(null);
    setStatus('syncing');
    try {
      const nextAccount = await connectGoogleAccount();
      setAccount(nextAccount);
      await runSync('merge');
      if (getStoredAccount() && !getCachedAccessToken()) setStatus('needs-auth');
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      setStatus(getStoredAccount() ? 'needs-auth' : 'disconnected');
      setError(message);
    }
  }, [runSync]);

  const disconnect = useCallback(async () => {
    await disconnectGoogleAccount();
    setAccount(null);
    setStatus('disconnected');
    setError(null);
  }, []);

  const syncNow = useCallback(async () => {
    await runSync('merge');
  }, [runSync]);

  const restoreFromCloud = useCallback(async () => {
    await runSync('restore');
  }, [runSync]);

  return {
    status,
    account,
    lastSyncedAt,
    error,
    configured,
    hasSession: Boolean(account) && getCachedAccessToken() !== null,
    connect,
    disconnect,
    syncNow,
    restoreFromCloud,
  };
}

/** Structural comparison ignoring volatile envelope metadata. */
function envelopesMatch(a: SyncEnvelope, b: SyncEnvelope): boolean {
  try {
    return (
      JSON.stringify(a.data) === JSON.stringify(b.data) &&
      JSON.stringify(a.tombstones) === JSON.stringify(b.tombstones)
    );
  } catch {
    return false;
  }
}
