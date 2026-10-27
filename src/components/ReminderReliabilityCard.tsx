import React from 'react';
import { AlertTriangle, BellRing, X } from 'lucide-react';
import { Button } from './ui/Button';

export interface ReminderReliabilityState {
  /** Android 13+ notification permission. */
  permissionGranted: boolean;
  /** Android 14+ exact-alarm capability. */
  exactAlarm: 'granted' | 'denied' | 'prompt' | 'unsupported';
}

interface ReminderReliabilityCardProps {
  state: ReminderReliabilityState | null;
  onRequestPermission: () => void;
  onOpenExactAlarmSettings: () => void;
  onDismiss: () => void;
}

/**
 * One-time nudge shown on the Today tab when Android could still delay or drop
 * a reminder: notifications not allowed, exact alarms blocked, or an OEM
 * battery manager that kills alarms.
 */
export const ReminderReliabilityCard: React.FC<ReminderReliabilityCardProps> = ({
  state,
  onRequestPermission,
  onOpenExactAlarmSettings,
  onDismiss,
}) => {
  if (!state) return null;

  const needsPermission = !state.permissionGranted;
  const needsExactAlarm = state.exactAlarm === 'denied' || state.exactAlarm === 'prompt';

  // Nothing to fix: keep the Today view clean and let Settings show the status.
  if (!needsPermission && !needsExactAlarm) return null;

  return (
    <div className="rounded-2xl border border-amber-200 dark:border-amber-900/60 bg-amber-50/80 dark:bg-amber-950/30 px-4 py-3 flex items-start gap-2.5">
      <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="text-xs font-bold text-amber-900 dark:text-amber-200">
          <BellRing className="w-3.5 h-3.5 inline mr-1 -mt-0.5" />
          {needsPermission ? 'Allow notifications for reminders' : 'Allow exact alarms for reminders'}
        </p>
        <p className="text-[11px] text-amber-800/90 dark:text-amber-300/90 leading-snug mt-0.5">
          {needsPermission
            ? 'Android is blocking this app from posting notifications, so reminders cannot appear.'
            : 'Android may delay reminders by several minutes. Confirm "Alarms & reminders" is allowed, and set battery usage to Unrestricted.'}
        </p>
        {needsPermission ? (
          <Button size="sm" variant="secondary" className="mt-2" onClick={onRequestPermission}>
            Allow notifications
          </Button>
        ) : (
          <Button
            size="sm"
            variant="secondary"
            className="mt-2"
            onClick={onOpenExactAlarmSettings}
          >
            Open alarm settings
          </Button>
        )}
      </div>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss reminder notice"
        className="shrink-0 p-1 rounded-lg text-amber-700/70 hover:text-amber-900 dark:text-amber-300/70 dark:hover:text-amber-100"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
};
