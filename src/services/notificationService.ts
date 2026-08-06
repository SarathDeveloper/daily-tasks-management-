import { NotificationSettings, Task } from '../types';
import { audioService } from './audioService';

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
    if (!settings.quietHours.enabled) return false;
    const now = new Date();
    const currentMins = now.getHours() * 60 + now.getMinutes();

    const [startH, startM] = settings.quietHours.start.split(':').map(Number);
    const [endH, endM] = settings.quietHours.end.split(':').map(Number);

    const startMins = startH * 60 + startM;
    const endMins = endH * 60 + endM;

    if (startMins < endMins) {
      return currentMins >= startMins && currentMins < endMins;
    } else {
      // Overnight (e.g. 22:00 to 07:00)
      return currentMins >= startMins || currentMins < endMins;
    }
  }

  public static sendTaskNotification(
    task: Task,
    settings: NotificationSettings,
    onAlertTriggered?: (task: Task) => void
  ) {
    const isQuiet = this.isQuietHours(settings);

    // Play Sound if enabled and not quiet hours
    if (settings.soundEnabled && !isQuiet && task.reminder.sound) {
      audioService.playSound(task.reminder.sound, task.title);
    }

    // Trigger Browser Notification if granted and enabled
    if (
      settings.browserNotificationsEnabled &&
      !isQuiet &&
      'Notification' in window &&
      Notification.permission === 'granted'
    ) {
      try {
        const title = `⏰ Reminder: ${task.title}`;
        const body = task.time ? `Scheduled for ${task.time} (${task.category})` : task.category;
        const notification = new Notification(title, {
          body,
          icon: '/favicon.ico',
          tag: `task-${task.id}`,
          requireInteraction: true,
        });

        notification.onclick = () => {
          window.focus();
          if (onAlertTriggered) onAlertTriggered(task);
          notification.close();
        };
      } catch (e) {
        console.warn('Native notification failed:', e);
      }
    }

    // Trigger in-app alert banner
    if (onAlertTriggered) {
      onAlertTriggered(task);
    }
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
