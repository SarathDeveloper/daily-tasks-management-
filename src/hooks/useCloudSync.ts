/**
 * Orchestrates Google Drive backup: auth state, automatic sync triggers and the
 * merge/restore operations. All heavy lifting lives in `driveSyncService` and
 * `syncMerge`; this hook only owns lifecycle and UI-facing state.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
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
import {
  clearLegacyDriveProfileId,
  preferRealTaskLists,
  readLegacyDriveProfileId,
} from '../lib/singleProfile';
import { mergeEnvelopes } from '../lib/syncMerge';
import {
  DriveAuthError,
  DriveScopeError,
  loadCloudSnapshot,
  saveCloudSnapshot,
  snapshotsMatch,
} from '../services/driveSyncService';
import {
  GoogleAuthError,
  acknowledgeRedirectAccount,
  clearCachedAccessToken,
  completeWebRedirectIfNeeded,
  connectGoogleAccount,
  describeGoogleAuthFailure,
  disconnectGoogleAccount,
  getCachedAccessToken,
  getStoredAccount,
  hasPendingRedirectAccount,
  isGoogleSignInConfigured,
  isNativePlatform,
  preloadGoogleSignIn,
  readBootOAuthNotice,
  type GoogleAccount,
} from '../services/googleAuthService';

export type CloudSyncStatus =
  | 'unconfigured'
  | 'disconnected'
  | 'idle'
  | 'syncing'
  | 'connecting'
  | 'needs-auth'
  | 'error';

export interface UseCloudSyncOptions {
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
/** After the Google sheet closes, wait briefly for the plugin result before giving up. */
const CONNECT_RESUME_GRACE_MS = 2000;

export function useCloudSync(options: UseCloudSyncOptions): CloudSyncApi {
  const { revision, onDataApplied, enabled = true } = options;

  const keys = getStorageKeys(null);
  const configured = isGoogleSignInConfigured();

  const [bootNotice] = useState(() => readBootOAuthNotice());
  const [account, setAccount] = useState<GoogleAccount | null>(() => getStoredAccount());
  const [status, setStatus] = useState<CloudSyncStatus>(() => {
    if (!isGoogleSignInConfigured()) return 'unconfigured';
    if (getStoredAccount()) return getCachedAccessToken() ? 'idle' : 'needs-auth';
    return bootNotice ? 'error' : 'disconnected';
  });
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(
    () => readSyncMeta(keys).lastSyncedAt ?? null
  );
  const [error, setError] = useState<string | null>(bootNotice);

  const busyRef = useRef(false);
  const pendingModeRef = useRef<SyncMode | null>(null);
  const connectingRef = useRef(false);
  const connectGeneration = useRef(0);
  const keysRef = useRef<StorageKeys>(keys);
  const onDataAppliedRef = useRef(onDataApplied);
  keysRef.current = keys;
  onDataAppliedRef.current = onDataApplied;

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
      if (busyRef.current) {
        pendingModeRef.current = mode;
        return;
      }

      const storedAccount = getStoredAccount();
      if (!storedAccount) {
        setStatus('disconnected');
        return;
      }
      setAccount(storedAccount);

      const token = getCachedAccessToken();
      if (!token) {
        setStatus('needs-auth');
        setError('Reconnect and allow Google Drive access so backups can upload and download.');
        return;
      }

      busyRef.current = true;
      if (!opts.silent) setError(null);
      setStatus('syncing');

      const storageKeys = keysRef.current;

      try {
        const cloud = await loadCloudSnapshot(token, readLegacyDriveProfileId());

        if (mode === 'restore') {
          const pieces = [cloud.visible, ...cloud.hidden].filter((piece): piece is SyncEnvelope => piece !== null);
          if (pieces.length === 0) throw new Error('No cloud backup found in Google Drive yet.');
          let restored = pieces[0];
          for (const extra of pieces.slice(1)) {
            const paired = preferRealTaskLists(restored, extra);
            restored = mergeEnvelopes(paired.left, paired.right);
          }
          applyEnvelope(restored, storageKeys);
          if (!cloud.file || !cloud.visible || !snapshotsMatch(cloud.visible, restored)) {
            await saveCloudSnapshot(token, cloud.folderId, cloud.file, restored);
          }
          clearLegacyDriveProfileId();
          setStatus('idle');
          setError(null);
          return;
        }

        const stored = buildLocalEnvelope(storageKeys);
        let local = stored;
        for (const hidden of cloud.hidden) {
          const paired = preferRealTaskLists(local, hidden);
          local = mergeEnvelopes(paired.left, paired.right);
        }
        const pairedWithRemote = preferRealTaskLists(local, cloud.visible);
        local = pairedWithRemote.left;
        const merged = mergeEnvelopes(local, pairedWithRemote.right);

        const visibleAlreadyMatches =
          cloud.file !== null &&
          cloud.visible !== null &&
          snapshotsMatch(cloud.visible, merged) &&
          snapshotsMatch(local, merged);

        if (!visibleAlreadyMatches) {
          await saveCloudSnapshot(token, cloud.folderId, cloud.file, merged);
        }

        // Write back when Drive or a one-time hidden file changed this device.
        if (!snapshotsMatch(stored, merged)) {
          applyEnvelope(merged, storageKeys);
        } else {
          const meta = readSyncMeta(storageKeys);
          const syncedAt = new Date().toISOString();
          writeSyncMeta(storageKeys, { ...meta, lastSyncedAt: syncedAt });
          setLastSyncedAt(syncedAt);
        }

        clearLegacyDriveProfileId();
        setStatus('idle');
        setError(null);
      } catch (e) {
        if (e instanceof DriveAuthError || e instanceof DriveScopeError) {
          pendingModeRef.current = null;
          clearCachedAccessToken();
          setStatus('needs-auth');
          setError(
            e instanceof DriveScopeError
              ? e.message
              : 'Google Drive access expired. Tap Reconnect to resume syncing.'
          );
        } else {
          const message = e instanceof Error ? e.message : String(e);
          setStatus(getStoredAccount() ? 'error' : 'disconnected');
          setError(message);
        }
      } finally {
        busyRef.current = false;
        const pending = pendingModeRef.current;
        pendingModeRef.current = null;
        if (pending) void runSync(pending, { silent: true });
      }
    },
    [applyEnvelope, buildLocalEnvelope, enabled]
  );

  useEffect(() => {
    if (configured) preloadGoogleSignIn();
  }, [configured]);

  // Finish a redirect that was still in the URL, then sync. The account is
  // applied even if this effect cleans up, because Strict Mode does that
  // immediately and would otherwise drop a sign-in that already succeeded.
  useEffect(() => {
    if (!configured) return;
    let cancelled = false;
    void (async () => {
      try {
        const accountFromRedirect = await completeWebRedirectIfNeeded();
        const justConnected = Boolean(accountFromRedirect) || hasPendingRedirectAccount();
        if (!justConnected) return;
        const stored = accountFromRedirect ?? getStoredAccount();
        if (!stored) return;
        setAccount(stored);
        if (!getCachedAccessToken()) {
          if (!cancelled) setStatus('needs-auth');
          return;
        }
        setStatus('idle');
        setError(null);
        if (cancelled) return;
        acknowledgeRedirectAccount();
        await runSync('merge', { silent: true });
      } catch (e) {
        const stored = getStoredAccount();
        const linked = Boolean(stored && getCachedAccessToken());
        if (linked && stored) {
          setAccount(stored);
          setStatus('idle');
          if (!cancelled) acknowledgeRedirectAccount();
        }
        if (cancelled) return;
        if (e instanceof GoogleAuthError && e.code === 'CANCELED') {
          if (!linked) {
            setStatus('disconnected');
            setError(null);
          }
          return;
        }
        setError(describeGoogleAuthFailure(e));
        if (!linked) setStatus('error');
      }
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
    // Intentionally only on mount. Later edits go through the revision debounce.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [configured]);

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
      if (isActive && !connectingRef.current) void runSync('merge', { silent: true });
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

  // The Drive consent screen pauses the app. If it never returns a result, the
  // sign-in promise stays pending and the button would spin forever.
  useEffect(() => {
    if (!configured || !isNativePlatform()) return;
    let remove: (() => void) | null = null;
    let graceTimer: ReturnType<typeof setTimeout> | null = null;
    void CapApp.addListener('appStateChange', ({ isActive }) => {
      if (!isActive) {
        if (graceTimer) {
          clearTimeout(graceTimer);
          graceTimer = null;
        }
        return;
      }
      if (!connectingRef.current) return;
      const generation = connectGeneration.current;
      graceTimer = setTimeout(() => {
        graceTimer = null;
        if (!connectingRef.current || generation !== connectGeneration.current) return;
        connectingRef.current = false;
        // This attempt produced no token. An older cached token must not
        // turn a lost consent result into Linked.
        setStatus(getStoredAccount() ? 'needs-auth' : 'disconnected');
        setError('Google sign-in did not finish. Try again.');
      }, CONNECT_RESUME_GRACE_MS);
    }).then((handle) => {
      remove = () => {
        try {
          handle.remove();
        } catch {
          // already detached
        }
      };
    });
    return () => {
      if (graceTimer) clearTimeout(graceTimer);
      remove?.();
    };
  }, [configured]);

  const connect = useCallback(async () => {
    const generation = ++connectGeneration.current;
    setError(null);
    setStatus('connecting');
    connectingRef.current = true;
    try {
      const nextAccount = await connectGoogleAccount();
      if (generation !== connectGeneration.current) return;
      connectingRef.current = false;
      setAccount(nextAccount);
      if (!getCachedAccessToken()) {
        setStatus('needs-auth');
        setError('Google did not return a Drive token. Tap Reconnect to try again.');
        return;
      }
      setStatus('idle');
      setError(null);
      await runSync('merge');
    } catch (e) {
      if (generation !== connectGeneration.current) return;
      connectingRef.current = false;
      if (e instanceof GoogleAuthError && e.code === 'CANCELED') {
        const stored = getStoredAccount();
        setStatus(stored && getCachedAccessToken() ? 'idle' : stored ? 'needs-auth' : 'disconnected');
        setError(null);
        return;
      }
      const message = describeGoogleAuthFailure(e);
      if (getStoredAccount() && getCachedAccessToken()) {
        setAccount(getStoredAccount());
        setStatus('idle');
        setError(message);
        return;
      }
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

