/**
 * Android-native reminder scheduling on top of @capacitor/local-notifications.
 *
 * Why this exists: the browser `setInterval` scheduler in
 * `notificationService.ts` only runs while the page is alive, so reminders were
 * silently dropped whenever Android backgrounded the WebView. Here every
 * reminder becomes a real `AlarmManager` entry, which survives the app being
 * swiped away and the device rebooting.
 */
import { LocalNotifications } from '@capacitor/local-notifications';
import type { Goal, Habit, HabitCheckIn, NotificationSettings, SoundType, Task } from '../types';
import { buildReminderPlans } from '../lib/reminders';
import { isNativeAndroid } from '../lib/platform';

export type NativePermission = 'granted' | 'denied' | 'prompt' | 'unsupported';

export interface NotificationSetupResult {
  granted: boolean;
  /** Android 14+ exact-alarm capability. */
  exactAlarm: 'granted' | 'denied' | 'prompt' | 'unsupported';
}

export interface ReminderSyncResult {
  scheduled: number;
  cancelled: number;
  /** True when the platform is not a native Android build (nothing to do). */
  skipped: boolean;
}

const CHANNEL_PREFIX = 'reminders_';
const SILENT_CHANNEL = 'reminders_silent';
const GROUP_KEY = 'daily-task-reminders';
const SMALL_ICON = 'ic_stat_icon';
const ICON_COLOR = '#4f46e5';

/**
 * Maps a task's chime choice to the matching native channel.
 * `voice` falls back to the chime channel: Android notification channels cannot
 * run text-to-speech, and the in-app banner still announces the task.
 */
function channelIdForSound(sound: SoundType, settings: NotificationSettings): string {
  if (!settings.soundEnabled) return SILENT_CHANNEL;
  const resolved: SoundType = sound === 'voice' ? 'chime' : sound;
  return `${CHANNEL_PREFIX}${resolved}`;
}

async function createChannels(): Promise<void> {
  const defs: { id: string; name: string; sound?: string; vibration: boolean; description: string }[] = [
    { id: 'reminders_chime', name: 'Reminders - Chime', sound: 'chime.wav', vibration: true, description: 'Gentle two-note chime' },
    { id: 'reminders_bell', name: 'Reminders - Bell', sound: 'bell.wav', vibration: true, description: 'Harmonic three-note bell' },
    { id: 'reminders_digital', name: 'Reminders - Digital', sound: 'digital.wav', vibration: true, description: 'Short digital triple beep' },
    { id: 'reminders_gentle', name: 'Reminders - Gentle', sound: 'gentle.wav', vibration: true, description: 'Soft ascending chord' },
    { id: SILENT_CHANNEL, name: 'Reminders - Silent', sound: 'silent.wav', vibration: false, description: 'No sound or vibration' },
  ];

  for (const def of defs) {
    try {
      await LocalNotifications.createChannel({
        id: def.id,
        name: def.name,
        description: def.description,
        importance: def.id === SILENT_CHANNEL ? 3 : 5,
        visibility: 1,
        sound: def.sound,
        vibration: def.vibration,
        lights: true,
        lightColor: ICON_COLOR,
      });
    } catch (e) {
      console.warn(`Could not create notification channel ${def.id}:`, e);
    }
  }
}

export async function getNativePermissionStatus(): Promise<NativePermission> {
  if (!isNativeAndroid()) return 'unsupported';
  try {
    const status = await LocalNotifications.checkPermissions();
    if (status.display === 'granted') return 'granted';
    if (status.display === 'denied') return 'denied';
    return 'prompt';
  } catch (e) {
    console.warn('Failed to read notification permission:', e);
    return 'prompt';
  }
}

async function checkExactAlarmSetting(): Promise<NotificationSetupResult['exactAlarm']> {
  if (!isNativeAndroid()) return 'unsupported';
  try {
    if (typeof LocalNotifications.checkExactNotificationSetting !== 'function') return 'unsupported';
    const status = await LocalNotifications.checkExactNotificationSetting();
    if (status.exact_alarm === 'granted') return 'granted';
    if (status.exact_alarm === 'denied') return 'denied';
    return 'prompt';
  } catch (e) {
    // Older Android versions do not have the setting at all.
    console.warn('Exact alarm setting unavailable:', e);
    return 'unsupported';
  }
}

/**
 * Creates the notification channels and requests the runtime permission.
 * Call this once on boot and whenever the user opens the settings screen.
 */
export async function ensureNotificationSetup(): Promise<NotificationSetupResult> {
  if (!isNativeAndroid()) {
    return { granted: false, exactAlarm: 'unsupported' };
  }

  await createChannels();

  let granted = false;
  try {
    const current = await LocalNotifications.checkPermissions();
    if (current.display === 'granted') {
      granted = true;
    } else if (current.display !== 'denied') {
      const requested = await LocalNotifications.requestPermissions();
      granted = requested.display === 'granted';
    }
  } catch (e) {
    console.warn('Notification permission request failed:', e);
  }

  return { granted, exactAlarm: await checkExactAlarmSetting() };
}

/** Opens the system "Alarms & reminders" screen where exact alarms are granted. */
export async function requestExactAlarmPermission(): Promise<void> {
  if (!isNativeAndroid()) return;
  try {
    if (typeof LocalNotifications.changeExactNotificationSetting === 'function') {
      await LocalNotifications.changeExactNotificationSetting();
    }
  } catch (e) {
    console.warn('Could not open exact alarm settings:', e);
  }
}

function pendingToMs(value: unknown): number {
  if (!value) return 0;
  if (value instanceof Date) return value.getTime();
  const parsed = new Date(value as string).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}

/**
 * Reconcile the phone's pending alarms with the desired reminder list.
 *
 * The entire schedule is derived from the task list, so a completed, edited or
 * deleted task simply stops producing a plan and its stale alarm is cancelled.
 */
export async function syncScheduledNotifications(
  tasks: Task[],
  settings: NotificationSettings,
  options: { granted: boolean },
  habits: Habit[] = [],
  checkIns: HabitCheckIn[] = [],
  goals: Goal[] = []
): Promise<ReminderSyncResult> {
  if (!isNativeAndroid()) return { scheduled: 0, cancelled: 0, skipped: true };
  if (!options.granted) return { scheduled: 0, cancelled: 0, skipped: true };

  try {
    const plans = buildReminderPlans(tasks, settings, new Date(), habits, checkIns, goals);
    const desired = new Map(plans.map((plan) => [plan.notificationId, plan]));
    const now = Date.now();

    const pending = await LocalNotifications.getPending();
    const pendingById = new Map(
      pending.notifications.map((notification) => [notification.id, notification])
    );

    const toCancel: { id: number }[] = [];
    for (const notification of pending.notifications) {
      const plan = desired.get(notification.id);
      const pendingAt = pendingToMs(notification.schedule?.at);
      if (!plan) {
        // `getPending()` also returns records for notifications that already
        // fired (the plugin keeps them for history). Those need no work, and
        // cancelling them again on every sync would be wasted IPC.
        if (pendingAt && pendingAt < now) continue;
        toCancel.push({ id: notification.id });
        continue;
      }
      if (pendingAt && Math.abs(pendingAt - plan.fireAt.getTime()) > 1000) {
        toCancel.push({ id: notification.id });
      }
    }

    if (toCancel.length > 0) {
      await LocalNotifications.cancel({ notifications: toCancel });
    }

    const exactStatus = await checkExactAlarmSetting();
    // Only ask for an exact alarm when Android already allows it. Passing
    // `isExactNotification: true` while the capability is missing makes the
    // plugin open the "Alarms & reminders" system screen on every resync, which
    // would yank the user out of the app; inexact is good enough as a fallback.
    const exactAllowed = exactStatus === 'granted';

    const toSchedule = plans.filter((plan) => {
      const alreadyPending = pendingById.get(plan.notificationId);
      if (!alreadyPending) return true;
      if (toCancel.some((entry) => entry.id === plan.notificationId)) return true;
      const pendingAt = pendingToMs(alreadyPending.schedule?.at);
      return pendingAt === 0 || Math.abs(pendingAt - plan.fireAt.getTime()) > 1000;
    });

    if (toSchedule.length > 0) {
      await LocalNotifications.schedule({
        notifications: toSchedule.map((plan) => ({
          id: plan.notificationId,
          title: plan.title,
          body: plan.body,
          schedule: {
            at: plan.fireAt,
            allowWhileIdle: true,
          },
          // `isExactNotification` is a notification-level option, not part of
          // `schedule`. Keep it mandatory=false so a revoked permission falls
          // back to an inexact alarm instead of rejecting the whole batch.
          isExactNotification: exactAllowed,
          isExactMandatory: false,
          channelId: channelIdForSound(plan.sound, settings),
          smallIcon: SMALL_ICON,
          iconColor: ICON_COLOR,
          autoCancel: true,
          foreground: true,
          group: GROUP_KEY,
          extra: { taskId: plan.habitId ? `habit:${plan.habitId}` : plan.taskId, habitId: plan.habitId },
        })),
      });
    }

    return { scheduled: toSchedule.length, cancelled: toCancel.length, skipped: false };
  } catch (e) {
    console.warn('Failed to sync scheduled reminders:', e);
    return { scheduled: 0, cancelled: 0, skipped: false };
  }
}

/** Wipes every alarm this app scheduled (used when reminders are turned off). */
export async function cancelAllTaskReminders(): Promise<void> {
  if (!isNativeAndroid()) return;
  try {
    const pending = await LocalNotifications.getPending();
    if (pending.notifications.length === 0) return;
    await LocalNotifications.cancel({
      notifications: pending.notifications.map((notification) => ({ id: notification.id })),
    });
  } catch (e) {
    console.warn('Failed to cancel reminders:', e);
  }
}

export interface ReminderListenerHandlers {
  /** Fired when a reminder is delivered while the app is in the foreground. */
  onDue: (taskId: string) => void;
  /** Fired when the user taps a reminder in the notification tray. */
  onOpened: (taskId: string) => void;
}

/** Registers native listeners. Returns a cleanup function. */
export async function registerReminderListeners(
  handlers: ReminderListenerHandlers
): Promise<() => void> {
  if (!isNativeAndroid()) return () => {};

  const readTaskId = (extra: unknown): string | null => {
    if (!extra || typeof extra !== 'object') return null;
    const taskId = (extra as { taskId?: unknown }).taskId;
    return typeof taskId === 'string' ? taskId : null;
  };

  const handles = await Promise.all([
    LocalNotifications.addListener('localNotificationReceived', (notification) => {
      const taskId = readTaskId(notification.extra);
      if (taskId) handlers.onDue(taskId);
    }),
    LocalNotifications.addListener('localNotificationActionPerformed', (action) => {
      const taskId = readTaskId(action.notification?.extra);
      if (taskId) handlers.onOpened(taskId);
    }),
  ]);

  return () => {
    for (const handle of handles) {
      try {
        handle.remove();
      } catch {
        // already detached
      }
    }
  };
}
