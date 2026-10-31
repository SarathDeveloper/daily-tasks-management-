import { registerPlugin, type PluginListenerHandle } from '@capacitor/core';

export interface NativeRingPlan {
  id: string;
  notificationId: number;
  at: number;
  title: string;
  body: string;
  sound: string;
  kind: 'task' | 'habit' | 'alarm';
  snoozeMinutes: number;
  /** HH:mm. Set for clock alarms so a dismiss can schedule the next day. */
  time?: string;
  daysOfWeek?: number[];
}

export interface AlarmEvent {
  type: 'dismiss' | 'snooze';
  id: string;
  kind: 'task' | 'habit' | 'alarm';
  at: number;
  snoozeMinutes: number;
}

interface DayflowAlarmPlugin {
  pickMusic(): Promise<{ name: string }>;
  clearMusic(): Promise<void>;
  hasMusic(): Promise<{ has: boolean; name: string }>;
  preview(options: { sound: string }): Promise<void>;
  stopPreview(): Promise<void>;
  sync(options: { plans: NativeRingPlan[] }): Promise<void>;
  consumeEvents(): Promise<{ events: AlarmEvent[] }>;
  /** Open the Android share sheet for a JSON backup. The file stays in app cache. */
  shareBackup(options: { filename: string; contents: string }): Promise<void>;
  pickBackupFolder(): Promise<{ name: string }>;
  getBackupFolder(): Promise<{ has: boolean; lost: boolean; name: string }>;
  clearBackupFolder(): Promise<void>;
  writeBackupFile(options: { contents: string }): Promise<void>;
  addListener(
    eventName: 'alarmEvent',
    listenerFunc: (event: AlarmEvent) => void
  ): Promise<PluginListenerHandle>;
}

export const DayflowAlarm = registerPlugin<DayflowAlarmPlugin>('DayflowAlarm');
