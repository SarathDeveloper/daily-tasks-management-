import { registerPlugin } from '@capacitor/core';
import { isNativeAndroid } from '../lib/platform';
import type { WidgetSnapshot } from '../lib/widgetSnapshot';

interface DayflowWidgetPlugin {
  update(options: { snapshot: string }): Promise<void>;
  clear(): Promise<void>;
}

const DayflowWidget = registerPlugin<DayflowWidgetPlugin>('DayflowWidget');

let lastSent = '';

/** Pushes the snapshot to the home-screen widgets. Skips identical snapshots. */
export async function updateHomeWidgets(snapshot: WidgetSnapshot): Promise<void> {
  if (!isNativeAndroid()) return;
  const json = JSON.stringify(snapshot);
  if (json === lastSent) return;
  await DayflowWidget.update({ snapshot: json });
  lastSent = json;
}

/** Blanks the widgets, e.g. when the app is locked or data is reset. */
export async function clearHomeWidgets(): Promise<void> {
  if (!isNativeAndroid()) return;
  lastSent = '';
  await DayflowWidget.clear();
}
