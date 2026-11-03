import { registerPlugin, type PluginListenerHandle } from '@capacitor/core';

export interface RawSmsMessage {
  id: string;
  /** Conversation name or sender shown on the notification. */
  address: string;
  body: string;
  receivedAt: number;
}

interface BankSmsPlugin {
  /** True when Dayflow is allowed to read notifications. */
  isEnabled(): Promise<{ enabled: boolean }>;
  /** Opens the notification-access screen for this app. */
  openSettings(): Promise<void>;
  /** Opens App info, where Android 13+ allows restricted settings. */
  openAppDetails(): Promise<void>;
  peekQueue(): Promise<{ messages: RawSmsMessage[] }>;
  ackQueue(options: { ids: string[] }): Promise<void>;
  addListener(
    eventName: 'smsQueued',
    listenerFunc: () => void
  ): Promise<PluginListenerHandle>;
}

export const BankSms = registerPlugin<BankSmsPlugin>('BankSms');
