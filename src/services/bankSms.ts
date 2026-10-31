import { registerPlugin, type PluginListenerHandle } from '@capacitor/core';

export interface RawSmsMessage {
  id: string;
  address: string;
  body: string;
  receivedAt: number;
}

interface BankSmsPlugin {
  checkPermission(): Promise<{ granted: boolean }>;
  requestPermission(): Promise<{ granted: boolean }>;
  peekQueue(): Promise<{ messages: RawSmsMessage[] }>;
  ackQueue(options: { ids: string[] }): Promise<void>;
  scanRecent(options: { days: number }): Promise<{ messages: RawSmsMessage[] }>;
  addListener(
    eventName: 'smsQueued',
    listenerFunc: () => void
  ): Promise<PluginListenerHandle>;
}

export const BankSms = registerPlugin<BankSmsPlugin>('BankSms');
