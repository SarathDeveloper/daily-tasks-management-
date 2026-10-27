import { NotificationSettings, Task } from '../types';
import { audioService } from './audioService';
import { isQuietHours } from '../lib/reminders';

/**
 * Browser/PWA notification fallback.
 *
 * The native Android build uses `nativeNotificationService` instead; this class
 * is what runs in a desktop browser and in the installed PWA.
 */
export class NotificationService {
  public static async requestPermission(): Promise<boolean> {
    if (!('Notification' in window)) {
      console.warn('This browser does not support desktop notifications.');
      return false;
    }
    if (Notification.permission === 'granted') {
      return true;
    }
    if (Notification.permission !== 'denied') {
      const permission = await Notification.requestPermission();
      return permission === 'granted';
    }
    return false;
  }

  public static getPermissionStatus(): NotificationPermission | 'unsupported' {
    if (!('Notification' in window)) return 'unsupported';
    return Notification.permission;
  }

  public static isQuietHours(settings: NotificationSettings): boolean {
    return isQuietHours(settings);
  }

  public static async sendTaskNotification(
    task: Task,
    settings: NotificationSettings,
    onAlertTriggered?: (task: Task) => void
  ) {
    const quiet = this.isQuietHours(settings);

    // Play the in-app chime when audible (quiet hours silence it).
    if (settings.soundEnabled && !quiet && task.reminder.sound) {
      audioService.playSound(task.reminder.sound, task.title);
    }

    if (
      settings.browserNotificationsEnabled &&
      !quiet &&
      'Notification' in window &&
      Notification.permission === 'granted'
    ) {
      const title = `Reminder: ${task.title}`;
      const body = task.time ? `${task.time} · ${task.category}` : task.category;
      const icon = `${import.meta.env.BASE_URL}icons/icon-192.png`;

      try {
        // Chrome on Android refuses `new Notification(...)`; the service worker
        // registration is the only supported path there.
        const registration =
          'serviceWorker' in navigator
            ? await navigator.serviceWorker.getRegistration()
            : undefined;

        if (registration) {
          await registration.showNotification(title, {
            body,
            icon,
            tag: `task-${task.id}`,
            data: { taskId: task.id },
          });
        } else {
          const notification = new Notification(title, {
            body,
            icon,
            tag: `task-${task.id}`,
          });
          notification.onclick = () => {
            window.focus();
            onAlertTriggered?.(task);
            notification.close();
          };
        }
      } catch (e) {
        console.warn('Native notification failed:', e);
      }
    }

    // Always surface the in-app banner so the reminder is never missed.
    onAlertTriggered?.(task);
  }
}

/**
 * Calculates the next date for a recurring task based on recurrence type.
 */
export function calculateNextDueDate(
  currentDateStr: string,
  recurrenceType: string,
  intervalDays: number = 1,
  daysOfWeek: number[] = []
): string {
  const date = new Date(currentDateStr + 'T00:00:00');
  if (isNaN(date.getTime())) {
    const fallback = new Date();
    fallback.setDate(fallback.getDate() + 1);
    return fallback.toISOString().split('T')[0];
  }

  switch (recurrenceType) {
    case 'daily':
      date.setDate(date.getDate() + 1);
      break;

    case 'weekdays':
      do {
        date.setDate(date.getDate() + 1);
      } while (date.getDay() === 0 || date.getDay() === 6); // Skip Sun(0), Sat(6)
      break;

    case 'weekly':
      if (daysOfWeek && daysOfWeek.length > 0) {
        let count = 0;
        do {
          date.setDate(date.getDate() + 1);
          count++;
        } while (!daysOfWeek.includes(date.getDay()) && count < 14);
      } else {
        date.setDate(date.getDate() + 7);
      }
      break;

    case 'monthly':
      date.setMonth(date.getMonth() + 1);
      break;

    case 'custom':
      date.setDate(date.getDate() + Math.max(1, intervalDays));
      break;

    default:
      date.setDate(date.getDate() + 1);
      break;
  }

  return date.toISOString().split('T')[0];
}
