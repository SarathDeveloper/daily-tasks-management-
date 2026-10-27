import { Capacitor } from '@capacitor/core';

/** True when running inside the Capacitor shell (Android APK). */
export function isNative(): boolean {
  return Capacitor.isNativePlatform();
}

export function isNativeAndroid(): boolean {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';
}

export function platformName(): string {
  return Capacitor.getPlatform();
}
