import React from 'react';
import {
  Cloud,
  CloudOff,
  Loader2,
  LogOut,
  RefreshCw,
  ShieldCheck,
} from 'lucide-react';
import { Button } from './ui/Button';
import { cn } from '../lib/cn';
import type { CloudSyncApi } from '../hooks/useCloudSync';

interface CloudSyncSectionProps {
  sync: CloudSyncApi;
}

function formatRelative(iso: string | null): string {
  if (!iso) return 'Never synced';
  const time = Date.parse(iso);
  if (!Number.isFinite(time)) return 'Never synced';
  const minutes = Math.round((Date.now() - time) / 60_000);
  if (minutes < 1) return 'Synced just now';
  if (minutes < 60) return `Synced ${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `Synced ${hours} h ago`;
  return `Synced ${Math.round(hours / 24)} d ago`;
}

export const CloudSyncSection: React.FC<CloudSyncSectionProps> = ({ sync }) => {
  const { status, account, lastSyncedAt, error, configured } = sync;
  const isBusy = status === 'syncing';

  const statusLine = (() => {
    if (!configured) return 'Not configured for this build.';
    if (status === 'syncing') return 'Syncing with Google Drive…';
    if (status === 'needs-auth') return 'Session expired. Reconnect to resume backup.';
    if (status === 'error') return error ?? 'Last sync failed.';
    if (!account) return 'Data stays on this device until you connect.';
    return formatRelative(lastSyncedAt);
  })();

  return (
    <div className="space-y-3 bg-slate-50 dark:bg-slate-950/60 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800">
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-bold text-slate-800 dark:text-slate-200 text-xs flex items-center gap-1.5">
          {account ? (
            <Cloud className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
          ) : (
            <CloudOff className="w-4 h-4 text-slate-500 dark:text-slate-400" />
          )}
          <span>Cloud Backup (Google Drive)</span>
        </h3>
        {account && (
          <span
            className={cn(
              'text-[10px] font-bold px-2 py-0.5 rounded-full border',
              status === 'error' || status === 'needs-auth'
                ? 'bg-amber-100 text-amber-700 border-amber-300 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800'
                : 'bg-emerald-100 text-emerald-700 border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800'
            )}
          >
            {status === 'error' ? 'Error' : status === 'needs-auth' ? 'Reconnect' : 'Linked'}
          </span>
        )}
      </div>

      <p className="text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">{statusLine}</p>

      {account && (
        <div className="flex items-center gap-2 text-[11px] text-slate-600 dark:text-slate-300">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
          <span className="truncate">{account.email || account.name}</span>
        </div>
      )}

      {error && status === 'error' && (
        <p className="text-[11px] text-rose-600 dark:text-rose-400 break-words">{error}</p>
      )}

      {!configured && (
        <p className="text-[11px] text-slate-500 dark:text-slate-400">
          Set <code className="font-mono">VITE_GOOGLE_CLIENT_ID</code> and rebuild to enable Google
          sign-in.
        </p>
      )}

      {configured && (
        <div className="flex flex-wrap gap-2 pt-1">
          {!account || status === 'needs-auth' ? (
            <Button size="sm" variant="primary" onClick={() => void sync.connect()} disabled={isBusy}>
              {isBusy ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Cloud className="w-3.5 h-3.5" />
              )}
              <span>{status === 'needs-auth' ? 'Reconnect' : 'Connect Google Drive'}</span>
            </Button>
          ) : (
            <>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => void sync.syncNow()}
                disabled={isBusy}
              >
                {isBusy ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <RefreshCw className="w-3.5 h-3.5" />
                )}
                <span>Sync now</span>
              </Button>

              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  if (
                    window.confirm(
                      'Replace the data on this device with the cloud backup? Local changes since the last sync will be lost.'
                    )
                  ) {
                    void sync.restoreFromCloud();
                  }
                }}
                disabled={isBusy}
              >
                <span>Restore from cloud</span>
              </Button>

              <Button size="sm" variant="danger" onClick={() => void sync.disconnect()} disabled={isBusy}>
                <LogOut className="w-3.5 h-3.5" />
                <span>Disconnect</span>
              </Button>
            </>
          )}
        </div>
      )}

      {account && (
        <p className="text-[10px] text-slate-400 dark:text-slate-500 leading-relaxed">
          Backups go to a hidden folder only this app can open. Disconnecting leaves your data on this
          device.
        </p>
      )}
    </div>
  );
};
